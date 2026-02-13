export function buildIoradPrompt(
  companyName: string,
  industry: string,
  partner: string | null,
  signalSummary: string,
  systemPrompt: string,
  compellingEvents: string[],
  promptTemplate?: string
): string {
  const partnerPlatform = partner || "Unknown Partner Platform";
  const eventsBlock = compellingEvents.map((e, i) => `${i + 1}. ${e}`).join("\n");

  // If a custom prompt template is stored, use it with placeholder substitution
  if (promptTemplate && promptTemplate.trim()) {
    const filled = promptTemplate
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{industry\}\}/g, industry)
      .replace(/\{\{partner_platform\}\}/g, partnerPlatform)
      .replace(/\{\{compelling_events\}\}/g, eventsBlock)
      .replace(/\{\{signals\}\}/g, signalSummary);

    return `${systemPrompt}\n\n${filled}`;
  }

  // Fallback hardcoded template
  return `${systemPrompt}

The target company "${companyName}" (${industry} industry) uses ${partnerPlatform}.

We have a signal engine from real demo calls that maps compelling events to buyer intent.

COMPELLING EVENT TAXONOMY:
${eventsBlock}

META-PATTERNS (the underlying truth behind every compelling event):
1. Rolled something out and adoption is weak
2. About to roll something out and want to avoid chaos
3. Drowning in repeat questions / manual training

SIGNALS:
${signalSummary}

Return ONLY valid JSON with this exact structure:

{
  "score_total": <0-100>,
  "score_breakdown": {"hiring": <0-30>, "news": <0-40>, "expansion": <0-30>},

  "signals": [
    {"title": "<observable fact>", "detail": "<1-2 sentence elaboration>"}
  ],

  "compelling_events": {
    "matched": ["<event from taxonomy>"],
    "buyer_language": ["<1-2 lines of what the buyer would say on a call>"]
  },

  "meta_pattern": {
    "type": "<adoption weak after rollout | avoiding chaos before rollout | drowning in repeat questions/manual training>",
    "description": "<2-3 sentences describing the operational failure mode>"
  },

  "operational_friction": [
    {"title": "<cause>", "detail": "<effect and who/what becomes bottleneck>"}
  ],

  "partner_platform_ceiling": {
    "platform_strengths": ["<strength1>", "<strength2>"],
    "execution_gaps": ["<gap1>", "<gap2>"],
    "key_insight": "<The partner organizes knowledge. iorad operationalizes knowledge.>"
  },

  "embedded_leverage": {
    "situation": "<How the company currently uses the partner platform>",
    "constraint": "<Where the system breaks under scale>",
    "intervention": "<How iorad embeds inside the partner platform>",
    "transformation": "<What changes operationally>"
  },

  "quantified_impact": [
    {"metric": "<e.g. Sales Ramp>", "assumptions": "<conservative assumptions>", "calculation": "<show math>", "result": "<outcome>"}
  ],

  "executive_narrative": ["<paragraph1>", "<paragraph2>", "<paragraph3>", "<paragraph4>"],

  "outbound_positioning": {
    "executive_framing": "<direct executive line>",
    "efficiency_framing": "<efficiency/revenue line>",
    "risk_framing": "<risk mitigation line>"
  },

  "competitive_insulation": ["<reason1>", "<reason2>"],
  "why_now": "<2 sentence summary>",
  "evidence": [{"signal_type": "<type>", "detail": "<finding>", "url": "<url>"}],
  "confidence_level": "<High|Medium|Low>",
  "confidence_reason": "<reason>"
}`;
}
