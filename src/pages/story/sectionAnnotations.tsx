import SectionAnnotation from "./SectionAnnotation";
import LibraryPicker from "./LibraryPicker";
import { useStoryDebug } from "./StoryDebugContext";

/**
 * Pre-built annotation configs for each story section.
 * Uses the StoryDebugContext to access snapshot data.
 */

interface SectionAnnotationConfig {
  sectionKey: string;
  sectionLabel: string;
  jsonFields: string[];
  getDetections?: (json: Record<string, any>, signals: any[]) => { label: string; value: string; status: "found" | "missing" | "inferred" }[];
  getReasoning?: (json: Record<string, any>, signals: any[]) => string | undefined;
  getMatchedSignals?: (signals: any[]) => { type: string; title: string; url: string }[];
  hasContent: (json: Record<string, any>) => boolean;
}

const sectionConfigs: Record<string, SectionAnnotationConfig> = {
  whatsHappening: {
    sectionKey: "whatsHappening",
    sectionLabel: "What's Happening",
    jsonFields: ["whats_happening"],
    hasContent: (json) => (json.whats_happening || []).length > 0,
    getMatchedSignals: (signals) => (signals || []).slice(0, 5).map((s) => ({ type: s.type, title: s.title, url: s.url })),
    getReasoning: (json, signals) => {
      if (!signals || signals.length === 0) return "No signals were found for this company. The AI had no external data to work with.";
      if ((json.whats_happening || []).length === 0) return "Signals were available but the AI didn't generate content for this section.";
      return undefined;
    },
  },
  functionalImplications: {
    sectionKey: "functionalImplications",
    sectionLabel: "Functional Implications",
    jsonFields: ["functional_implications"],
    hasContent: (json) => !!json.functional_implications,
    getReasoning: (json) => {
      if (!json.functional_implications) return "The AI didn't generate functional implications. This may indicate insufficient signal data to make persona-specific inferences.";
      return undefined;
    },
  },
  executionFriction: {
    sectionKey: "executionFriction",
    sectionLabel: "Execution Friction",
    jsonFields: ["execution_friction"],
    hasContent: (json) => (json.execution_friction || []).length > 0,
    getDetections: (json) => {
      const systems = json.internal_signals?.enterprise_systems || [];
      return systems.map((s: any) => ({
        label: s.system,
        value: s.risk || "Detected",
        status: "found" as const,
      }));
    },
    getReasoning: (json) => {
      if ((json.execution_friction || []).length === 0) return "No adoption friction patterns were identified. This may mean the AI couldn't detect enterprise system usage from signals.";
      return undefined;
    },
  },
  accountabilityPressure: {
    sectionKey: "accountabilityPressure",
    sectionLabel: "Accountability Pressure",
    jsonFields: ["accountability_pressure", "leaders_asked"],
    hasContent: (json) => (json.accountability_pressure || json.leaders_asked || []).length > 0,
  },
  realCost: {
    sectionKey: "realCost",
    sectionLabel: "Real Cost",
    jsonFields: ["real_cost", "cost_unaddressed"],
    hasContent: (json) => (json.real_cost || json.cost_unaddressed || []).length > 0,
  },
  blindSpot: {
    sectionKey: "blindSpot",
    sectionLabel: "Blind Spot",
    jsonFields: ["blind_spot"],
    hasContent: (json) => !!json.blind_spot,
  },
  strategicPlays: {
    sectionKey: "strategicPlays",
    sectionLabel: "Strategic Plays",
    jsonFields: ["strategic_plays"],
    hasContent: (json) => (json.strategic_plays || []).length > 0,
    getDetections: (json) => {
      const plays = json.strategic_plays || [];
      return plays.map((p: any) => ({
        label: p.name || "Play",
        value: p.why_now ? "Timing justified" : "No timing justification",
        status: p.why_now ? "found" as const : "inferred" as const,
      }));
    },
  },
  reinforcement: {
    sectionKey: "reinforcement",
    sectionLabel: "Reinforcement Journey",
    jsonFields: ["reinforcement_journey", "reinforcement_preview"],
    hasContent: (json) => !!json.reinforcement_journey,
    getDetections: (json) => {
      const preview = json.reinforcement_preview || {};
      const detections: { label: string; value: string; status: "found" | "missing" | "inferred" }[] = [];
      detections.push({
        label: "Detected tool",
        value: preview.detected_tool || "None",
        status: preview.detected_tool ? "found" : "missing",
      });
      detections.push({
        label: "Library URL",
        value: preview.library_url ? "Matched" : "No match found",
        status: preview.library_url ? "found" : "missing",
      });
      return detections;
    },
    getReasoning: (json) => {
      const preview = json.reinforcement_preview || {};
      if (!preview.library_url) {
        return "The AI couldn't match a detected enterprise tool to any available iorad library. You can manually assign one below.";
      }
      return undefined;
    },
  },
  caseStudies: {
    sectionKey: "caseStudies",
    sectionLabel: "Case Studies",
    jsonFields: ["case_studies", "similar_patterns"],
    hasContent: (json) => (json.case_studies || json.similar_patterns || []).length > 0,
    getDetections: (json) => {
      const studies = json.case_studies || json.similar_patterns || [];
      return studies.map((s: any) => ({
        label: s.company,
        value: s.similarity || s.relevance || "Selected",
        status: "found" as const,
      }));
    },
  },
  whyNow: {
    sectionKey: "whyNow",
    sectionLabel: "Why Now",
    jsonFields: ["why_now"],
    hasContent: (json) => !!json.why_now && typeof json.why_now === "string",
  },
  embedDemo: {
    sectionKey: "embedDemo",
    sectionLabel: "Interactive Demo",
    jsonFields: ["reinforcement_preview"],
    hasContent: (json) => !!json.reinforcement_preview?.library_url,
    getDetections: (json) => {
      const preview = json.reinforcement_preview || {};
      return [
        {
          label: "Demo source",
          value: preview.library_url ? "From matched library" : "Default iorad demo (no library matched)",
          status: preview.library_url ? "found" as const : "inferred" as const,
        },
      ];
    },
    getReasoning: (json) => {
      if (!json.reinforcement_preview?.library_url) {
        return "No library was matched to this company's detected tools, so the default iorad demo is shown. Assign a library in the Reinforcement section to customize this.";
      }
      return undefined;
    },
  },
};

export function useSectionAnnotation(sectionKey: string) {
  const debug = useStoryDebug();
  if (!debug || !debug.isIoradUser) return null;

  const config = sectionConfigs[sectionKey];
  if (!config) return null;

  const { snapshotJson: json, signals } = debug;
  const hasContent = config.hasContent(json);
  const detections = config.getDetections?.(json, signals) || [];
  const reasoning = config.getReasoning?.(json, signals);
  const matchedSignals = config.getMatchedSignals?.(signals) || [];

  return {
    element: (
      <SectionAnnotation
        sectionKey={config.sectionKey}
        sectionLabel={config.sectionLabel}
        jsonFields={config.jsonFields}
        hasContent={hasContent}
        detections={detections}
        reasoning={reasoning}
        matchedSignals={matchedSignals}
      >
        {sectionKey === "reinforcement" && debug.snapshotId && (
          <LibraryPicker
            detectedTool={json.reinforcement_preview?.detected_tool || null}
            currentLibraryUrl={json.reinforcement_preview?.library_url || null}
            snapshotId={debug.snapshotId}
            onLibrarySelected={debug.onLibrarySelected}
          />
        )}
      </SectionAnnotation>
    ),
  };
}
