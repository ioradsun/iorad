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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { meeting_id } = await req.json();
    if (!meeting_id) throw new Error("meeting_id is required");

    // Fetch the meeting
    const { data: meeting, error: meetingErr } = await sb
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .single();
    if (meetingErr || !meeting) throw new Error("Meeting not found");
    if (!meeting.transcript) throw new Error("No transcript available for this meeting");

    // Fetch the transcript prompt from ai_config
    const { data: config } = await sb
      .from("ai_config")
      .select("transcript_prompt, inbound_transcript_prompt, model")
      .eq("id", 1)
      .single();

    // Determine if this is an inbound company
    let isInbound = false;
    if (meeting.company_id) {
      const { data: comp } = await sb.from("companies").select("source_type").eq("id", meeting.company_id).single();
      isInbound = comp?.source_type === "inbound";
    }

    const promptTemplate = isInbound && config?.inbound_transcript_prompt
      ? config.inbound_transcript_prompt
      : (config?.transcript_prompt || "Analyze this meeting transcript and extract key insights:");
    const model = config?.model || "google/gemini-3-flash-preview";

    const fullPrompt = `${promptTemplate}\n\n---\n\n${meeting.transcript}`;

    console.log(`Analyzing transcript for meeting ${meeting_id} (${meeting.title}), model: ${model}`);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a senior enterprise account strategist. Return your analysis as structured JSON with the following top-level keys: executive_snapshot (array of strings), compelling_events (array of objects with event, timeline, implication), stated_initiatives (array of objects with initiative, owner, urgency, iorad_fit), usage_analysis (object with maturity, users, use_cases, blockers, excitement, friction, unrealized_potential, double_usage_answer), power_map (array of objects with name, role, influence, sentiment, cares_about), risk_assessment (object with signals array, churn_risk, churn_reason), expansion_angles (array of objects with angle, details), messaging_strategy (object with positioning_angles, questions, metrics, renewal_storyline), action_plan (object with day_30, day_60, day_90 each as array of strings), account_thesis (string)."
          },
          { role: "user", content: fullPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`AI gateway error ${aiResp.status}:`, errText);
      if (aiResp.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
      if (aiResp.status === 402) throw new Error("AI credits exhausted. Please add credits.");
      throw new Error(`AI gateway returned ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Try to parse as JSON, fall back to raw text
    let analysis: any;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { raw_text: content };
    }

    // Save analysis to the meeting
    const { error: updateErr } = await sb
      .from("meetings")
      .update({ transcript_analysis: analysis })
      .eq("id", meeting_id);

    if (updateErr) {
      console.error("Failed to save analysis:", updateErr.message);
      throw new Error("Failed to save analysis");
    }

    console.log(`Analysis saved for meeting ${meeting_id}`);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-transcript error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
