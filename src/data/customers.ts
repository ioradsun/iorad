export interface InitiativeItem {
  title: string;
  detail: string;
}

export interface StrategicPlay {
  name: string;
  objective: string;
  whyNow: string;
  whatItLooksLike: string;
  expectedImpact: string;
}

export interface CaseStudy {
  company: string;
  similarity: string;
  challenge: string;
  outcome: string;
  relevance: string;
}

export interface EnterpriseSystem {
  system: string;
  risk: string;
}

export interface InternalSignals {
  signalTypes: string[];
  enterpriseSystems?: EnterpriseSystem[];
  operationalRisks?: string[];
  hiringIntensity?: string;
  platformRollout?: string;
  confidenceLevel: "High" | "Medium" | "Low";
  urgency: "Emerging" | "Active" | "High Momentum";
  primaryPersona: string;
}

export interface Customer {
  id: string;
  name: string;
  domain?: string;
  contactName?: string;
  partner: "seismic" | "workramp" | "360learning" | "docebo" | "gainsight";
  persona: string;
  whatsHappening: InitiativeItem[];
  functionalImplications: string;
  executionFriction: string[];
  accountabilityPressure: string[];
  realCost: string[];
  blindSpot: string;
  plays: StrategicPlay[];
  reinforcementJourney: string;
  reinforcementPreview?: {
    detectedTool: string;
    libraryUrl: string | null;
    description: string;
  };
  caseStudies: CaseStudy[];
  whyNow: string;
  cta?: string;
  openingHook?: { subjectLine: string; openingParagraph: string };
  conversationStarters: string[];
  internalSignals: InternalSignals;
  /** Free-form text overrides keyed by path */
  overrides?: Record<string, string>;

  // Legacy fields for backward compatibility
  leadershipPriorities?: string[];
  leadersAsked?: string[];
  pathA?: string;
  pathB?: string;
  costUnaddressed?: string[];
  leveragePoints?: string[];
  selfCheck?: string[];
}

export const customers: Customer[] = [
  {
    id: "intermedia",
    name: "Intermedia",
    domain: "intermedia.com",
    partner: "docebo",
    persona: "VP of Partner Enablement",
    whatsHappening: [
      {
        title: "Scaling global partner enablement",
        detail: "Intermedia is expanding its partner ecosystem across Europe, with new strategic partnerships to deliver UCaaS and AI-powered communication solutions. This creates immediate pressure on the enablement function to deliver consistent execution across geographies.",
      },
      {
        title: "Growing investment in enablement operations",
        detail: "Multiple enablement and training roles suggest Intermedia is building infrastructure to support a rapidly expanding partner network. The question isn't whether enablement is a priority — it's whether the current approach will hold at scale.",
      },
      {
        title: "Accelerating product portfolio",
        detail: "New AI-powered offerings require partners to quickly absorb and articulate new capabilities to end customers. Every product launch multiplies the knowledge burden on partners who are already onboarding.",
      },
    ],
    functionalImplications: "Intermedia's partner enablement function is carrying an expanding mandate — more partners, more markets, more product complexity — without a proportional increase in capacity. Leadership expects the Docebo investment to deliver measurable ROI within 12–24 months, but platform rollout alone doesn't guarantee that partners execute consistently in their daily workflows.\n\nThe real question isn't 'Did partners complete training?' It's 'Are partners executing correctly inside the systems they use every day?' When the answer is unclear, it creates a gap between platform investment and operational outcomes that becomes harder to close over time.",
    executionFriction: [
      "Partners complete Docebo courses but struggle with process recall inside CRM and communication tools during real customer interactions.",
      "Process gets interpreted differently by partners in different regions, creating inconsistency that's hard to detect until it surfaces in support tickets.",
      "Documentation grows but isn't accessed at the moment partners actually need it — it sits in a portal, not inside the workflow.",
      "Adoption spikes after training events, then drops within weeks as partners revert to familiar habits.",
      "New partners rely heavily on shadowing and live screenshares, creating a bottleneck for the enablement team.",
    ],
    accountabilityPressure: [
      "We invested in Docebo. Why isn't partner adoption sustaining after the first 30 days?",
      "We're hiring enablement headcount. Why are we still getting repeat how-to questions from partners?",
      "Partners in Europe are following a different process than US partners. How did that happen?",
      "We launched three products this year. Can you show me that partners can actually demo them correctly?",
    ],
    realCost: [
      "Slower partner time-to-productivity across new markets",
      "Higher support ticket volume from repetitive how-to questions",
      "Internal rework as enablement teams manually update and redistribute content",
      "Partner inconsistency across regions and product lines",
      "Margin pressure as enablement costs scale linearly with partner growth",
    ],
    blindSpot: "Most companies treat adoption as a training event. In reality, adoption is an execution discipline. Training explains how a system works. Reinforcement ensures it is used correctly during real work. Without reinforcement built into daily workflow, adoption fades and support carries the load.",
    plays: [
      {
        name: "Partner Onboarding Accelerator",
        objective: "Cut new partner ramp time by embedding step-by-step process guidance directly into Docebo learning paths.",
        whyNow: "European expansion is bringing new partner cohorts online who need to be productive quickly without live screenshare sessions.",
        whatItLooksLike: "Replace static training modules with interactive walkthroughs that partners complete inside the actual tools they'll use daily. Measure completion and time-to-first-deal.",
        expectedImpact: "Faster partner ramp. Fewer onboarding support tickets. Consistent execution across regions.",
      },
      {
        name: "Support Deflection Through Process Reinforcement",
        objective: "Reduce repetitive how-to support tickets by giving partners self-service process guidance at the point of need.",
        whyNow: "Every new product launch and partner cohort multiplies the support burden without reinforcement in place.",
        whatItLooksLike: "Identify the top 10 how-to support topics. Build interactive walkthroughs for each. Embed them inside Docebo and link from support workflows.",
        expectedImpact: "Measurable reduction in how-to ticket volume. Support team freed up for complex issues.",
      },
      {
        name: "CRM Execution Consistency Play",
        objective: "Ensure partners follow the same CRM process regardless of region or tenure.",
        whyNow: "Regional expansion means CRM usage patterns are diverging, creating forecast and pipeline inconsistency.",
        whatItLooksLike: "Map the critical CRM workflows partners must execute. Build step-by-step reinforcement for each. Deploy across all partner regions with completion tracking.",
        expectedImpact: "Reduced process variance. More accurate pipeline data. Fewer escalations from CRM misuse.",
      },
      {
        name: "Product Launch Readiness Sprint",
        objective: "Ensure new product launches translate into partner execution, not just awareness.",
        whyNow: "AI-powered product launches are accelerating and partners need to articulate capabilities accurately to end customers.",
        whatItLooksLike: "For each product launch, create interactive simulations that walk partners through the demo flow, key objection handling, and CRM logging — all inside the actual tools.",
        expectedImpact: "Partners demo correctly from day one. Fewer post-launch support escalations. Faster revenue from new products.",
      },
    ],
    reinforcementJourney: "If reinforcement were embedded into the learner journey at Intermedia, it would feel less like additional training and more like the system guiding partners through the correct process at the moment it matters.\n\nInstead of completing a Docebo course and then switching to a CRM with no guidance, partners would see interactive step-by-step walkthroughs appear inside the actual tools they use — Docebo, CRM, communication platforms. Each walkthrough would replace a static PDF or help article with a guided simulation that confirms correct execution.\n\nThis type of embedded reinforcement — where guidance lives inside the workflow, not beside it — is what platforms like iorad are specifically built for. The result is that training investments compound instead of fade.",
    caseStudies: [
      {
        company: "Pax8",
        similarity: "Large partner ecosystem requiring consistent enablement across geographies.",
        challenge: "Partners completed training but struggled with process recall in day-to-day operations.",
        outcome: "Embedded reinforcement reduced onboarding friction and improved partner consistency.",
        relevance: "Intermedia faces the same pattern — mature partner program scaling into new markets with increasing complexity.",
      },
      {
        company: "Border States",
        similarity: "Multi-location organization rolling out new systems across distributed teams.",
        challenge: "Adoption dropped off after initial training as teams reverted to old workflows.",
        outcome: "In-workflow guidance sustained adoption without requiring retraining cycles.",
        relevance: "Intermedia's European expansion creates the same dynamic — distributed teams needing consistent execution without constant hand-holding.",
      },
    ],
    whyNow: "The earlier reinforcement is built into workflow, the easier it is to scale cleanly. Every new partner cohort and product launch compounds the gap between training completion and actual execution. With European expansion underway and executive scrutiny on Docebo ROI, the window to build reinforcement into the system — rather than retrofit it later — is now.",
    conversationStarters: [
      "As you scale your partner enablement function globally, how are you reinforcing process adoption after initial training?",
      "During platform rollouts, what mechanisms are in place to ensure workflow recall weeks after go-live?",
      "How are you thinking about support deflection as your partner network expands?",
    ],
    internalSignals: {
      signalTypes: ["hiring_enablement", "platform_rollout", "geographic_expansion", "product_launch"],
      enterpriseSystems: [
        { system: "Docebo (LMS)", risk: "Training completion without behavior change; ROI pressure on platform investment" },
        { system: "CRM", risk: "Process variance across partner regions; forecast and pipeline inaccuracy" },
      ],
      operationalRisks: [
        "Partner inconsistency across regions as network scales",
        "Support volume growth proportional to partner count",
        "Enablement team becoming a bottleneck for partner ramp",
      ],
      hiringIntensity: "Multiple enablement and training roles open simultaneously",
      platformRollout: "Docebo as primary LMS with expansion into new markets",
      confidenceLevel: "High",
      urgency: "High Momentum",
      primaryPersona: "VP of Partner Enablement",
    },
  },
];
