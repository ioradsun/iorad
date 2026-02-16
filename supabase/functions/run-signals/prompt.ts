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

  // If a custom prompt template is stored, use it with placeholder substitution
  if (promptTemplate && promptTemplate.trim()) {
    const filled = promptTemplate
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{industry\}\}/g, industry)
      .replace(/\{\{partner_platform\}\}/g, partnerPlatform)
      .replace(/\{\{compelling_events\}\}/g, compellingEvents.map((e, i) => `${i + 1}. ${e}`).join("\n"))
      .replace(/\{\{signals\}\}/g, signalSummary);

    return `${systemPrompt}\n\n${filled}`;
  }

  // ABM Conversion Microsite Mega Prompt
  return `${systemPrompt}

ROLE:
You are an elite enterprise strategy analyst creating a personalized executive insight brief.
Your goal is to produce a short, persuasive, value-driven account insight page that:
- Demonstrates we understand the company's current initiatives
- Identifies operational opportunity areas
- Connects those initiatives to adoption risk and execution gaps
- Suggests how iorad can help
- Feels thoughtful, not invasive

You must:
- Use only verifiable public information
- Avoid referencing scraping or monitoring
- Avoid stating exact job counts unless appropriate
- Avoid appearing overly specific in a way that feels intrusive

Tone: Strategic, consultative, helpful. Not salesy.

INPUT:
Company: "${companyName}" (${industry} industry)
Partner Platform: ${partnerPlatform}

SIGNALS DETECTED:
${signalSummary}

SIGNAL LOGIC:
Hiring Signals: Enablement, L&D, instructional design, digital adoption, change management, onboarding, academy, support operations.
Platform Rollout Signals: Migration, implementation, transformation, replatforming, launch, deployment, global standardization.
Support Burden Signals: Self-service expansion, knowledge base growth, support volume, customer onboarding friction.
Hiring Surge Signals: 3+ related roles within 60 days, cross-functional expansion.

STYLE REQUIREMENTS:
- Tone: Strategic, executive-level, no hype, no buzzwords
- Length: 800-1200 words total across all sections
- Structure: Clear sections, short paragraphs, skimmable, value-first

DO NOT:
- State exact counts unless appropriate
- Say "We saw on LinkedIn…"
- Mention scraping
- Over-specify job descriptions
- Accuse company of problems
- Say "You are struggling with…"
- Frame everything as: "When organizations invest in X, Y often follows."

Return ONLY valid JSON with this exact structure:

{
  "score_total": <0-100>,
  "score_breakdown": {"hiring": <0-30>, "news": <0-40>, "expansion": <0-30>},

  "whats_happening": [
    {"title": "<initiative theme>", "detail": "<1-2 sentences using soft language like 'It appears {company} is investing in...' — summarize the initiative without being invasive>"}
  ],

  "execution_friction": [
    "<educational pattern statement — e.g. 'Knowledge gets trapped in slide decks', 'Adoption lags post-launch', 'Ticket volume spikes after rollout' — frame as common risks when companies experience these types of initiatives, NOT accusations>"
  ],

  "opportunity_areas": [
    {"title": "<use case area>", "detail": "<1-2 sentences connecting the detected signal to a potential value area — keep high-level but relevant>"}
  ],

  "how_iorad_helps": [
    {"title": "<outcome-focused title>", "detail": "<1-2 sentences connecting to business outcomes: speed, scalability, reinforcement, operational memory — avoid product feature dumping>"}
  ],

  "conversation_starters": [
    "<tailored discussion prompt that feels intelligent and specific — e.g. 'As you scale your enablement function, how are you reinforcing process adoption after initial training?'>"
  ],

  "internal_signals": {
    "signal_types": ["<detected signal type>"],
    "confidence_level": "<High|Medium|Low>",
    "urgency": "<Emerging|Active|High Momentum>",
    "primary_persona": "<primary persona impacted>"
  },

  "evidence": [{"signal_type": "<type>", "detail": "<finding>", "url": "<url>"}]
}`;
}
