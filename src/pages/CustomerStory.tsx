import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customers } from "@/data/customers";
import { partnerMeta as staticPartnerMeta, PartnerMeta } from "@/data/partnerMeta";
import { Loader2 } from "lucide-react";
import type { Customer, CustomerSignal, CompellingEvents, MetaPattern, QuantifiedImpactItem } from "@/data/customers";

import StoryHero from "./story/StoryHero";
import CompellingEventsSection from "./story/CompellingEventsSection";
import MetaPatternSection from "./story/MetaPatternSection";
import PartnerCeilingSection from "./story/PartnerCeilingSection";
import EmbeddedLeverageSection from "./story/EmbeddedLeverageSection";
import EmbedDemo from "./story/EmbedDemo";
import ImpactSection from "./story/ImpactSection";
import NarrativeSection from "./story/NarrativeSection";
import StoryCTA from "./story/StoryCTA";

// Convert a slug like "onesource-virtual" to match a company name like "OneSource Virtual"
function slugToName(slug: string): string {
  return slug.replace(/-/g, " ");
}

function useDbStory(partner?: string, customerSlug?: string) {
  return useQuery({
    queryKey: ["story", partner, customerSlug],
    enabled: !!partner && !!customerSlug,
    queryFn: async () => {
      // Find company by matching partner (case-insensitive) and name (slug)
      const { data: companies, error: compError } = await supabase
        .from("companies")
        .select("*")
        .ilike("partner", partner!)
        .ilike("name", slugToName(customerSlug!).replace(/ /g, "%"));

      if (compError) throw compError;

      // Try exact slug match first, then fuzzy
      const company = companies?.find(
        (c) => c.name.toLowerCase().replace(/\s+/g, "-") === customerSlug!.toLowerCase()
      ) || companies?.[0];

      if (!company) return null;

      // Get latest snapshot
      const { data: snapshots, error: snapError } = await supabase
        .from("snapshots")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (snapError) throw snapError;

      // Get partner config from DB
      const { data: partnerConfig } = await supabase
        .from("partner_config")
        .select("*")
        .ilike("id", partner!)
        .maybeSingle();

      return { company, snapshot: snapshots?.[0] || null, partnerConfig };
    },
  });
}

// Map DB snapshot JSON to the Customer interface expected by story components
function snapshotToCustomer(
  company: any,
  snap: any
): Customer {
  const json = snap?.snapshot_json || {};

  const signals: CustomerSignal[] = (json.signals || json.evidence || []).map((s: any) => ({
    title: s.title || s.snippet || s.detail || "",
    detail: s.detail || s.snippet || "",
  }));

  const compellingEvents: CompellingEvents = {
    matched: json.compelling_events?.matched || [],
    buyerLanguage: json.compelling_events?.buyer_language || [],
  };

  const metaPattern: MetaPattern = {
    type: json.meta_pattern?.type || "drowning in repeat questions/manual training",
    description: json.meta_pattern?.description || "",
  };

  const friction: CustomerSignal[] = (json.operational_friction || []).map((f: any) => ({
    title: f.title || f.cause || "",
    detail: f.detail || f.effect || "",
  }));

  const partnerPlatform = {
    strengths: json.partner_platform_ceiling?.platform_strengths || [],
    executionGaps: json.partner_platform_ceiling?.execution_gaps || [],
    keyInsight: json.partner_platform_ceiling?.key_insight || "",
  };

  const embeddedIorad = {
    situation: json.embedded_leverage?.situation || "",
    constraint: json.embedded_leverage?.constraint || "",
    intervention: json.embedded_leverage?.intervention || "",
    transformation: json.embedded_leverage?.transformation || "",
  };

  const quantifiedImpact: QuantifiedImpactItem[] = (json.quantified_impact || []).map((q: any) => ({
    title: q.metric || q.title || "",
    assumptions: q.assumptions || "",
    math: q.calculation || q.math || "",
    result: q.result || "",
  }));

  const executiveNarrative: string[] = Array.isArray(json.executive_narrative)
    ? json.executive_narrative
    : typeof json.executive_narrative === "string"
      ? json.executive_narrative.split("\n\n")
      : [];

  return {
    id: company.id,
    name: company.name,
    partner: (company.partner || "").toLowerCase() as Customer["partner"],
    persona: company.persona || "",
    whyNow: typeof json.why_now === "string" ? json.why_now : Array.isArray(json.why_now) ? json.why_now.join(" ") : "",
    signals,
    compellingEvents,
    metaPattern,
    friction,
    partnerPlatform,
    embeddedIorad,
    quantifiedImpact,
    executiveNarrative,
    outboundPositioning: json.outbound_positioning
      ? {
          executiveFraming: json.outbound_positioning.executive_framing,
          efficiencyRevenue: json.outbound_positioning.efficiency_framing,
          riskMitigation: json.outbound_positioning.risk_framing,
        }
      : undefined,
  };
}

function getPartnerMeta(partnerKey: string, dbConfig: any): PartnerMeta {
  if (dbConfig) {
    return {
      key: dbConfig.id,
      label: dbConfig.label,
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

  // Legacy route: /stories/:id — look up from hardcoded data
  const legacyCustomer = id ? customers.find((c) => c.id === id) : null;

  // DB route: /:partner/:customer/stories or /:partner/:customer/stories/:contactName
  const { data: dbData, isLoading } = useDbStory(partner, customerParam);

  // Capitalize first letter of contact name
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
  return (
    <div className="min-h-screen" style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}>
      <StoryHero customer={customer} pm={pm} />
      {(customer.signals.length > 0 || customer.compellingEvents.matched.length > 0) && (
        <CompellingEventsSection signals={customer.signals} compellingEvents={customer.compellingEvents} />
      )}
      {customer.metaPattern.description && (
        <MetaPatternSection metaPattern={customer.metaPattern} friction={customer.friction} />
      )}
      {(customer.partnerPlatform.strengths.length > 0 || customer.partnerPlatform.executionGaps.length > 0) && (
        <PartnerCeilingSection customer={customer} pm={pm} />
      )}
      {customer.embeddedIorad.situation && (
        <EmbeddedLeverageSection customer={customer} pm={pm} />
      )}
      <EmbedDemo />
      {customer.quantifiedImpact.length > 0 && (
        <ImpactSection items={customer.quantifiedImpact} />
      )}
      {customer.executiveNarrative.length > 0 && (
        <NarrativeSection paragraphs={customer.executiveNarrative} />
      )}
      <StoryCTA customer={customer} pm={pm} />

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--story-border)", color: "var(--story-subtle)" }}>
        <p>© {new Date().getFullYear()} iorad · This analysis is confidential and prepared for {customer.name}.</p>
      </footer>
    </div>
  );
}

function NotFoundStory() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Customer not found</h1>
        <p className="text-muted-foreground mb-4">No story has been generated for this customer yet.</p>
        <Link to="/stories" className="text-primary hover:underline">Back to customers</Link>
      </div>
    </div>
  );
}
