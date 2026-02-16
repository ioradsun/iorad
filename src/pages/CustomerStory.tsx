import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customers } from "@/data/customers";
import { partnerMeta as staticPartnerMeta, PartnerMeta } from "@/data/partnerMeta";
import { Loader2 } from "lucide-react";
import type { Customer, InitiativeItem, InternalSignals, StrategicPlay, CaseStudy } from "@/data/customers";
import { useAuth } from "@/hooks/useAuth";

import StoryHero from "./story/StoryHero";
import WhatsHappeningSection from "./story/WhatsHappeningSection";
import LeadershipPrioritiesSection from "./story/LeadershipPrioritiesSection";
import ExecutionFrictionSection from "./story/ExecutionFrictionSection";
import LeadersAskedSection from "./story/LeadersAskedSection";
import TwoPathsSection from "./story/TwoPathsSection";
import CostUnaddressedSection from "./story/CostUnaddressedSection";
import BlindSpotSection from "./story/BlindSpotSection";
import LeveragePointsSection from "./story/LeveragePointsSection";
import StrategicPlaysSection from "./story/StrategicPlaysSection";
import EmbedDemo from "./story/EmbedDemo";
import SelfCheckSection from "./story/SelfCheckSection";
import CaseStudiesSection from "./story/CaseStudiesSection";
import WhyNowSection from "./story/WhyNowSection";
import StoryCTA from "./story/StoryCTA";
import InternalSignalSummary from "./story/InternalSignalSummary";

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

function snapshotToCustomer(company: any, snap: any): Customer {
  const json = snap?.snapshot_json || {};

  const whatsHappening: InitiativeItem[] = (json.whats_happening || []).map((item: any) => ({
    title: item.title || "",
    detail: item.detail || "",
  }));

  const leadershipPriorities: string[] = json.leadership_priorities || [];
  const executionFriction: string[] = json.execution_friction || [];
  const leadersAsked: string[] = json.leaders_asked || [];

  const pathA: string = json.path_a || json.two_paths?.path_a || "";
  const pathB: string = json.path_b || json.two_paths?.path_b || "";

  const costUnaddressed: string[] = json.cost_unaddressed || [];
  const blindSpot: string = json.blind_spot || "";
  const leveragePoints: string[] = json.leverage_points || [];

  const plays: StrategicPlay[] = (json.strategic_plays || []).map((p: any) => ({
    name: p.name || p.play_name || "",
    objective: p.objective || "",
    whyNow: p.why_now || "",
    inPractice: p.in_practice || p.what_it_looks_like || "",
    expectedImpact: p.expected_impact || "",
  }));

  const selfCheck: string[] = json.self_check || [];

  const caseStudies: CaseStudy[] = (json.case_studies || json.similar_patterns || []).map((c: any) => ({
    company: c.company || "",
    similarity: c.similarity || "",
    challenge: c.challenge || "",
    outcome: c.outcome || "",
    relevance: c.relevance || "",
  }));

  const whyNow: string = typeof json.why_now === "string" ? json.why_now : Array.isArray(json.why_now) ? json.why_now.join(" ") : "";

  const conversationStarters: string[] = json.conversation_starters || [];

  const internalSignals: InternalSignals = {
    signalTypes: json.internal_signals?.signal_types || [],
    hiringIntensity: json.internal_signals?.hiring_intensity || "",
    platformRollout: json.internal_signals?.platform_rollout || "",
    confidenceLevel: json.internal_signals?.confidence_level || "Medium",
    urgency: json.internal_signals?.urgency || "Emerging",
    primaryPersona: json.internal_signals?.primary_persona || company.persona || "",
  };

  // Backward compat: old format fields
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

  return {
    id: company.id,
    name: company.name,
    domain: company.domain || undefined,
    partner: (company.partner || "").toLowerCase() as Customer["partner"],
    persona: company.persona || "",
    whatsHappening,
    leadershipPriorities,
    executionFriction,
    leadersAsked,
    pathA,
    pathB,
    costUnaddressed,
    blindSpot,
    leveragePoints,
    plays,
    selfCheck,
    caseStudies,
    whyNow,
    conversationStarters,
    internalSignals,
  };
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
  const { id, partner, customer: customerParam, contactName } = useParams<{ id: string; partner: string; customer: string; contactName: string }>();

  const legacyCustomer = id ? customers.find((c) => c.id === id) : null;
  const { data: dbData, isLoading } = useDbStory(partner, customerParam);

  const formattedContactName = contactName
    ? contactName.charAt(0).toUpperCase() + contactName.slice(1).toLowerCase()
    : undefined;

  if (legacyCustomer) {
    const pm = staticPartnerMeta[legacyCustomer.partner];
    return <StoryPage customer={legacyCustomer} pm={pm} />;
  }

  if (isLoading) {
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

  return <StoryPage customer={customer} pm={pm} />;
}

function StoryPage({ customer, pm }: { customer: Customer; pm: PartnerMeta }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const showInternal = user && searchParams.get("internal") === "true";

  return (
    <div className="min-h-screen" style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}>
      <StoryHero customer={customer} pm={pm} />

      {customer.whatsHappening.length > 0 && (
        <WhatsHappeningSection companyName={customer.name} items={customer.whatsHappening} />
      )}

      {customer.leadershipPriorities.length > 0 && (
        <LeadershipPrioritiesSection items={customer.leadershipPriorities} />
      )}

      {customer.executionFriction.length > 0 && (
        <ExecutionFrictionSection items={customer.executionFriction} />
      )}

      {customer.leadersAsked.length > 0 && (
        <LeadersAskedSection items={customer.leadersAsked} persona={customer.persona} />
      )}

      {(customer.pathA || customer.pathB) && (
        <TwoPathsSection pathA={customer.pathA} pathB={customer.pathB} />
      )}

      {customer.costUnaddressed.length > 0 && (
        <CostUnaddressedSection items={customer.costUnaddressed} />
      )}

      {customer.blindSpot && (
        <BlindSpotSection text={customer.blindSpot} />
      )}

      {customer.leveragePoints.length > 0 && (
        <LeveragePointsSection items={customer.leveragePoints} />
      )}

      {customer.plays.length > 0 && (
        <StrategicPlaysSection plays={customer.plays} />
      )}

      <EmbedDemo />

      {customer.selfCheck.length > 0 && (
        <SelfCheckSection items={customer.selfCheck} />
      )}

      {customer.caseStudies.length > 0 && (
        <CaseStudiesSection studies={customer.caseStudies} />
      )}

      {customer.whyNow && (
        <WhyNowSection text={customer.whyNow} />
      )}

      <StoryCTA customer={customer} pm={pm} />

      {showInternal && customer.internalSignals.signalTypes.length > 0 && (
        <InternalSignalSummary signals={customer.internalSignals} conversationStarters={customer.conversationStarters} />
      )}

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--story-border)", color: "var(--story-subtle)" }}>
        <p>© {new Date().getFullYear()} iorad · Prepared for {customer.name}.</p>
      </footer>
    </div>
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
