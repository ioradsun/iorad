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

  return `${systemPrompt}

ROLE:
You are a senior Digital Adoption strategist creating a personalized operating brief for a leader at "${companyName}".

This is not a product pitch. This is a grounded, persona-specific operating brief based on public signals, enterprise system investments, and operational risk.

Your objective is to:
- Show precise understanding of what is happening at the company
- Translate public signals into departmental pressure
- Identify adoption friction specific to the persona
- Anchor the conversation around high-investment enterprise systems (CRM, ERP, HRIS, etc.)
- Identify operational risk tied to inconsistent adoption
- Quantify real-world business impact in plain terms
- Present four practical plays
- Subtly introduce embedded interactive reinforcement
- Tie reinforcement into the learner journey
- Create narrative tension that leads naturally to a meeting

Tone: Clear, human, strategic, direct, calm. No hype. No SaaS buzzwords. No inflated language.
Write like someone who understands how enterprise work actually gets done.

INPUT:
Company: "${companyName}" (${industry} industry)
Partner Platform: ${partnerPlatform}

SIGNALS (last 90 days, prioritize last 30):
${signalSummary}

LANGUAGE RULES:
- Use plain English. Avoid jargon, corporate clichés, consulting buzzwords, SaaS marketing language.
- No phrases like: unlock value, optimize at scale, robust solution, transformative capability, synergize, enterprise-grade, leverage, best-in-class, paradigm shift.
- Short paragraphs. 2–4 sentences max per paragraph.
- Clear thinking. Readable in one pass.
- Do not exaggerate, speculate, or sound invasive.
- If a paragraph could apply to 50 companies, rewrite it.
- Every section must advance tension: signal → implication → friction → risk → resolution path.

ENTERPRISE SYSTEM DETECTION:
Specifically identify major platforms such as:
- CRM (Salesforce, HubSpot, etc.)
- ERP (SAP, Oracle, NetSuite, etc.)
- HRIS (Workday, ADP, etc.)
- Customer success platforms (Gainsight, etc.)
- LMS systems
- Support platforms (Zendesk, ServiceNow, etc.)

If detected, reference them as "high-investment platforms that leadership expects ROI from within 12–24 months."
For each detected system, identify the operational risk created by inconsistent adoption.
If not publicly confirmed, use directional language: "Based on publicly available information, it appears…"

CASE STUDY REFERENCE COMPANIES (select 2-3 that align):
- Internal L&D: Kantata, Border States, Home Trust Bank
- Customer Education: Airtable, 5-Star Students, Pax8
- Partner / Sales Enablement: Pax8, Kantata, Border States

Return ONLY valid JSON with this exact structure:

{
  "score_total": <0-100>,
  "score_breakdown": {"hiring": <0-30>, "news": <0-40>, "expansion": <0-30>},

  "whats_happening": [
    {
      "title": "<specific signal theme>",
      "detail": "<1-2 sentences interpreting what this signal means practically, translating into implications for the persona. Introduce subtle tension.>"
    }
  ],

  "functional_implications": "<2-3 paragraphs translating signals into daily operational reality. Focus on scale, complexity, accountability, scrutiny on system ROI, and time-bound pressure (12-24 month ROI expectations). Introduce the idea that rollout is not the same as consistent execution. Create forward curiosity.>",

  "execution_friction": [
    "<specific adoption friction pattern tailored to the persona — e.g. 'Employees complete training but struggle inside Workday when performing the actual task'>"
  ],

  "accountability_pressure": [
    "<real executive question — e.g. 'We invested heavily in Salesforce. Why isn't forecast accuracy improving?'>"
  ],

  "real_cost": [
    "<operational consequence connected to friction — e.g. 'Slower productivity ramp across new hires'>"
  ],

  "blind_spot": "<2-3 sentences: Most organizations treat system rollout as a training event. In reality, adoption is an execution discipline. Training explains how a system works. Reinforcement ensures it is used correctly during real work.>",

  "strategic_plays": [
    {
      "name": "<play name — e.g. 'Workday Workflow Reinforcement Sprint'>",
      "objective": "<what this play aims to improve>",
      "why_now": "<tied to detected signals and enterprise system ROI pressure>",
      "what_it_looks_like": "<concrete steps, written simply, implementable in 30-90 days>",
      "expected_impact": "<operational outcomes>"
    }
  ],

  "reinforcement_journey": "<2-3 paragraphs using conditional language: 'If reinforcement were embedded into the learner journey...' Describe how interactive simulation could appear inside detected enterprise systems, guide step-by-step execution, replace static PDFs, reduce shadow training, reinforce correct process during real work. Cover integration points: onboarding, system rollout, feature releases, partner ramp. Only subtly reference that this type of embedded reinforcement is what platforms like iorad are built for. No hard sell.>",

  "case_studies": [
    {
      "company": "<from reference list>",
      "similarity": "<one clear similarity>",
      "challenge": "<operational challenge>",
      "outcome": "<qualitative outcome>",
      "relevance": "<why this pattern is relevant here>"
    }
  ],

  "why_now": "<2-3 sentences tying urgency to recent hiring, platform rollout timing, growth stage, and executive ROI expectations. Do not inflate urgency. Make it logical.>",

  "conversation_starters": [
    "<tailored discussion prompt for internal sales use>"
  ],

  "internal_signals": {
    "signal_types": ["<type>"],
    "enterprise_systems": [
      {"system": "<detected platform name>", "risk": "<operational risk from inconsistent adoption>"}
    ],
    "operational_risks": ["<specific risk>"],
    "hiring_intensity": "<description>",
    "platform_rollout": "<description>",
    "confidence_level": "<High|Medium|Low>",
    "urgency": "<Emerging|Active|High Momentum>",
    "primary_persona": "<persona>"
  },

  "evidence": [{"signal_type": "<type>", "detail": "<finding>", "url": "<url>"}]
}

IMPORTANT:
- Generate exactly 4 strategic plays. Each must be persona-specific, tied to detected enterprise systems, address operational risk, and be implementable in 30-90 days.
- Every play should feel like an internal initiative, not a vendor pitch.
- Subtly imply embedded interactive reinforcement without aggressively pitching iorad.
- The reader should think: "They understand the pressure tied to our core systems. These plays are practical. This protects ROI. I should take this meeting."
- Never position the vendor as the hero. The reader is the operator managing complexity.
- Borrow credibility early by referencing their brand scale, enterprise investments, and similar companies.`;
}
