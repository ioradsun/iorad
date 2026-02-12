export interface CustomerSignal {
  title: string;
  detail: string;
}

export interface QuantifiedImpactItem {
  title: string;
  assumptions: string;
  math: string;
  result: string;
}

export interface Customer {
  id: string;
  name: string;
  partner: "seismic" | "workramp" | "360learning" | "docebo" | "gainsight";
  persona: string;
  whyNow: string;
  signals: CustomerSignal[];
  friction: CustomerSignal[];
  partnerPlatform: {
    strengths: string[];
    executionGaps: string[];
  };
  embeddedIorad: {
    situation: string;
    constraint: string;
    intervention: string;
    transformation: string;
  };
  quantifiedImpact: QuantifiedImpactItem[];
  executiveNarrative: string[];
  outboundPositioning?: {
    executiveFraming?: string;
    efficiencyRevenue?: string;
    riskMitigation?: string;
  };
}

export const customers: Customer[] = [
  {
    id: "intermedia",
    name: "Intermedia",
    partner: "docebo",
    persona: "VP of Partner Enablement",
    whyNow:
      "Intermedia's rapid global expansion and introduction of complex new offerings necessitate an immediate solution for scalable, effective partner enablement. iorad provides this by operationalizing knowledge directly within their existing Docebo environment.",
    signals: [
      {
        title: "Award-winning US partner program",
        detail:
          "Intermedia has an award-winning US partner program for selling its services, indicating a mature channel strategy that now requires operational scale.",
      },
      {
        title: "European expansion underway",
        detail:
          "Intermedia is expanding its service provider program in Europe, creating demand for consistent enablement across regions and languages.",
      },
      {
        title: "UCaaS partnership with Astound",
        detail:
          "Intermedia is partnering with Astound Business Solutions to deliver UCaaS, adding complexity to partner training requirements.",
      },
      {
        title: "AI-powered comms in the UK",
        detail:
          "Intermedia is partnering with Focus Group to deliver AI-powered communication solutions in the UK, requiring rapid knowledge distribution to new markets.",
      },
    ],
    friction: [
      {
        title: "Manual content creation bottleneck",
        detail:
          "Increased demand for consistent and scalable partner training and enablement is constrained by manual content creation and updates for GTM and enablement materials.",
      },
      {
        title: "No real-time knowledge distribution",
        detail:
          "No efficient real-time mechanism exists to distribute and update standardized product knowledge and sales messaging across the partner network.",
      },
    ],
    partnerPlatform: {
      strengths: [
        "Structured course delivery and learning management",
        "Scalable global delivery of varied content",
        "Integration with other enterprise systems",
      ],
      executionGaps: [
        "Difficulty rapidly creating and updating interactive show-me-how content for complex features and processes",
        "Reliance on video and text that doesn't operationalize workflows",
        "Challenges measuring practical application of learned skills",
      ],
    },
    embeddedIorad: {
      situation:
        "Intermedia uses Docebo to train and enable its expanding global partner network on its services, including new UCaaS and AI-powered communication solutions.",
      constraint:
        "As Intermedia's partner programs and offerings expand, creation, updating, and operationalization of content becomes a bottleneck within Docebo.",
      intervention:
        "Embed iorad directly into Intermedia's Docebo instance. GTM and enablement teams instantly create interactive step-by-step guides for products and partner processes, integrated into Docebo courses and learning paths.",
      transformation:
        "Partners gain always-up-to-date interactive how-to guidance inside Docebo, accelerating time-to-competency, reducing how-to support queries, and ensuring consistent operational knowledge across regions and solutions.",
    },
    quantifiedImpact: [
      {
        title: "Partner Sales Ramp Time Reduction",
        assumptions:
          "5% reduction in ramp time · Average ramp: 3 months · 100 new partners per year · Average partner revenue: $500k/year after ramp",
        math: "0.05 × 3 months × 100 partners × ($500,000 ÷ 12) = $625,000",
        result: "$625,000 additional revenue captured per year due to faster partner ramp",
      },
      {
        title: "Support Ticket Reduction",
        assumptions:
          "20% of partner support tickets are how-to · Average cost per ticket: $50 · 5,000 partner support tickets annually",
        math: "0.20 × 5,000 × $50 = $50,000",
        result: "$50,000 annual savings from reduced how-to support volume",
      },
    ],
    executiveNarrative: [
      "Intermedia is on an aggressive global expansion trajectory with European expansion and strategic partnerships for UCaaS and AI communications. Their partner program is a cornerstone of growth but creates operational challenges in consistent, actionable training across a diverse network.",
      "Docebo manages formal learning paths effectively, but the gap is rapid creation and distribution of show-me-how content. Traditional methods become a bottleneck that impacts partner time-to-competency and sales efficiency.",
      "Embedding iorad within Docebo transforms operational guidance creation into an instantaneous interactive experience, integrated directly into courses and learning paths.",
      "Partners learn by doing — accelerating ramp and reducing how-to support queries while ensuring consistency across regions. This strengthens revenue via the channel and hardens the value of Docebo as the strategic learning platform.",
    ],
  },
];
