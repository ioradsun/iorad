import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { customers } from "@/data/customers";
import { partnerMeta as staticPartnerMeta, PartnerMeta } from "@/data/partnerMeta";
import { Loader2 } from "lucide-react";
import type { Customer, InitiativeItem, InternalSignals } from "@/data/customers";
import { useAuth } from "@/hooks/useAuth";

import StoryHero from "./story/StoryHero";
import WhatsHappeningSection from "./story/WhatsHappeningSection";
import ExecutionFrictionSection from "./story/ExecutionFrictionSection";
import OpportunityAreasSection from "./story/OpportunityAreasSection";
import HowIoradHelpsSection from "./story/HowIoradHelpsSection";
import EmbedDemo from "./story/EmbedDemo";

import StoryCTA from "./story/StoryCTA";
import InternalSignalSummary from "./story/InternalSignalSummary";

// Convert a slug like "onesource-virtual" to match a company name like "OneSource Virtual"
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

// Map DB snapshot JSON to the Customer interface
function snapshotToCustomer(company: any, snap: any): Customer {
  const json = snap?.snapshot_json || {};

  // New ABM format
  const whatsHappening: InitiativeItem[] = (json.whats_happening || []).map((item: any) => ({
    title: item.title || "",
    detail: item.detail || "",
  }));

  const executionFriction: string[] = json.execution_friction || [];

  const opportunityAreas: InitiativeItem[] = (json.opportunity_areas || []).map((item: any) => ({
    title: item.title || "",
    detail: item.detail || "",
  }));

  const howIoradHelps: InitiativeItem[] = (json.how_iorad_helps || []).map((item: any) => ({
    title: item.title || "",
    detail: item.detail || "",
  }));

  const conversationStarters: string[] = json.conversation_starters || [];

  const internalSignals: InternalSignals = {
    signalTypes: json.internal_signals?.signal_types || [],
    confidenceLevel: json.internal_signals?.confidence_level || "Medium",
    urgency: json.internal_signals?.urgency || "Emerging",
    primaryPersona: json.internal_signals?.primary_persona || company.persona || "",
  };

  // Backward compatibility: if old format fields exist, map them into new structure
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

  if (opportunityAreas.length === 0 && json.embedded_leverage) {
    opportunityAreas.push({
      title: "Platform adoption reinforcement",
      detail: json.embedded_leverage.transformation || "",
    });
  }

  if (howIoradHelps.length === 0 && json.partner_platform_ceiling?.key_insight) {
    howIoradHelps.push({
      title: "Embedded execution layer",
      detail: json.partner_platform_ceiling.key_insight,
    });
  }

  if (conversationStarters.length === 0 && json.compelling_events?.buyer_language) {
    for (const line of json.compelling_events.buyer_language) {
      conversationStarters.push(line);
    }
  }

  return {
    id: company.id,
    name: company.name,
    partner: (company.partner || "").toLowerCase() as Customer["partner"],
    persona: company.persona || "",
    whatsHappening,
    executionFriction,
    opportunityAreas,
    howIoradHelps,
    conversationStarters,
    internalSignals,
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

  return (
    <div className="min-h-screen" style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}>
      <StoryHero customer={customer} pm={pm} />
      {customer.whatsHappening.length > 0 && (
        <WhatsHappeningSection companyName={customer.name} items={customer.whatsHappening} />
      )}
      {customer.executionFriction.length > 0 && (
        <ExecutionFrictionSection items={customer.executionFriction} />
      )}
      {customer.opportunityAreas.length > 0 && (
        <OpportunityAreasSection companyName={customer.name} items={customer.opportunityAreas} />
      )}
      {customer.howIoradHelps.length > 0 && (
        <HowIoradHelpsSection items={customer.howIoradHelps} />
      )}
      <EmbedDemo />
      <StoryCTA customer={customer} pm={pm} />

      {/* Internal signal summary — only visible to authenticated users */}
      {user && customer.internalSignals.signalTypes.length > 0 && (
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
        <p className="text-muted-foreground mb-4">No insight brief has been generated for this customer yet.</p>
        <Link to="/stories" className="text-primary hover:underline">Back to customers</Link>
      </div>
    </div>
  );
}
