import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customers } from "@/data/customers";
import { partnerMeta as staticPartnerMeta, PartnerMeta } from "@/data/partnerMeta";
import { Loader2 } from "lucide-react";
import type { Customer, InitiativeItem, InternalSignals, StrategicPlay, CaseStudy, EnterpriseSystem } from "@/data/customers";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import StoryHero from "./story/StoryHero";
import WhatsHappeningSection from "./story/WhatsHappeningSection";
import FunctionalImplicationsSection from "./story/FunctionalImplicationsSection";
import ExecutionFrictionSection from "./story/ExecutionFrictionSection";
import AccountabilityPressureSection from "./story/AccountabilityPressureSection";
import RealCostSection from "./story/RealCostSection";
import BlindSpotSection from "./story/BlindSpotSection";
import StrategicPlaysSection from "./story/StrategicPlaysSection";
import ReinforcementJourneySection from "./story/ReinforcementJourneySection";
import EmbedDemo from "./story/EmbedDemo";
import CaseStudiesSection from "./story/CaseStudiesSection";
import WhyNowSection from "./story/WhyNowSection";
import StoryCTA from "./story/StoryCTA";
import InternalSignalSummary from "./story/InternalSignalSummary";
import DebugPanel from "./story/DebugPanel";
import { StoryDebugProvider } from "./story/StoryDebugContext";
import { StoryEditProvider, useStoryEdit } from "./story/EditContext";
import EditToolbar from "./story/EditToolbar";

function slugToName(slug: string): string {
  return slug.replace(/-/g, " ");
}

function useDbStory(partner?: string, customerSlug?: string) {
  return useQuery({
    queryKey: ["story", partner, customerSlug],
    enabled: !!partner && !!customerSlug,
    queryFn: async () => {
      const { data: companies, error: compError } = await supabase
        .from("companies")
        .select("*")
        .ilike("partner", partner!)
        .ilike("name", slugToName(customerSlug!).replace(/ /g, "%"));

      if (compError) throw compError;

      const company = companies?.find(
        (c) => c.name.toLowerCase().replace(/\s+/g, "-") === customerSlug!.toLowerCase()
      ) || companies?.[0];

      if (!company) return null;

      const { data: snapshots, error: snapError } = await supabase
        .from("snapshots")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (snapError) throw snapError;

      const { data: partnerConfig } = await supabase
        .from("partner_config")
        .select("*")
        .ilike("id", partner!)
        .maybeSingle();

      return { company, snapshot: snapshots?.[0] || null, partnerConfig };
    },
  });
}

// Inbound stories by company name slug (+ optional contact slug)
function useInboundStoryBySlug(companySlug?: string, contactSlug?: string) {
  return useQuery({
    queryKey: ["inbound-story-slug", companySlug, contactSlug],
    enabled: !!companySlug,
    queryFn: async () => {
      // Find company by name slug
      const namePattern = slugToName(companySlug!).replace(/ /g, "%");
      const { data: companies, error: compError } = await supabase
        .from("companies")
        .select("*")
        .ilike("name", namePattern);
      if (compError) throw compError;

      const company = companies?.find(
        (c) => c.name.toLowerCase().replace(/\s+/g, "-") === companySlug!.toLowerCase()
      ) || companies?.[0];
      if (!company) return null;

      let contactId: string | null = null;
      if (contactSlug) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name")
          .eq("company_id", company.id);
        const match = (contacts || []).find((c: any) =>
          c.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") === contactSlug.toLowerCase()
        );
        if (match) contactId = match.id;
      }

      let card = null;
      if (contactId) {
        const { data, error } = await supabase
          .from("company_cards").select("*")
          .eq("company_id", company.id)
          .eq("contact_id", contactId)
          .maybeSingle();
        if (error) throw error;
        card = data;
      }
      // Fallback: if no card for specific contact, get latest for company
      if (!card) {
        const { data, error } = await supabase
          .from("company_cards").select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        card = data?.[0] ?? null;
      }
      if (!card) return null;

      return { card, company };
    },
  });
}

// Inbound stories: look up by company_cards.id and build story from account_json
function useInboundStory(cardsId?: string) {
  return useQuery({
    queryKey: ["inbound-story", cardsId],
    enabled: !!cardsId,
    queryFn: async () => {
      // REFACTOR: (b) contact-scoped — safe here because lookup is by company_cards.id (already row-specific).
      const { data: card, error } = await supabase
        .from("company_cards")
        .select("*, companies(*)")
        .eq("id", cardsId!)
        .maybeSingle();

      if (error) throw error;
      if (!card) return null;

      return { card, company: (card as any).companies };
    },
  });
}

// Convert inbound account_json → snapshot_json shape so snapshotToCustomer can render it
function inboundAccountJsonToSnapshotJson(accountJson: Record<string, any>, assetsJson: Record<string, any>): Record<string, any> {
  // If the account_json was previously saved in snapshot_json format (has whats_happening key), pass through
  if (accountJson.whats_happening) {
    return accountJson;
  }

  // The story tab writes to account_json root with _type: inbound_story
  // Strategy tab writes under _strategy key
  // We read whichever is richer
  const root = accountJson;

  const whatsHappening = [];
  if (root.behavior_acknowledged || root.momentum_observed) {
    if (root.behavior_acknowledged) whatsHappening.push({ title: "Behavior Acknowledged", detail: root.behavior_acknowledged });
    if (root.momentum_observed)    whatsHappening.push({ title: "Momentum Observed", detail: root.momentum_observed });
    if (root.initiative_translation) whatsHappening.push({ title: "Initiative Translation", detail: root.initiative_translation });
  }

  const executionFriction: string[] = [];
  if (root.scale_risk)               executionFriction.push(root.scale_risk);
  if (root.institutionalization_gap) executionFriction.push(root.institutionalization_gap);

  const emailSeq = assetsJson?.email_sequence || {};
  const outreachMeta = root._outreach_meta || {};

  return {
    whats_happening: whatsHappening,
    functional_implications: root.executive_translation || "",
    execution_friction: executionFriction,
    real_cost: root.real_cost_if_stalled ? [root.real_cost_if_stalled] : [],
    blind_spot: root.institutionalization_gap || "",
    reinforcement_journey: root.reinforcement_journey || "",
    why_now: root.why_now || "",
    cta: root.cta || "",
    strategic_plays: (root.strategic_plays || []).map((p: any) => ({
      name: p.name || "",
      objective: p.objective || "",
      why_now: p.why_now || "",
      what_it_looks_like: p.what_it_looks_like || "",
      expected_impact: p.expected_impact || "",
    })),
    reinforcement_preview: root.reinforcement_preview ? {
      detected_tool: root.reinforcement_preview.detected_tool || "",
      library_url: root.reinforcement_preview.library_url || null,
      description: root.reinforcement_preview.description || "",
    } : undefined,
    internal_signals: {
      primary_persona: root.persona || "",
      confidence_level: "High",
      urgency: root.intent_tier === "Tier 1" ? "High Momentum" : root.intent_tier === "Tier 2" ? "Active" : "Emerging",
      signal_types: ["inbound_behavior"],
      enterprise_systems: [],
      operational_risks: root.real_cost_if_stalled ? [root.real_cost_if_stalled] : [],
      hiring_intensity: "",
      platform_rollout: root.upside_if_executed || outreachMeta.upside_if_executed || "",
    },
    upside_if_executed: root.upside_if_executed || "",
    opening_hook: {
      subject_line: root.subject_line || root.initiative_translation || "",
      opening_paragraph: root.opening_paragraph || root.behavior_acknowledged || "",
    },
    text_overrides: {},
  };
}

function snapshotToCustomer(company: any, snap: any): Customer {
  const json = snap?.snapshot_json || {};

  const whatsHappening: InitiativeItem[] = (json.whats_happening || []).map((item: any) => ({
    title: item.title || "",
    detail: item.detail || "",
  }));

  // New fields
  const functionalImplications: string = json.functional_implications || "";
  const toStringArray = (arr: any[]): string[] =>
    arr.map((item: any) => (typeof item === "string" ? item : item?.prompt || item?.text || item?.title || JSON.stringify(item)));

  const accountabilityPressure: string[] = toStringArray(json.accountability_pressure || json.leaders_asked || []);
  const realCost: string[] = toStringArray(json.real_cost || json.cost_unaddressed || []);
  const reinforcementJourney: string = json.reinforcement_journey || "";
  const reinforcementPreview = json.reinforcement_preview ? {
    detectedTool: json.reinforcement_preview.detected_tool || "",
    libraryUrl: json.reinforcement_preview.library_url || null,
    description: json.reinforcement_preview.description || "",
  } : undefined;
  const cta: string = json.cta || "";
  const openingHook = json.opening_hook ? {
    subjectLine: json.opening_hook.subject_line || "",
    openingParagraph: json.opening_hook.opening_paragraph || "",
  } : undefined;

  // Existing fields
  const executionFriction: string[] = toStringArray(json.execution_friction || []);
  const blindSpot: string = json.blind_spot || "";

  const plays: StrategicPlay[] = (json.strategic_plays || []).map((p: any) => ({
    name: p.name || p.play_name || "",
    objective: p.objective || "",
    whyNow: p.why_now || "",
    whatItLooksLike: p.what_it_looks_like || p.in_practice || "",
    expectedImpact: p.expected_impact || "",
  }));

  const caseStudies: CaseStudy[] = (json.case_studies || json.similar_patterns || []).map((c: any) => ({
    company: c.company || "",
    similarity: c.similarity || "",
    challenge: c.challenge || "",
    outcome: c.outcome || "",
    relevance: c.relevance || "",
  }));

  const whyNow: string = typeof json.why_now === "string" ? json.why_now : Array.isArray(json.why_now) ? json.why_now.join(" ") : "";

  const conversationStarters: string[] = json.conversation_starters || [];

  const enterpriseSystems: EnterpriseSystem[] = (json.internal_signals?.enterprise_systems || []).map((e: any) => ({
    system: e.system || "",
    risk: e.risk || "",
  }));

  const internalSignals: InternalSignals = {
    signalTypes: json.internal_signals?.signal_types || [],
    enterpriseSystems,
    operationalRisks: json.internal_signals?.operational_risks || [],
    hiringIntensity: json.internal_signals?.hiring_intensity || "",
    platformRollout: json.internal_signals?.platform_rollout || "",
    confidenceLevel: json.internal_signals?.confidence_level || "Medium",
    urgency: json.internal_signals?.urgency || "Emerging",
    primaryPersona: json.internal_signals?.primary_persona || company.persona || "",
  };

  // Legacy fallbacks
  if (whatsHappening.length === 0 && json.signals) {
    for (const s of json.signals) {
      whatsHappening.push({ title: s.title || "", detail: s.detail || "" });
    }
  }

  if (executionFriction.length === 0 && json.operational_friction) {
    for (const f of json.operational_friction) {
      executionFriction.push(f.detail || f.title || "");
    }
  }

  if (conversationStarters.length === 0 && json.compelling_events?.buyer_language) {
    for (const line of json.compelling_events.buyer_language) {
      conversationStarters.push(line);
    }
  }

  // Build legacy path text into reinforcement journey if missing
  if (!reinforcementJourney && (json.path_a || json.path_b)) {
    // no-op — leave empty, those sections won't render
  }

  // Build accountability pressure from leaders_asked if needed (already handled above)

  return {
    id: company.id,
    name: company.name,
    domain: company.domain || undefined,
    partner: (company.partner || "").toLowerCase() as Customer["partner"],
    persona: company.persona || "",
    whatsHappening,
    functionalImplications,
    executionFriction,
    accountabilityPressure,
    realCost,
    blindSpot,
    plays,
    reinforcementJourney,
    reinforcementPreview,
    caseStudies,
    whyNow,
    cta,
    openingHook,
    conversationStarters,
    internalSignals,
    overrides: json.text_overrides || {},
    // Legacy
    leadershipPriorities: json.leadership_priorities || [],
    leadersAsked: json.leaders_asked || [],
    pathA: json.path_a || json.two_paths?.path_a || "",
    pathB: json.path_b || json.two_paths?.path_b || "",
    costUnaddressed: json.cost_unaddressed || [],
    leveragePoints: json.leverage_points || [],
    selfCheck: json.self_check || [],
  };
}

function customerToSnapshotJson(c: Customer): Record<string, any> {
  const json: Record<string, any> = {
    whats_happening: c.whatsHappening.map((w) => ({ title: w.title, detail: w.detail })),
    functional_implications: c.functionalImplications,
    execution_friction: c.executionFriction,
    accountability_pressure: c.accountabilityPressure,
    real_cost: c.realCost,
    blind_spot: c.blindSpot,
    strategic_plays: c.plays.map((p) => ({
      name: p.name,
      objective: p.objective,
      why_now: p.whyNow,
      what_it_looks_like: p.whatItLooksLike,
      expected_impact: p.expectedImpact,
    })),
    reinforcement_journey: c.reinforcementJourney,
    case_studies: c.caseStudies.map((s) => ({
      company: s.company,
      similarity: s.similarity,
      challenge: s.challenge,
      outcome: s.outcome,
      relevance: s.relevance,
    })),
    why_now: c.whyNow,
    cta: c.cta || "",
    conversation_starters: c.conversationStarters,
    internal_signals: {
      signal_types: c.internalSignals.signalTypes,
      enterprise_systems: (c.internalSignals.enterpriseSystems || []).map((e) => ({
        system: e.system,
        risk: e.risk,
      })),
      operational_risks: c.internalSignals.operationalRisks || [],
      hiring_intensity: c.internalSignals.hiringIntensity,
      platform_rollout: c.internalSignals.platformRollout,
      confidence_level: c.internalSignals.confidenceLevel,
      urgency: c.internalSignals.urgency,
      primary_persona: c.internalSignals.primaryPersona,
    },
    text_overrides: c.overrides || {},
  };

  if (c.openingHook) {
    json.opening_hook = {
      subject_line: c.openingHook.subjectLine,
      opening_paragraph: c.openingHook.openingParagraph,
    };
  }

  if (c.reinforcementPreview) {
    json.reinforcement_preview = {
      detected_tool: c.reinforcementPreview.detectedTool,
      library_url: c.reinforcementPreview.libraryUrl,
      description: c.reinforcementPreview.description,
    };
  }

  return json;
}

function getPartnerMeta(partnerKey: string, dbConfig: any): PartnerMeta {
  if (dbConfig) {
    return {
      key: dbConfig.id,
      label: dbConfig.label,
      domain: dbConfig.domain || `${dbConfig.id}.com`,
      positioning: dbConfig.positioning || "",
      embedBullets: dbConfig.embed_bullets || [],
      color: dbConfig.color || "#10B981",
      gradient: dbConfig.gradient || "from-emerald-900/20 to-green-900/10",
    };
  }
  return staticPartnerMeta[partnerKey.toLowerCase()] || staticPartnerMeta.seismic;
}

export default function CustomerStory() {
  const { id, partner, customer: customerParam, contactName, companySlug, contactSlug } = useParams<{ id: string; partner: string; customer: string; contactName: string; companySlug: string; contactSlug: string }>();

  const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const legacyCustomer = id ? customers.find((c) => c.id === id) : null;

  // Outbound: partner + customer slug path
  const { data: dbData, isLoading: dbLoading } = useDbStory(partner, customerParam);

  // Inbound by UUID: /stories/:uuid
  const isInboundUuidRoute = !!isUuid && !partner && !legacyCustomer;
  const { data: inboundData, isLoading: inboundLoading } = useInboundStory(isInboundUuidRoute ? id : undefined);

  // Inbound by slug: /stories/:companySlug/:contactSlug
  const isSlugRoute = !!companySlug;
  const { data: slugData, isLoading: slugLoading } = useInboundStoryBySlug(
    isSlugRoute ? companySlug : undefined,
    isSlugRoute ? contactSlug : undefined
  );

  // Also handle /stories/:id where id is a non-UUID slug (single segment)
  const isSingleSlugRoute = !!id && !isUuid && !partner && !legacyCustomer;
  const { data: singleSlugData, isLoading: singleSlugLoading } = useInboundStoryBySlug(
    isSingleSlugRoute ? id : undefined,
    undefined
  );

  const effectiveContactName = contactSlug || contactName;
  const formattedContactName = effectiveContactName
    ? effectiveContactName.charAt(0).toUpperCase() + effectiveContactName.slice(1).toLowerCase()
    : undefined;

  if (legacyCustomer) {
    const pm = staticPartnerMeta[legacyCustomer.partner];
    return <StoryPage customer={legacyCustomer} pm={pm} snapshotId={undefined} />;
  }

  // --- Slug route: /stories/:companySlug/:contactSlug ---
  const resolvedSlugData = isSlugRoute ? slugData : isSingleSlugRoute ? singleSlugData : null;
  const resolvedSlugLoading = isSlugRoute ? slugLoading : isSingleSlugRoute ? singleSlugLoading : false;

  if (isSlugRoute || isSingleSlugRoute) {
    if (resolvedSlugLoading) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!resolvedSlugData?.card || !resolvedSlugData?.company) {
      return <NotFoundStory />;
    }
    const accountJson = (resolvedSlugData.card.account_json as Record<string, any>) || {};
    const assetsJson = (resolvedSlugData.card.assets_json as Record<string, any>) || {};
    const convertedJson = inboundAccountJsonToSnapshotJson(accountJson, assetsJson);
    const syntheticSnapshot = {
      id: resolvedSlugData.card.id,
      snapshot_json: convertedJson,
      score_total: accountJson._score_total ?? 0,
      score_breakdown: accountJson._score_breakdown ?? {},
      model_version: resolvedSlugData.card.model_version ?? null,
      prompt_version: null,
      created_at: resolvedSlugData.card.created_at,
    };
    const customer = snapshotToCustomer(resolvedSlugData.company, syntheticSnapshot);
    customer.contactName = formattedContactName;
    const pm = staticPartnerMeta.inbound;
    return <StoryPage customer={customer} pm={pm} snapshotId={resolvedSlugData.card.id} snapshotMeta={syntheticSnapshot} companyId={resolvedSlugData.company.id} loomUrl={resolvedSlugData.company.loom_url} ioradUrl={resolvedSlugData.company.iorad_url} saveTarget="company_cards" />;
  }

  // --- Inbound UUID route: /stories/:uuid (backward compat) ---
  if (isInboundUuidRoute) {
    if (inboundLoading) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!inboundData?.card || !inboundData?.company) {
      return <NotFoundStory />;
    }
    const accountJson = (inboundData.card.account_json as Record<string, any>) || {};
    const assetsJson = (inboundData.card.assets_json as Record<string, any>) || {};
    const convertedJson = inboundAccountJsonToSnapshotJson(accountJson, assetsJson);
    const syntheticSnapshot = {
      id: inboundData.card.id,
      snapshot_json: convertedJson,
      score_total: accountJson._score_total ?? 0,
      score_breakdown: accountJson._score_breakdown ?? {},
      model_version: inboundData.card.model_version ?? null,
      prompt_version: null,
      created_at: inboundData.card.created_at,
    };
    const customer = snapshotToCustomer(inboundData.company, syntheticSnapshot);
    customer.contactName = formattedContactName;
    const pm = staticPartnerMeta.inbound;
    return <StoryPage customer={customer} pm={pm} snapshotId={inboundData.card.id} snapshotMeta={syntheticSnapshot} companyId={inboundData.company.id} loomUrl={inboundData.company.loom_url} ioradUrl={inboundData.company.iorad_url} saveTarget="company_cards" />;
  }

  // --- Outbound route: /:partner/:customer/stories/:contactName ---
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dbData?.company || !dbData?.snapshot) {
    return <NotFoundStory />;
  }

  const customer = snapshotToCustomer(dbData.company, dbData.snapshot);
  customer.contactName = formattedContactName;
  const pm = getPartnerMeta(partner || "", dbData.partnerConfig);

  return <StoryPage customer={customer} pm={pm} snapshotId={dbData.snapshot.id} snapshotMeta={dbData.snapshot} companyId={dbData.company.id} loomUrl={dbData.company.loom_url} ioradUrl={dbData.company.iorad_url} />;
}

function StoryPage({ customer, pm, snapshotId, snapshotMeta, companyId, loomUrl, ioradUrl, saveTarget = "snapshots" }: { customer: Customer; pm: PartnerMeta; snapshotId?: string; snapshotMeta?: any; companyId?: string; loomUrl?: string | null; ioradUrl?: string | null; saveTarget?: "snapshots" | "company_cards" }) {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const showInternal = user && searchParams.get("internal") === "true";
  const queryClient = useQueryClient();

  const isIoradUser = !authLoading && !!user?.email?.endsWith("@iorad.com");

  // Fetch raw signals for debug panel
  const { data: rawSignals } = useQuery({
    queryKey: ["debug-signals", companyId],
    enabled: !!isIoradUser && !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("signals")
        .select("id, type, title, url, date, raw_excerpt, discovered_at")
        .eq("company_id", companyId!)
        .order("discovered_at", { ascending: false });
      return data || [];
    },
  });

   return (
    <StoryEditProvider customer={customer}>
      <StoryPageInner customer={customer} pm={pm} snapshotId={snapshotId} showInternal={!!showInternal} isIoradUser={!!isIoradUser} queryClient={queryClient} snapshotMeta={snapshotMeta} rawSignals={rawSignals || []} loomUrl={loomUrl} ioradUrl={ioradUrl} saveTarget={saveTarget} />
    </StoryEditProvider>
  );
}

function StoryPageInner({
  customer,
  pm,
  snapshotId,
  showInternal,
  isIoradUser,
  queryClient,
  snapshotMeta,
  rawSignals,
  loomUrl,
  ioradUrl,
  saveTarget = "snapshots",
}: {
  customer: Customer;
  pm: PartnerMeta;
  snapshotId?: string;
  showInternal: boolean;
  isIoradUser: boolean;
  queryClient: any;
  snapshotMeta?: any;
  rawSignals: any[];
  loomUrl?: string | null;
  ioradUrl?: string | null;
  saveTarget?: "snapshots" | "company_cards";
}) {
  const ctx = useStoryEdit();
  const displayCustomer = ctx?.isEditing ? ctx.editedCustomer : customer;

  const refreshSnapshot = () => {
    queryClient.invalidateQueries({ queryKey: ["story"] });
  };

  const handleSave = async () => {
    if (!ctx || !snapshotId) {
      toast.error("Cannot save — no snapshot ID available");
      return;
    }

    const newJson = customerToSnapshotJson(ctx.editedCustomer);

    let error: any;
    if (saveTarget === "company_cards") {
      // REFACTOR: (b) contact-scoped — safe here because write targets a specific company_cards.id.
      const res = await supabase
        .from("company_cards")
        .update({ account_json: newJson as any })
        .eq("id", snapshotId);
      error = res.error;
    } else {
      const res = await supabase
        .from("snapshots")
        .update({ snapshot_json: newJson as any })
        .eq("id", snapshotId);
      error = res.error;
    }

    if (error) {
      toast.error("Failed to save: " + error.message);
      return;
    }

    toast.success("Story updated successfully");
    // Invalidate all possible query keys that feed story data
    queryClient.invalidateQueries({ queryKey: ["story"] });
    // REFACTOR: (c) existence-check/prefix invalidation — broad ["company_cards"] invalidation is safe.
    queryClient.invalidateQueries({ queryKey: ["company_cards"] });
    queryClient.invalidateQueries({ queryKey: ["inbound-story-slug"] });
    queryClient.invalidateQueries({ queryKey: ["inbound-story"] });
    // Wait for refetch before exiting edit mode so the provider picks up fresh data
    await queryClient.refetchQueries({ queryKey: ["inbound-story-slug"] });
    await queryClient.refetchQueries({ queryKey: ["inbound-story"] });
    await queryClient.refetchQueries({ queryKey: ["story"] });
    ctx.cancelEditing();
  };

  return (
    <StoryDebugProvider value={
      isIoradUser && snapshotMeta ? {
        isIoradUser: true,
        snapshotJson: (snapshotMeta.snapshot_json as Record<string, any>) ?? {},
        signals: rawSignals,
        snapshotId: snapshotMeta?.id ?? null,
        refreshSnapshot,
      } : null
    }>
      <div className="min-h-screen" style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}>
        <StoryHero customer={displayCustomer} pm={pm} />

        {/* Loom Video Embed (from Story config) */}
        {loomUrl && (() => {
          const match = loomUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
          const embedUrl = match ? `https://www.loom.com/embed/${match[1]}` : null;
          return embedUrl ? (
            <section className="max-w-5xl mx-auto px-6 py-12">
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--story-surface)" }}>
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="450"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; fullscreen"
                  title="Loom video"
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            </section>
          ) : null;
        })()}

        {/* 1. What We're Seeing */}
        {displayCustomer.whatsHappening.length > 0 && (
          <WhatsHappeningSection companyName={displayCustomer.name} items={displayCustomer.whatsHappening} />
        )}

        {/* 2. What This Likely Means */}
        {displayCustomer.functionalImplications && (
          <FunctionalImplicationsSection text={displayCustomer.functionalImplications} contactName={displayCustomer.contactName} />
        )}

        {/* 3. Where Adoption Friction Shows Up */}
        {displayCustomer.executionFriction.length > 0 && (
          <ExecutionFrictionSection items={displayCustomer.executionFriction} />
        )}

        {/* 4. The Accountability Pressure */}
        {displayCustomer.accountabilityPressure.length > 0 && (
          <AccountabilityPressureSection items={displayCustomer.accountabilityPressure} />
        )}

        {/* 5. The Real Cost */}
        {displayCustomer.realCost.length > 0 && (
          <RealCostSection items={displayCustomer.realCost} />
        )}

        {/* 6. The Common Blind Spot */}
        {displayCustomer.blindSpot && (
          <BlindSpotSection text={displayCustomer.blindSpot} />
        )}

        {/* 7. Four Strategic Plays */}
        {displayCustomer.plays.length > 0 && (
          <StrategicPlaysSection plays={displayCustomer.plays} />
        )}

        {/* 8. What Reinforcement Could Feel Like */}
        {displayCustomer.reinforcementJourney && (
          <ReinforcementJourneySection text={displayCustomer.reinforcementJourney} />
        )}

        {/* Interactive Demo */}
        <EmbedDemo ioradUrl={ioradUrl} />

        {/* 9. Similar Patterns */}
        {displayCustomer.caseStudies.length > 0 && (
          <CaseStudiesSection studies={displayCustomer.caseStudies} />
        )}

        {/* 10. Why This Matters Now */}
        {displayCustomer.whyNow && (
          <WhyNowSection text={displayCustomer.whyNow} />
        )}

        {/* 11. Continue the Conversation */}
        <StoryCTA customer={displayCustomer} pm={pm} />

        {/* 12. Internal Signal Context (hidden) */}
        {showInternal && displayCustomer.internalSignals.signalTypes.length > 0 && (
          <InternalSignalSummary signals={displayCustomer.internalSignals} conversationStarters={displayCustomer.conversationStarters} />
        )}

        <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--story-border)", color: "var(--story-subtle)" }}>
          <p>© {new Date().getFullYear()} iorad · Prepared for {displayCustomer.name}.</p>
        </footer>

        {isIoradUser && snapshotId && (
          <>
            <EditToolbar onSave={handleSave} />
            {snapshotMeta && (
              <DebugPanel
                companyId={customer.id}
                companyName={customer.name}
                scoreTotal={snapshotMeta.score_total ?? 0}
                scoreBreakdown={(snapshotMeta.score_breakdown as Record<string, number>) ?? {}}
                modelVersion={snapshotMeta.model_version}
                promptVersion={snapshotMeta.prompt_version}
                snapshotCreatedAt={snapshotMeta.created_at}
                snapshotJson={(snapshotMeta.snapshot_json as Record<string, any>) ?? {}}
                signals={rawSignals}
              />
            )}
          </>
        )}
      </div>
    </StoryDebugProvider>
  );
}

function NotFoundStory() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Customer not found</h1>
        <p className="text-muted-foreground mb-4">No operating brief has been generated for this customer yet.</p>
        <Link to="/stories" className="text-primary hover:underline">Back to customers</Link>
      </div>
    </div>
  );
}
