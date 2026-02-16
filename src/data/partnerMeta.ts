export interface PartnerMeta {
  key: string;
  label: string;
  domain: string;
  positioning: string;
  embedBullets: string[];
  color: string;
  gradient: string;
}

export const partnerMeta: Record<string, PartnerMeta> = {
  seismic: {
    key: "seismic",
    label: "Seismic",
    domain: "seismic.com",
    positioning: "Transforming sales enablement into operational execution",
    embedBullets: [
      "Interactive how-to guides embedded directly in Seismic content pages",
      "Step-by-step walkthroughs linked from enablement playbooks",
      "Live workflow guidance accessible inside sales content hubs",
    ],
    color: "#1B3A5C",
    gradient: "from-blue-900/20 to-cyan-900/10",
  },
  workramp: {
    key: "workramp",
    label: "WorkRamp",
    domain: "workramp.com",
    positioning: "Closing the gap between learning completion and workflow execution",
    embedBullets: [
      "Interactive tutorials embedded within WorkRamp learning paths",
      "Guided walkthroughs for onboarding and enablement modules",
      "Live application guidance integrated into course completions",
    ],
    color: "#4F46E5",
    gradient: "from-indigo-900/20 to-violet-900/10",
  },
  "360learning": {
    key: "360learning",
    label: "360Learning",
    domain: "360learning.com",
    positioning: "Turning collaborative learning into operational competency",
    embedBullets: [
      "Step-by-step guides embedded in collaborative courses",
      "Interactive walkthroughs for peer-authored content",
      "Workflow guidance integrated into learning reactions and paths",
    ],
    color: "#00B4D8",
    gradient: "from-cyan-900/20 to-teal-900/10",
  },
  docebo: {
    key: "docebo",
    label: "Docebo",
    domain: "docebo.com",
    positioning: "Operationalizing Docebo's learning infrastructure with execution-ready content",
    embedBullets: [
      "Interactive step-by-step guides embedded inside Docebo courses",
      "Guided walkthroughs integrated into learning paths and certifications",
      "Always-current how-to content distributed across global partner networks",
    ],
    color: "#FF6B35",
    gradient: "from-orange-900/20 to-amber-900/10",
  },
  gainsight: {
    key: "gainsight",
    label: "Gainsight",
    domain: "gainsight.com",
    positioning: "Converting customer success playbooks into self-serve execution",
    embedBullets: [
      "Interactive guides embedded within Gainsight success playbooks",
      "Step-by-step walkthroughs for customer onboarding journeys",
      "Workflow guidance integrated into health score action items",
    ],
    color: "#00C853",
    gradient: "from-emerald-900/20 to-green-900/10",
  },
};
