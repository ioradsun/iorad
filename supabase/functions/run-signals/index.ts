import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildIoradPrompt, type LibraryLink } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  partner: string | null;
  persona: string | null;
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
    console.error(`Firecrawl error for "${company.name}":`, err.message);
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
    const { data: aiConfigRow } = await supabase.from("ai_config").select("system_prompt, model, prompt_template").eq("id", 1).single();
    const aiConfig = aiConfigRow || { system_prompt: "You are a GTM strategist for iorad.", model: "google/gemini-2.5-flash", prompt_template: "" };

    const { data: eventsRows } = await supabase.from("compelling_events").select("label").eq("is_active", true).order("sort_order");
    const compellingEvents = (eventsRows || []).map((e: any) => e.label);

    const { data: libraryRows } = await supabase.from("iorad_libraries").select("label, help_center_url").order("label");
    const libraryLinks: LibraryLink[] = (libraryRows || []).map((r: any) => ({ label: r.label, help_center_url: r.help_center_url }));

    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }

    const offset = body.offset || 0;
    const jobId = body.job_id || null;
    const singleCompanyId = body.company_id || null;
    const mode = body.mode || "full"; // "full" | "signals_only" | "score_only" | "snapshot_only"

    let company: CompanyRow;

    if (singleCompanyId) {
      // Single company mode
      const { data, error: compErr } = await supabase
        .from("companies")
        .select("id, name, domain, industry, partner, persona")
        .eq("id", singleCompanyId)
        .maybeSingle();
      if (compErr) throw compErr;
      if (!data) throw new Error("Company not found");
      company = data;
    } else {
      // Batch mode — get 1 company at the given offset
      const { data: companies, error: compErr } = await supabase
        .from("companies")
        .select("id, name, domain, industry, partner, persona")
        .order("last_processed_at", { ascending: true, nullsFirst: true })
        .range(offset, offset);

      if (compErr) throw compErr;
      if (!companies || companies.length === 0) {
        if (jobId) {
          await supabase.from("processing_jobs")
            .update({ status: "completed", finished_at: new Date().toISOString() })
            .eq("id", jobId);
        }
        return new Response(JSON.stringify({ done: true, job_id: jobId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      company = companies[0];
    }

    // Create job on first call
    let activeJobId = jobId;
    if (!activeJobId) {
      const { count } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true });

      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          trigger: "manual",
          status: "running",
          total_companies_targeted: count || 0,
          settings_snapshot: {},
        })
        .select()
        .single();

      if (jobErr) throw jobErr;
      activeJobId = job.id;
    }

    let status = "succeeded";
    let signalsCount = 0;
    let snapshotStatus = "Low Signal";
    let errorMsg: string | null = null;

    try {
      console.log(`Processing: ${company.name} (mode: ${mode})`);

      let signals: { title: string; url: string; type: string; excerpt: string }[] = [];

      // Step 1: Search signals (unless score_only or snapshot_only)
      if (mode === "full" || mode === "signals_only") {
        signals = await searchSignals(company, firecrawlKey);
        signalsCount = signals.length;

        for (const sig of signals) {
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
      }

      // For score/snapshot modes, load existing signals from DB
      if (mode === "score_only" || mode === "snapshot_only") {
        const { data: dbSignals } = await supabase
          .from("signals")
          .select("title, url, type, raw_excerpt")
          .eq("company_id", company.id);
        signals = (dbSignals || []).map(s => ({
          title: s.title,
          url: s.url,
          type: s.type,
          excerpt: s.raw_excerpt || "",
        }));
        signalsCount = signals.length;
      }

      // Step 2: Score + Snapshot (unless signals_only)
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

        // Push to Clay for contact enrichment
        const clayApiKey = Deno.env.get("CLAY_API_KEY");
        const clayTableId = Deno.env.get("CLAY_TABLE_ID");
        if (clayApiKey && clayTableId) {
          try {
            const clayPayload = {
              records: [{
                id: company.id,
                cells: {
                  "Company Name": company.name,
                  "Domain": company.domain || "",
                  "Industry": company.industry || "",
                  "Partner": company.partner || "",
                  "Score": result.score_total,
                  "Snapshot Status": result.snapshot_status,
                  "Executive Framing": result.snapshot_json?.outbound_positioning?.executive_framing || result.snapshot_json?.executive_narrative || "",
                   "Min Contacts": 5,
                   "Job Title Keywords": "enablement, learning, change management, L&D, education, Customer Education, Partner enablement, readiness, sales enablement, revenue enablement",
                },
              }],
            };

            const clayResp = await fetch(`https://api.clay.com/v3/tables/${clayTableId}/records`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${clayApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(clayPayload),
            });

            if (!clayResp.ok) {
              const errText = await clayResp.text();
              console.error(`Clay push failed for ${company.name}: ${clayResp.status} ${errText}`);
            } else {
              console.log(`Pushed ${company.name} to Clay table`);
              await supabase.from("companies").update({ clay_pushed_at: new Date().toISOString() }).eq("id", company.id);
            }
          } catch (clayErr: any) {
            console.error(`Clay push error for ${company.name}: ${clayErr.message}`);
          }
        }
      } else {
        // signals_only — just update last_processed_at
        await supabase.from("companies").update({
          last_processed_at: new Date().toISOString(),
        }).eq("id", company.id);
      }

      console.log(`Done: ${company.name} — ${signalsCount} signals, status: ${snapshotStatus}`);
    } catch (e) {
      status = "failed";
      errorMsg = e.message;
      console.error(`Failed: ${company.name} — ${e.message}`);
    }

    // Save job item
    await supabase.from("processing_job_items").insert({
      job_id: activeJobId,
      company_id: company.id,
      status,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      signals_found_count: signalsCount,
      snapshot_status: snapshotStatus,
      error_message: errorMsg,
    });

    // Update job counts
    const { data: jd } = await supabase
      .from("processing_jobs")
      .select("companies_processed, companies_succeeded, companies_failed")
      .eq("id", activeJobId)
      .single();

    const updates: Record<string, number> = {
      companies_processed: (jd?.companies_processed || 0) + 1,
    };
    if (status === "succeeded") {
      updates.companies_succeeded = (jd?.companies_succeeded || 0) + 1;
    } else {
      updates.companies_failed = (jd?.companies_failed || 0) + 1;
    }
    await supabase.from("processing_jobs").update(updates).eq("id", activeJobId);

    return new Response(
      JSON.stringify({
        job_id: activeJobId,
        company: company.name,
        status,
        signals_found: signalsCount,
        snapshot_status: snapshotStatus,
        next_offset: offset + 1,
        done: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-signals error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
