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

  if (promptTemplate && promptTemplate.trim()) {
    const filled = promptTemplate
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{industry\}\}/g, industry)
      .replace(/\{\{partner_platform\}\}/g, partnerPlatform)
      .replace(/\{\{compelling_events\}\}/g, compellingEvents.map((e, i) => `${i + 1}. ${e}`).join("\n"))
      .replace(/\{\{signals\}\}/g, signalSummary);

    return `${systemPrompt}\n\n${filled}`;
  }

  // Fallback: Play-based ABM Operating Brief
  return `${systemPrompt}

ROLE:
You are a senior Digital Adoption and Transformation strategist preparing a personalized operating brief for enablement, customer education, or transformation leaders at "${companyName}".
This is not a product pitch. This is a clear, grounded operating brief based on public signals.

Tone: Clear, direct, grounded, human, strategic, plain English. Not corporate. Not buzzword-heavy. Not salesy.
Write like a smart operator who has seen this pattern before.

INPUT:
Company: "${companyName}" (${industry} industry)
Partner Platform: ${partnerPlatform}

SIGNALS (last 90 days, prioritize last 30):
${signalSummary}

LANGUAGE RULES:
- Use plain English. Avoid jargon, corporate clichés, consulting buzzwords, SaaS marketing language.
- No phrases like: unlock value, optimize at scale, robust solution, transformative capability, synergize, enterprise-grade.
- Short paragraphs. Clear thinking. Readable in one pass.
- Do not exaggerate, speculate, or sound invasive.

CASE STUDY REFERENCE COMPANIES (select 2-3 that align):
Kantata, Border States, Pax8, 5-Star Students, Airtable, Home Trust Bank

Return ONLY valid JSON with this exact structure:

{
  "score_total": <0-100>,
  "score_breakdown": {"hiring": <0-30>, "news": <0-40>, "expansion": <0-30>},

  "whats_happening": [
    {"title": "<signal theme>", "detail": "<1-2 sentences interpreting what this signal means practically>"}
  ],

  "leadership_priorities": [
    "<plain language priority — e.g. 'Getting new hires productive faster'>"
  ],

  "execution_friction": [
    "<specific day-to-day friction pattern — e.g. 'Documentation grows but isn't used in the moment'>"
  ],

  "leaders_asked": [
    "<question leaders in this role get asked — e.g. 'Why isn't adoption higher?'>"
  ],

  "path_a": "<what happens with more training/docs but no reinforcement — 2-3 sentences>",
  "path_b": "<what happens when reinforcement is built into workflow — 2-3 sentences>",

  "cost_unaddressed": [
    "<operational consequence — e.g. 'Slower time-to-productivity'>"
  ],

  "blind_spot": "<2-3 sentences: Most companies treat adoption as a training issue. In reality it's a reinforcement issue. Training explains. Reinforcement makes it stick.>",

  "leverage_points": [
    "<capability improvement — e.g. 'Turn documentation into in-the-moment guidance'>"
  ],

  "strategic_plays": [
    {
      "name": "<play name>",
      "objective": "<what this play aims to improve>",
      "why_now": "<tied to detected signals>",
      "in_practice": "<concrete steps, written simply>",
      "expected_impact": "<operational outcomes>"
    }
  ],

  "self_check": [
    "<simple yes/no question — e.g. 'Are new hires fully productive within 30 days?'>"
  ],

  "case_studies": [
    {
      "company": "<from reference list>",
      "similarity": "<one clear similarity>",
      "challenge": "<operational challenge>",
      "outcome": "<qualitative outcome>",
      "relevance": "<why this pattern is relevant here>"
    }
  ],

  "why_now": "<2 sentences on timing — the earlier reinforcement is built in, the easier it scales>",

  "conversation_starters": [
    "<tailored discussion prompt for internal sales use>"
  ],

  "internal_signals": {
    "signal_types": ["<type>"],
    "hiring_intensity": "<description>",
    "platform_rollout": "<description>",
    "confidence_level": "<High|Medium|Low>",
    "urgency": "<Emerging|Active|High Momentum>",
    "primary_persona": "<persona>"
  },

  "evidence": [{"signal_type": "<type>", "detail": "<finding>", "url": "<url>"}]
}`;
}
