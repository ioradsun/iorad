import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildIoradPrompt, type LibraryLink } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Partner → Persona mapping for auto contact enrichment
const PARTNER_PERSONA_MAP: Record<string, string> = {
  docebo: "Learning & Development",
  "360learning": "Learning & Development",
  seismic: "Sales Enablement",
  gainsight: "Customer Education",
  workramp: "Learning & Development",
};

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  partner: string | null;
  persona: string | null;
  source_type: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INBOUND BEHAVIORAL SCORING (mirrors extract-contact-profile logic)
// Aggregates scores across all contacts for a company and returns best/avg.
// ─────────────────────────────────────────────────────────────────────────────

interface InboundScoreResult {
  best_score: number;
  avg_score: number;
  best_tier: number;
  best_tier_label: string;
  contacts_scored: number;
}

function daysSinceStr(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  const ts = new Date(isoString).getTime();
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function scoreContact(hp: Record<string, any>): number {
  let score = 0;

  // 1. Engagement (max 25)
  const pageViews = parseInt(hp.hs_analytics_num_page_views || hp.num_page_views || "0", 10) || 0;
  let eng = pageViews >= 50 ? 15 : pageViews >= 20 ? 10 : pageViews >= 5 ? 5 : 2;
  const lastVisit = daysSinceStr(hp.hs_analytics_last_visit_timestamp);
  if (lastVisit !== null && lastVisit <= 7) eng += 5;
  const lastEmail = daysSinceStr(hp.hs_email_last_engagement);
  if (lastEmail !== null && lastEmail <= 14) eng += 5;
  score += Math.min(25, eng);

  // 2. Conversion (max 20)
  const convDays = daysSinceStr(hp.recent_conversion_date);
  if (convDays !== null && convDays <= 14) {
    const ev = (hp.recent_conversion_event_name || "").toLowerCase();
    if (ev.includes("demo")) score += 20;
    else if (ev.includes("pric") || ev.includes("upgrad") || ev.includes("plan")) score += 15;
    else if (ev.includes("download") || ev.includes("resource") || ev.includes("guide")) score += 10;
    else score += 5;
  }

  // 3. Commercial (max 20)
  const lc = (hp.lifecyclestage || "").toLowerCase();
  let commercial = lc.includes("opportunit") ? 20 : lc.includes("salesqualif") ? 15 :
    lc.includes("marketingqu") ? 10 : lc.includes("lead") ? 5 : lc.includes("subscriber") ? 2 : 0;
  if (parseInt(hp.num_associated_deals || "0", 10) > 0) commercial = Math.min(20, commercial + 5);
  score += commercial;

  // 4. Momentum (max 20)
  const created = daysSinceStr(hp.createdate);
  const modified = daysSinceStr(hp.lastmodifieddate);
  if (created !== null && created <= 7) score += 10;
  if (modified !== null && modified <= 7) score += 10;
  score = Math.min(score, score); // cap individual components handled above

  // 5. Volume (max 15)
  score += pageViews > 100 ? 15 : pageViews >= 50 ? 10 : pageViews >= 20 ? 5 : 2;

  // HubSpot score bonus (max 10)
  const hs = parseInt(hp.hubspotscore || "0", 10);
  if (hs > 0) score += Math.min(10, Math.round(hs / 10));

  return Math.min(100, score);
}

async function scoreInboundCompany(
  supabase: any,
  companyId: string
): Promise<InboundScoreResult> {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("hubspot_properties, contact_profile")
    .eq("company_id", companyId)
    .not("hubspot_properties", "is", null);

  if (!contacts || contacts.length === 0) {
    return { best_score: 0, avg_score: 0, best_tier: 4, best_tier_label: "Dormant", contacts_scored: 0 };
  }

  const scores: number[] = [];

  for (const contact of contacts) {
    // Use pre-computed score from contact_profile if available
    const profile = contact.contact_profile;
    if (profile && typeof profile.inbound_score === "number") {
      scores.push(profile.inbound_score);
    } else if (contact.hubspot_properties && Object.keys(contact.hubspot_properties).length > 0) {
      scores.push(scoreContact(contact.hubspot_properties as Record<string, any>));
    }
  }

  if (scores.length === 0) {
    return { best_score: 0, avg_score: 0, best_tier: 4, best_tier_label: "Dormant", contacts_scored: 0 };
  }

  const best = Math.max(...scores);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  let best_tier = 4;
  let best_tier_label = "Dormant";
  if      (best >= 70) { best_tier = 1; best_tier_label = "Strategic Inbound"; }
  else if (best >= 45) { best_tier = 2; best_tier_label = "Emerging Momentum"; }
  else if (best >= 20) { best_tier = 3; best_tier_label = "Early Stage"; }

  return { best_score: best, avg_score: avg, best_tier, best_tier_label, contacts_scored: scores.length };
}

async function searchSignals(
  company: CompanyRow,
  firecrawlKey: string
): Promise<{ title: string; url: string; type: string; excerpt: string }[]> {
  const signals: { title: string; url: string; type: string; excerpt: string }[] = [];

  // Single combined query to reduce API calls
  const query = `"${company.name}" hiring OR funding OR expansion OR partnership OR launch`;

  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Firecrawl error for "${company.name}": ${resp.status} ${errText}`);
      return signals;
    }

    const result = await resp.json();
    const items = result.data || result.results || [];

    for (const item of items) {
      if (!item.url) continue;
      const title = (item.title || "").toLowerCase();
      const type = (title.includes("hiring") || title.includes("job") || title.includes("career"))
        ? "job_post" : "news";
      signals.push({
        title: item.title || "Signal",
        url: item.url,
        type,
        excerpt: (item.description || "").slice(0, 500),
      });
    }
  } catch (err) {
    console.error(`Firecrawl error for "${company.name}":`, (err as Error).message);
  }

  return signals;
}

async function scoreSignals(
  company: CompanyRow,
  signals: { title: string; url: string; type: string; excerpt: string }[],
  lovableKey: string,
  aiConfig: { system_prompt: string; model: string; prompt_template?: string },
  compellingEvents: string[],
  libraryLinks: LibraryLink[]
): Promise<{
  score_total: number;
  score_breakdown: Record<string, number>;
  snapshot_json: Record<string, any>;
  snapshot_status: string;
}> {
  if (signals.length === 0) {
    return {
      score_total: 0,
      score_breakdown: { hiring: 0, news: 0, expansion: 0 },
      snapshot_json: { why_now: "No recent signals found.", evidence: [] },
      snapshot_status: "Low Signal",
    };
  }

  const signalSummary = signals
    .map((s, i) => `${i + 1}. [${s.type}] ${s.title} - ${s.excerpt.slice(0, 150)}`)
    .join("\n");

  try {
    const prompt = buildIoradPrompt(
      company.name,
      company.industry || "unknown",
      company.partner,
      signalSummary,
      aiConfig.system_prompt,
      compellingEvents,
      aiConfig.prompt_template,
      undefined, // contactName — could come from company row later
      undefined, // contactTitle
      company.persona || undefined,
      libraryLinks
    );

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: "system", content: "Return only valid JSON. No markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      await resp.text();
      return fallback(signals);
    }

    const aiResult = await resp.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback(signals);

    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.min(100, Math.max(0, parsed.score_total || 0));
    
    // Store the full enterprise analysis in snapshot_json
    const { score_total: _st, score_breakdown: _sb, ...analysisFields } = parsed;
    
    return {
      score_total: score,
      score_breakdown: parsed.score_breakdown || { hiring: 0, news: 0, expansion: 0 },
      snapshot_json: analysisFields,
      snapshot_status: score >= 40 ? "Generated" : "Low Signal",
    };
  } catch {
    return fallback(signals);
  }
}

function fallback(signals: any[]) {
  return {
    score_total: Math.min(100, signals.length * 15),
    score_breakdown: { hiring: 0, news: 0, expansion: 0 },
    snapshot_json: { why_now: "Signals found but AI scoring unavailable.", evidence: [] },
    snapshot_status: "Generated",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    // Load AI config, compelling events, and library links from DB
    const { data: aiConfigRow } = await supabase
      .from("ai_config")
      .select("system_prompt, inbound_system_prompt, model, prompt_template")
      .eq("id", 1)
      .single();
    const aiConfig = aiConfigRow || { system_prompt: "You are a GTM strategist for iorad.", inbound_system_prompt: "", model: "google/gemini-2.5-flash", prompt_template: "" };

    const { data: eventsRows } = await supabase.from("compelling_events").select("label").eq("is_active", true).order("sort_order");
    const compellingEvents = (eventsRows || []).map((e: any) => e.label);

    const { data: libraryRows } = await supabase.from("iorad_libraries").select("label, help_center_url").order("label");
    const libraryLinks: LibraryLink[] = (libraryRows || []).map((r: any) => ({ label: r.label, help_center_url: r.help_center_url }));

    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }

    const singleCompanyId = body.company_id || null;
    const mode = body.mode || "full"; // "full" | "signals_only" | "score_only" | "snapshot_only"

    // Batch mode is disabled — only single-company calls are allowed
    if (!singleCompanyId) {
      return new Response(
        JSON.stringify({ error: "company_id is required. Bulk mode is disabled." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, domain, industry, partner, persona, source_type")
      .eq("id", singleCompanyId)
      .maybeSingle();
    if (compErr) throw compErr;
    if (!company) throw new Error("Company not found");

    let status = "succeeded";
    let signalsCount = 0;
    let snapshotStatus = "Low Signal";
    let errorMsg: string | null = null;

    try {
      const isInbound = company.source_type === "inbound";
      console.log(`Processing: ${company.name} (mode: ${mode}, inbound: ${isInbound})`);

      // ── INBOUND PATH: behavioral scoring from HubSpot properties ───────────
      if (isInbound) {
        // Step 0: Run contact profile extraction first to ensure scores are fresh
        try {
          const extractUrl = `${supabaseUrl}/functions/v1/extract-contact-profile`;
          await fetch(extractUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ company_id: company.id }),
          });
        } catch (extractErr: any) {
          console.warn("Inbound profile extraction failed, using raw data:", extractErr.message);
        }

        // Step 0b: Run Firecrawl web signal search (same as outbound) if domain is available
        if (company.domain && (mode === "full" || mode === "signals_only")) {
          try {
            console.log(`Inbound web signals: searching for ${company.name}`);
            const webSignals = await Promise.race([
              searchSignals(company, firecrawlKey),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Firecrawl timeout")), 15_000)
              ),
            ]);
            for (const sig of webSignals) {
              await supabase.from("signals").upsert(
                {
                  company_id: company.id,
                  title: sig.title,
                  url: sig.url,
                  type: sig.type,
                  raw_excerpt: sig.excerpt,
                  evidence_snippets: [],
                  last_seen_at: new Date().toISOString(),
                },
                { onConflict: "company_id,url" }
              );
            }
            signalsCount += webSignals.length;
            console.log(`Inbound web signals: ${webSignals.length} found for ${company.name}`);
          } catch (sigErr: any) {
            console.warn(`Inbound Firecrawl failed/timed out: ${sigErr.message}. Continuing.`);
          }
        }

        // Step 1: Compute behavioral score from contacts
        const inboundResult = await scoreInboundCompany(supabase, company.id);
        signalsCount += inboundResult.contacts_scored;
        snapshotStatus = inboundResult.best_score > 0 ? "Generated" : "Low Signal";

        // Step 2: Build snapshot JSON with inbound framing
        const snapshotJson = {
          why_now: `Behavioral momentum detected. Best contact score: ${inboundResult.best_score}/100 (${inboundResult.best_tier_label}).`,
          inbound_tier: inboundResult.best_tier,
          inbound_tier_label: inboundResult.best_tier_label,
          best_contact_score: inboundResult.best_score,
          avg_contact_score: inboundResult.avg_score,
          contacts_scored: inboundResult.contacts_scored,
          confidence_level: inboundResult.best_tier === 1 ? "High" : inboundResult.best_tier === 2 ? "Medium" : "Low",
          confidence_reason: `Scored from ${inboundResult.contacts_scored} HubSpot contact(s) using behavioral momentum model (page views, conversion events, lifecycle stage, recency).`,
        };

        await supabase.from("snapshots").insert({
          company_id: company.id,
          score_total: inboundResult.best_score,
          score_breakdown: {
            inbound_tier: inboundResult.best_tier,
            best_contact_score: inboundResult.best_score,
            avg_contact_score: inboundResult.avg_score,
            contacts_scored: inboundResult.contacts_scored,
          },
          snapshot_json: snapshotJson,
          model_version: "inbound-behavioral-v1",
          prompt_version: "tiered-scoring",
        });

        await supabase.from("companies").update({
          last_processed_at: new Date().toISOString(),
          last_score_total: inboundResult.best_score,
          snapshot_status: snapshotStatus,
        }).eq("id", company.id);

        console.log(`Inbound: ${company.name} — Score: ${inboundResult.best_score} (Tier ${inboundResult.best_tier}: ${inboundResult.best_tier_label})`);

        return new Response(
          JSON.stringify({
            company: company.name,
            status: "succeeded",
            signals_found: signalsCount,
            snapshot_status: snapshotStatus,
            inbound_tier: inboundResult.best_tier,
            inbound_tier_label: inboundResult.best_tier_label,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── OUTBOUND PATH ────────────────────────────────────────────────────────

      // Step 0: Check HubSpot for an existing customer record by domain
      if (company.domain) {
        try {
          const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
          if (hubspotKey) {
            const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: company.domain }] }],
                properties: ["name", "domain", "hs_object_id", "lifecyclestage", "customer"],
                limit: 1,
              }),
            });
            if (hsRes.ok) {
              const hsData = await hsRes.json();
              const hsCompany = hsData.results?.[0];
              if (hsCompany) {
                const lifecycle = (hsCompany.properties?.lifecyclestage || "").toLowerCase();
                const isCustomer = lifecycle === "customer" || lifecycle === "evangelist";
                if (isCustomer) {
                  await supabase.from("companies").update({ is_existing_customer: true }).eq("id", company.id);
                  console.log(`HubSpot: ${company.name} flagged as existing customer (lifecycle: ${lifecycle})`);
                } else {
                  console.log(`HubSpot: ${company.name} found in HubSpot (lifecycle: ${lifecycle}) — not a customer`);
                }
              }
            } else {
              const errText = await hsRes.text();
              console.warn(`HubSpot customer check failed for ${company.domain}: ${hsRes.status} ${errText.slice(0, 200)}`);
            }
          }
        } catch (hsErr: any) {
          console.warn(`HubSpot customer check error for ${company.name}: ${hsErr.message}`);
        }
      }

      let signals: { title: string; url: string; type: string; excerpt: string }[] = [];

      // Step 1: Search signals
      if (mode === "full" || mode === "signals_only") {
        try {
          const firecrawlResult = await Promise.race([
            searchSignals(company, firecrawlKey),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Firecrawl timeout")), 15_000)
            ),
          ]);
          signals = firecrawlResult;
          signalsCount = signals.length;
          for (const sig of signals) {
            await supabase.from("signals").upsert(
              { company_id: company.id, title: sig.title, url: sig.url, type: sig.type, raw_excerpt: sig.excerpt, evidence_snippets: [], last_seen_at: new Date().toISOString() },
              { onConflict: "company_id,url" }
            );
          }
        } catch (firecrawlErr: any) {
          console.warn(`Firecrawl failed/timed out for ${company.name}: ${firecrawlErr.message}. Continuing with 0 web signals.`);
          const { data: dbSignals } = await supabase
            .from("signals")
            .select("title, url, type, raw_excerpt")
            .eq("company_id", company.id);
          signals = (dbSignals || []).map((s: any) => ({
            title: s.title,
            url: s.url,
            type: s.type,
            excerpt: s.raw_excerpt || "",
          }));
          signalsCount = signals.length;
        }
      }

      // For score/snapshot modes, load existing signals from DB
      if (mode === "score_only" || mode === "snapshot_only") {
        const { data: dbSignals } = await supabase.from("signals").select("title, url, type, raw_excerpt").eq("company_id", company.id);
        signals = (dbSignals || []).map(s => ({ title: s.title, url: s.url, type: s.type, excerpt: s.raw_excerpt || "" }));
        signalsCount = signals.length;
      }

      // Step 2: Score + Snapshot
      if (mode !== "signals_only") {
        const result = await scoreSignals(company, signals, lovableKey, aiConfig, compellingEvents, libraryLinks);
        snapshotStatus = result.snapshot_status;

        await supabase.from("snapshots").insert({
          company_id: company.id,
          score_total: result.score_total,
          score_breakdown: result.score_breakdown,
          snapshot_json: result.snapshot_json,
          model_version: aiConfig.model,
          prompt_version: aiConfig.prompt_template ? "db-template" : "v2-iorad-hardcoded",
        });

        await supabase.from("companies").update({
          last_processed_at: new Date().toISOString(),
          last_score_total: result.score_total,
          snapshot_status: result.snapshot_status,
        }).eq("id", company.id);

        // Auto-enrich contacts based on partner→persona mapping
        const partnerKey = (company.partner || "").toLowerCase();
        const autoPersona = PARTNER_PERSONA_MAP[partnerKey];
        if (autoPersona) {
          try {
            const contactResp = await fetch(`${supabaseUrl}/functions/v1/find-contacts`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({ company_id: company.id, persona: autoPersona }),
            });
            if (contactResp.ok) {
              const contactResult = await contactResp.json();
              console.log(`Auto-enriched ${contactResult.contacts_found || 0} contacts for ${company.name}`);
            }
          } catch (contactErr: any) {
            console.warn(`Contact enrichment error for ${company.name}: ${contactErr.message}`);
          }
        }
      } else {
        await supabase.from("companies").update({ last_processed_at: new Date().toISOString() }).eq("id", company.id);
      }

      console.log(`Done: ${company.name} — ${signalsCount} signals, status: ${snapshotStatus}`);
    } catch (e) {
      status = "failed";
      errorMsg = (e as Error).message;
      console.error(`Failed: ${company.name} — ${(e as Error).message}`);
    }

    return new Response(
      JSON.stringify({ company: company.name, status, signals_found: signalsCount, snapshot_status: snapshotStatus, error: errorMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-signals error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
