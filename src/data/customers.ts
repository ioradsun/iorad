export interface InitiativeItem {
  title: string;
  detail: string;
}

export interface StrategicPlay {
  name: string;
  objective: string;
  whyNow: string;
  inPractice: string;
  expectedImpact: string;
}

export interface CaseStudy {
  company: string;
  similarity: string;
  challenge: string;
  outcome: string;
  relevance: string;
}

export interface InternalSignals {
  signalTypes: string[];
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
  leadershipPriorities: string[];
  executionFriction: string[];
  leadersAsked: string[];
  pathA: string;
  pathB: string;
  costUnaddressed: string[];
  blindSpot: string;
  leveragePoints: string[];
  plays: StrategicPlay[];
  selfCheck: string[];
  caseStudies: CaseStudy[];
  whyNow: string;
  conversationStarters: string[];
  internalSignals: InternalSignals;
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
        detail: "Intermedia is expanding its partner ecosystem across Europe, with new strategic partnerships to deliver UCaaS and AI-powered communication solutions.",
      },
      {
        title: "Growing investment in enablement operations",
        detail: "Multiple enablement and training roles suggest Intermedia is building infrastructure to support a rapidly expanding partner network.",
      },
      {
        title: "Accelerating product portfolio",
        detail: "New AI-powered offerings require partners to quickly absorb and articulate new capabilities to end customers.",
      },
    ],
    leadershipPriorities: [
      "Keeping delivery consistent while scaling into new European markets",
      "Getting new partners productive in weeks, not months",
      "Making sure the Docebo investment actually drives behavior change",
      "Reducing how-to support volume without adding headcount",
    ],
    executionFriction: [
      "Process gets interpreted differently by partners in different regions.",
      "Documentation grows but isn't used in the moment when partners need it.",
      "Adoption spikes after training, then drops within weeks.",
      "Support volume doesn't decline as expected after rollout.",
      "New partners rely heavily on shadowing and live screenshares.",
    ],
    leadersAsked: [
      "Why isn't adoption higher after we invested in Docebo?",
      "Why are we still getting repeat how-to questions from partners?",
      "How fast can new partners operate independently?",
      "Are partners in Europe following the same process as US partners?",
    ],
    pathA: "Training increases. Documentation expands. Adoption rises briefly, then levels off. Support absorbs the friction. Enablement team becomes a bottleneck.",
    pathB: "Reinforcement becomes part of the daily workflow inside Docebo. Partners learn by doing inside the system. Adoption sustains without adding headcount.",
    costUnaddressed: [
      "Slower partner time-to-productivity across new markets",
      "Higher support ticket volume from repetitive how-to questions",
      "Internal rework as enablement teams manually update and redistribute content",
      "Partner inconsistency across regions and product lines",
      "Margin pressure as enablement costs scale linearly with partner growth",
    ],
    blindSpot: "Most companies treat adoption as a training issue. In reality, it's a reinforcement issue. Training explains. Reinforcement makes it stick. Without reinforcement built into daily workflow, adoption fades and support carries the load.",
    leveragePoints: [
      "Reduce process variance across partner regions",
      "Turn static Docebo content into in-the-moment guidance",
      "Shorten partner time-to-proficiency from months to weeks",
      "Make workflow updates easier to distribute across the network",
      "Scale knowledge without hiring more enablement trainers",
    ],
    plays: [
      {
        name: "Partner Onboarding Accelerator",
        objective: "Cut new partner ramp time by embedding step-by-step process guidance directly into Docebo learning paths.",
        whyNow: "European expansion is bringing new partner cohorts online who need to be productive quickly without live screenshare sessions.",
        inPractice: "Replace static training modules with interactive walkthroughs that partners complete inside the actual tools they'll use daily. Measure completion and time-to-first-deal.",
        expectedImpact: "Faster partner ramp. Fewer onboarding support tickets. Consistent execution across regions.",
      },
      {
        name: "Support Deflection Through Process Reinforcement",
        objective: "Reduce repetitive how-to support tickets by giving partners self-service process guidance at the point of need.",
        whyNow: "Every new product launch and partner cohort multiplies the support burden without reinforcement in place.",
        inPractice: "Identify the top 10 how-to support topics. Build interactive walkthroughs for each. Embed them inside Docebo and link from support workflows.",
        expectedImpact: "Measurable reduction in how-to ticket volume. Support team freed up for complex issues.",
      },
    ],
    selfCheck: [
      "Are new partners fully productive within 30 days?",
      "Has support volume dropped after your last product rollout?",
      "Do partners in Europe execute workflows the same way as US partners?",
      "When processes change, does partner behavior change immediately?",
    ],
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
    whyNow: "The earlier reinforcement is built into workflow, the easier it is to scale cleanly. Waiting usually means more retrofitting later — and every new partner cohort or product launch compounds the gap.",
    conversationStarters: [
      "As you scale your partner enablement function globally, how are you reinforcing process adoption after initial training?",
      "During platform rollouts, what mechanisms are in place to ensure workflow recall weeks after go-live?",
      "How are you thinking about support deflection as your partner network expands?",
    ],
    internalSignals: {
      signalTypes: ["hiring_enablement", "platform_rollout", "geographic_expansion", "product_launch"],
      hiringIntensity: "Multiple enablement and training roles open simultaneously",
      platformRollout: "Docebo as primary LMS with expansion into new markets",
      confidenceLevel: "High",
      urgency: "High Momentum",
      primaryPersona: "VP of Partner Enablement",
    },
  },
];
