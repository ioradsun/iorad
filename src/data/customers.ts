export interface InitiativeItem {
  title: string;
  detail: string;
}

export interface InternalSignals {
  signalTypes: string[];
  confidenceLevel: "High" | "Medium" | "Low";
  urgency: "Emerging" | "Active" | "High Momentum";
  primaryPersona: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  partner: "seismic" | "workramp" | "360learning" | "docebo" | "gainsight";
  persona: string;
  whatsHappening: InitiativeItem[];
  executionFriction: string[];
  opportunityAreas: InitiativeItem[];
  howIoradHelps: InitiativeItem[];
  conversationStarters: string[];
  internalSignals: InternalSignals;
}

export const customers: Customer[] = [
  {
    id: "intermedia",
    name: "Intermedia",
    partner: "docebo",
    persona: "VP of Partner Enablement",
    whatsHappening: [
      {
        title: "Scaling global partner enablement",
        detail:
          "It appears Intermedia is investing significantly in expanding its partner ecosystem across Europe, with new strategic partnerships designed to deliver UCaaS and AI-powered communication solutions to new markets.",
      },
      {
        title: "Growing focus on enablement operations",
        detail:
          "We noticed a growing emphasis on enablement and training operations, suggesting Intermedia is building the infrastructure to support a rapidly expanding partner network at scale.",
      },
      {
        title: "Accelerating product innovation",
        detail:
          "Intermedia continues to broaden its product portfolio with AI-powered offerings, creating the need for partners to quickly absorb and articulate new capabilities to end customers.",
      },
    ],
    executionFriction: [
      "Knowledge gets trapped in slide decks and live screenshare sessions that don't scale across time zones.",
      "Adoption lags post-launch because partners complete training but struggle with process recall weeks later.",
      "New product releases create content bottlenecks — enablement teams can't update materials as fast as products evolve.",
      "Ticket volume spikes after rollout as partners default to support channels for how-to questions.",
    ],
    opportunityAreas: [
      {
        title: "Reinforcing platform adoption post-training",
        detail:
          "Ensure partners retain and apply what they learned during onboarding by embedding process reinforcement directly into their daily workflows.",
      },
      {
        title: "Accelerating time to productivity for new partners",
        detail:
          "Reduce the ramp time for new partner cohorts entering European and global markets with interactive, self-service guidance.",
      },
      {
        title: "Scaling customer academy content",
        detail:
          "Transform static training materials into interactive walkthroughs that can be updated in minutes, not weeks.",
      },
      {
        title: "Reducing support ticket volume",
        detail:
          "Deflect repetitive how-to questions by providing in-context guidance before partners need to open a ticket.",
      },
    ],
    howIoradHelps: [
      {
        title: "Process reinforcement at the point of work",
        detail:
          "iorad embeds interactive step-by-step walkthroughs directly inside the tools partners already use, reinforcing process recall without pulling them away from their workflow.",
      },
      {
        title: "Scalable documentation that updates in minutes",
        detail:
          "When products or processes change, iorad tutorials can be regenerated instantly — no more waiting weeks for updated training content.",
      },
      {
        title: "Adoption beyond initial training",
        detail:
          "Instead of one-and-done training sessions, iorad provides ongoing operational memory that partners can access whenever they need it.",
      },
      {
        title: "Embedded learning inside existing systems",
        detail:
          "iorad integrates directly into Docebo courses and learning paths, adding an interactive execution layer without requiring partners to learn a new tool.",
      },
    ],
    conversationStarters: [
      "As you scale your partner enablement function globally, how are you reinforcing process adoption after initial training?",
      "During platform rollouts, what mechanisms are in place to ensure workflow recall weeks after go-live?",
      "How are you thinking about support deflection as your partner network expands into new markets?",
    ],
    internalSignals: {
      signalTypes: ["hiring_enablement", "platform_rollout", "geographic_expansion", "product_launch"],
      confidenceLevel: "High",
      urgency: "High Momentum",
      primaryPersona: "VP of Partner Enablement",
    },
  },
];
