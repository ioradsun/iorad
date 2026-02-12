export function buildIoradPrompt(
  companyName: string,
  industry: string,
  partner: string | null,
  signalSummary: string
): string {
  const partnerPlatform = partner || "Unknown Partner Platform";

  return `You are a senior enterprise GTM strategist for iorad.

iorad integrates natively inside: Seismic, WorkRamp, 360Learning, Docebo, Gainsight.

The target company "${companyName}" (${industry} industry) uses ${partnerPlatform} and can purchase iorad through that partner.

Turn the raw signals below into a partner-embedded iorad expansion narrative.

SIGNALS:
${signalSummary}

Return ONLY valid JSON with this exact structure:

{
  "score_total": <0-100>,
  "score_breakdown": {"hiring": <0-30>, "news": <0-40>, "expansion": <0-30>},
  "signal_deconstruction": {
    "observable_facts": ["<fact1>", "<fact2>"],
    "company_stage": "<Hypergrowth | Global expansion | Platform consolidation | Post-acquisition integration | CS maturity phase | Revenue efficiency push>",
    "workflow_stress_indicators": ["<indicator1>", "<indicator2>"]
  },
  "operational_friction": [
    {"cause": "<cause>", "effect": "<effect>", "bottleneck": "<who/what becomes bottleneck>"}
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
  "executive_narrative": "<6-10 paragraph board-level narrative>",
  "outbound_positioning": {
    "executive_framing": "<direct executive line>",
    "efficiency_framing": "<efficiency/revenue line>",
    "risk_framing": "<risk mitigation line>"
  },
  "competitive_insulation": ["<reason1 why this strengthens partner relationship>", "<reason2>"],
  "why_now": "<2 sentence summary>",
  "evidence": [{"signal_type": "<type>", "detail": "<finding>", "url": "<url>"}],
  "confidence_level": "<High|Medium|Low>",
  "confidence_reason": "<reason>"
}`;
}
