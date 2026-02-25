import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { company_id, contact_id, tab } = await req.json();
    const activeTab = tab || "strategy"; // default to strategy for backward compat
    if (!company_id) throw new Error("company_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(supabaseUrl, supabaseKey);

    // Load company
    const { data: company, error: compErr } = await sb
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .single();
    if (compErr || !company) throw new Error(compErr?.message || "Company not found");

    // ── HubSpot customer check (outbound only) ─────────────────────────────
    // Run before generating so the AI gets accurate is_existing_customer context
    if (company.source_type !== "inbound" && company.domain) {
      try {
        const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
        if (hubspotKey) {
          const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: company.domain }] }],
              properties: ["name", "domain", "lifecyclestage"],
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
                await sb.from("companies").update({ is_existing_customer: true }).eq("id", company_id);
                company.is_existing_customer = true;
                console.log(`HubSpot: ${company.name} flagged as existing customer (lifecycle: ${lifecycle})`);
              }
            }
          } else {
            console.warn(`HubSpot check failed [${hsRes.status}] for ${company.domain}`);
          }
        }
      } catch (hsErr: any) {
        console.warn(`HubSpot customer check error: ${hsErr.message}`);
      }
    }

    // Step 0: Extract contact profiles (Pass 1) for any contacts with HubSpot data but no profile yet
    const { data: unprofiledContacts } = await sb
      .from("contacts")
      .select("id")
      .eq("company_id", company_id)
      .not("hubspot_properties", "is", null)
      .is("contact_profile", null);

    if (unprofiledContacts && unprofiledContacts.length > 0) {
      console.log(`Extracting profiles for ${unprofiledContacts.length} contacts before generation…`);
      try {
        const extractUrl = `${supabaseUrl}/functions/v1/extract-contact-profile`;
        const extractRes = await fetch(extractUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ company_id }),
        });
        if (extractRes.ok) {
          const extractData = await extractRes.json();
          console.log(`Profile extraction: ${extractData.profiles_extracted} extracted`);
        } else {
          console.warn("Profile extraction failed, continuing with raw data:", await extractRes.text());
        }
      } catch (extractErr) {
        console.warn("Profile extraction error, continuing:", extractErr);
      }
    }

    // Load contacts, signals, latest snapshot in parallel
    const [contactsRes, signalsRes, snapshotRes, aiConfigRes] = await Promise.all([
      sb.from("contacts").select("*").eq("company_id", company_id),
      sb.from("signals").select("*").eq("company_id", company_id).order("discovered_at", { ascending: false }),
      sb.from("snapshots").select("*").eq("company_id", company_id).order("created_at", { ascending: false }).limit(1),
      sb.from("ai_config").select("*").eq("id", 1).single(),
    ]);

    const contacts = contactsRes.data || [];
    const signals = signalsRes.data || [];
    const latestSnapshot = snapshotRes.data?.[0] || null;
    const aiConfig = aiConfigRes.data;

    // Determine model
    const model = aiConfig?.model || "google/gemini-2.5-flash";

    // Use specified contact or fall back to first
    const primaryContact = contact_id
      ? contacts.find((c: any) => c.id === contact_id) || contacts[0] || null
      : contacts[0] || null;
    const context = {
      company_name: company.name,
      domain: company.domain,
      industry: company.industry,
      hq: company.hq_country,
      employees: company.headcount,
      partner: company.partner,
      persona: company.persona,
      contact_name: primaryContact?.name || company.buyer_name || null,
      contact_role: primaryContact?.title || company.buyer_title || null,
      contacts: contacts.map((c: any) => {
        // Use AI-extracted profile (Pass 1) if available, otherwise fall back to raw properties
        const profile = c.contact_profile;
        if (profile) {
          return {
            name: c.name,
            title: c.title,
            email: c.email,
            linkedin: c.linkedin,
            source: c.source,
            confidence: c.confidence,
            product_usage_profile: profile,
          };
        }
        // Fallback: raw HubSpot properties (for contacts not yet profiled)
        const hp = c.hubspot_properties || {};
        return {
          name: c.name,
          title: c.title,
          email: c.email,
          linkedin: c.linkedin,
          source: c.source,
          confidence: c.confidence,
          plan_name: hp.plan_name || null,
          account_type: hp.account__type || null,
          category: hp.account_type || null,
          tutorials_created: hp.tutorials_created || null,
          tutorials_views: hp.tutorials_views || null,
          documenting_product: hp.first_embed_tutorial_base_domain_name || null,
          embedded_in: hp.first_embed_base_domain_name || null,
          last_active_date: hp.last_active_date || null,
        };
      }),
      signals: signals.map((s: any) => ({
        type: s.type,
        title: s.title,
        url: s.url,
        date: s.date,
        raw_excerpt: s.raw_excerpt,
        evidence_snippets: s.evidence_snippets,
      })),
      latest_snapshot: latestSnapshot
        ? {
            score_total: latestSnapshot.score_total,
            score_breakdown: latestSnapshot.score_breakdown,
            snapshot_json: latestSnapshot.snapshot_json,
          }
        : null,
    };

    const userPrompt = `Generate content for the "${activeTab}" tab of the CRM dashboard for this account.

ACCOUNT CONTEXT:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON matching the output schema. No markdown, no commentary.`;

    // Select the prompt for the requested tab, using inbound variants for inbound companies
    const isInbound = company.source_type === "inbound";
    const promptMap: Record<string, string> = {
      company: aiConfig?.company_prompt || "",
      strategy: isInbound
        ? (aiConfig?.inbound_strategy_prompt || aiConfig?.strategy_prompt || aiConfig?.cards_prompt_template || "")
        : (aiConfig?.strategy_prompt || aiConfig?.cards_prompt_template || ""),
      outreach: isInbound
        ? (aiConfig?.inbound_outreach_prompt || aiConfig?.outreach_prompt || "")
        : (aiConfig?.outreach_prompt || ""),
      story: isInbound
        ? (aiConfig?.inbound_story_prompt || aiConfig?.story_prompt || "")
        : (aiConfig?.story_prompt || ""),
    };
    const systemPrompt = promptMap[activeTab];
    if (!systemPrompt || !systemPrompt.trim()) {
      throw new Error(`${activeTab}${isInbound ? " (inbound)" : ""} prompt is not configured. Go to Admin Settings → AI & Prompt to set it up.`);
    }

    console.log(`Generating cards for ${company.name} using ${model}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 32768,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response — robustly extract first valid JSON object or array
    let parsed: any;
    try {
      // 1. Strip markdown fences and thinking tags
      let cleaned = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .trim();

      // 2. Try direct parse first
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // 3. Fallback: extract the first {...} or [...] block
        const objMatch = cleaned.match(/(\{[\s\S]*\})/);
        const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
        const candidate = objMatch?.[1] ?? arrMatch?.[1];
        if (candidate) {
          try {
            parsed = JSON.parse(candidate);
          } catch {
            // 4. Last resort: truncated JSON — try to find the last complete top-level key
            //    by progressively trimming from the end until we get valid JSON
            let attempt = candidate;
            for (let i = 0; i < 20; i++) {
              const lastComma = attempt.lastIndexOf(",");
              if (lastComma === -1) break;
              attempt = attempt.substring(0, lastComma) + "}";
              try {
                parsed = JSON.parse(attempt);
                console.warn(`Recovered truncated JSON after ${i + 1} trim(s)`);
                break;
              } catch { /* keep trimming */ }
            }
            if (!parsed) throw new Error("no valid JSON block found after recovery attempts");
          }
        } else {
          throw new Error("no JSON block found in response");
        }
      }
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", rawContent.substring(0, 800));
      throw new Error("AI returned invalid JSON");
    }

    // Fetch existing row so we can MERGE per-tab data instead of overwriting all fields
    // Filter by contact_id to avoid maybeSingle() errors when multiple rows exist
    let existingRowQuery = sb
      .from("company_cards")
      .select("id, cards_json, assets_json, account_json")
      .eq("company_id", company_id);
    if (contact_id) {
      existingRowQuery = existingRowQuery.eq("contact_id", contact_id);
    } else {
      existingRowQuery = existingRowQuery.is("contact_id", null);
    }
    const { data: existingRow } = await existingRowQuery.maybeSingle();

    // Start from existing values so tabs don't wipe each other out
    let cards_json: any = existingRow?.cards_json ?? [];
    let assets_json: any = existingRow?.assets_json ?? {};
    let account_json: any = existingRow?.account_json ?? {};

    // --- Parse per-tab output and merge into the correct field only ---

    if (activeTab === "company") {
      // Company tab: store its data in account_json, preserving other tab data
      const companyData = parsed.account || parsed;
      // Keep strategy/story keys if already present, add/overwrite company key
      account_json = { ...account_json, _company: companyData };
    } else if (activeTab === "strategy") {
      // Outbound: cards array. Inbound: flat object (mega prompt format)
      const isInboundStrategy =
        !parsed.cards &&
        (parsed.momentum_observed || parsed.initiative_translation || parsed.observed_behavior ||
         parsed.inferred_initiative || parsed.execution_gap);
      if (isInboundStrategy) {
        // Store inbound strategy under a DEDICATED key so Story doesn't overwrite it
        account_json = { ...account_json, _strategy: parsed, _company: account_json._company };
      } else {
        cards_json = parsed.cards || parsed || [];
      }
    } else if (activeTab === "outreach") {
      if (parsed.email_sequence || parsed.linkedin_sequence) {
        // Inbound outreach: merge sequences into assets_json
        assets_json = {
          ...assets_json,
          email_sequence: parsed.email_sequence || null,
          linkedin_sequence: parsed.linkedin_sequence || null,
        };
        // Store outreach metadata under dedicated key
        account_json = {
          ...account_json,
          _outreach_meta: {
            intent_tier: parsed.intent_tier || null,
            behavior_acknowledged: parsed.behavior_acknowledged || null,
            momentum_frame: parsed.momentum_frame || null,
            expansion_opportunity: parsed.expansion_opportunity || null,
            risk_if_stalled: parsed.risk_if_stalled || null,
            upside_if_executed: parsed.upside_if_executed || null,
          },
        };
      } else {
        // Outbound outreach: assets structure
        assets_json = { ...assets_json, ...(parsed.assets || parsed) };
      }
    } else if (activeTab === "story") {
      if (parsed.behavior_acknowledged || parsed.momentum_observed || parsed.initiative_translation) {
        // Inbound story: store at root with _type marker, preserve _strategy + _company + _outreach_meta
        account_json = {
          _company: account_json._company,
          _strategy: account_json._strategy,
          _outreach_meta: account_json._outreach_meta,
          ...parsed,
          _type: "inbound_story",
        };
      } else {
        // Outbound story: assets structure
        assets_json = { ...assets_json, ...(parsed.assets || {}) };
        account_json = { ...account_json, ...(parsed.account || {}) };
      }
    }

    const isInboundStory =
      activeTab === "story" &&
      (parsed.behavior_acknowledged || parsed.momentum_observed || parsed.initiative_translation);

    // Upsert or insert — merge into existing row if it exists
    let upsertErr: any = null;
    if (existingRow?.id) {
      const { error } = await sb
        .from("company_cards")
        .update({
          cards_json,
          assets_json,
          account_json,
          model_version: model,
          contact_id: contact_id || null,
        })
        .eq("id", existingRow.id);
      upsertErr = error;
    } else {
      const { error } = await sb
        .from("company_cards")
        .insert({
          company_id,
          cards_json,
          assets_json,
          account_json,
          model_version: model,
          contact_id: contact_id || null,
        });
      upsertErr = error;
    }

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw new Error(upsertErr.message);
    }

    // For inbound story: also write the rich narrative into the snapshot so the public
    // microsite (CustomerStory.tsx) renders the personalized brief instead of a blank template.
    if (isInboundStory && activeTab === "story") {
      const p = parsed;

      // Map inbound story fields → snapshot_json schema used by CustomerStory.tsx
      const whatsHappening: any[] = [];
      if (p.behavior_acknowledged) whatsHappening.push({ title: "Behavior Acknowledged", detail: p.behavior_acknowledged });
      if (p.momentum_observed)    whatsHappening.push({ title: "Momentum Observed", detail: p.momentum_observed });
      if (p.initiative_translation) whatsHappening.push({ title: "Initiative Translation", detail: p.initiative_translation });

      const executionFriction: string[] = [];
      if (p.scale_risk)               executionFriction.push(p.scale_risk);
      if (p.institutionalization_gap) executionFriction.push(p.institutionalization_gap);

      const inboundSnapshotJson: Record<string, unknown> = {
        // Core narrative sections
        whats_happening: whatsHappening,
        functional_implications: p.executive_translation || "",
        execution_friction: executionFriction,
        real_cost: p.real_cost_if_stalled ? [p.real_cost_if_stalled] : [],
        blind_spot: p.institutionalization_gap || "",
        reinforcement_journey: p.reinforcement_journey || "",
        why_now: p.why_now || "",
        cta: p.cta || "",
        // Strategic plays (same schema as outbound)
        strategic_plays: (p.strategic_plays || []).map((play: any) => ({
          name: play.name || "",
          objective: play.objective || "",
          why_now: play.why_now || "",
          what_it_looks_like: play.what_it_looks_like || "",
          expected_impact: play.expected_impact || "",
        })),
        // Reinforcement preview
        reinforcement_preview: p.reinforcement_preview ? {
          detected_tool: p.reinforcement_preview.detected_tool || "",
          library_url: p.reinforcement_preview.library_url || null,
          description: p.reinforcement_preview.description || "",
        } : undefined,
        // Internal signals for meta display
        internal_signals: {
          primary_persona: p.persona || company.persona || "",
          confidence_level: "High",
          urgency: p.intent_tier === "Tier 1" ? "High Momentum" : p.intent_tier === "Tier 2" ? "Active" : "Emerging",
          signal_types: ["inbound_behavior"],
          enterprise_systems: [],
          operational_risks: p.real_cost_if_stalled ? [p.real_cost_if_stalled] : [],
          hiring_intensity: "",
          platform_rollout: p.upside_if_executed || "",
        },
        // Preserve scoring
        inbound_tier: latestSnapshot?.score_total ? Math.ceil(latestSnapshot.score_total / 25) : undefined,
        upside_if_executed: p.upside_if_executed || "",
        // Opening hook for hero section
        opening_hook: {
          subject_line: p.initiative_translation || `${company.name} — Institutionalization Brief`,
          opening_paragraph: p.behavior_acknowledged || "",
        },
      };

      // Update the latest snapshot with the rich story content
      const existingSnapshot = latestSnapshot;
      if (existingSnapshot) {
        const { error: snapUpdateErr } = await sb
          .from("snapshots")
          .update({
            snapshot_json: {
              ...(existingSnapshot.snapshot_json as Record<string, unknown> || {}),
              ...inboundSnapshotJson,
            },
          })
          .eq("id", existingSnapshot.id);

        if (snapUpdateErr) {
          console.warn("Snapshot update failed (non-fatal):", snapUpdateErr.message);
        } else {
          console.log(`Inbound story mapped into snapshot for ${company.name}`);
        }
      }
    }

    console.log(`Cards generated and saved for ${company.name}`);

    return new Response(
      JSON.stringify({ success: true, company: company.name, cards_count: cards_json.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-cards error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

