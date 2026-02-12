import { useParams, Link } from "react-router-dom";
import { customers } from "@/data/customers";
import { partnerMeta } from "@/data/partnerMeta";
import { StoryNav } from "@/pages/CustomerList";

import StoryHero from "./story/StoryHero";
import CompellingEventsSection from "./story/CompellingEventsSection";
import MetaPatternSection from "./story/MetaPatternSection";
import PartnerCeilingSection from "./story/PartnerCeilingSection";
import EmbeddedLeverageSection from "./story/EmbeddedLeverageSection";
import EmbedDemo from "./story/EmbedDemo";
import ImpactSection from "./story/ImpactSection";
import NarrativeSection from "./story/NarrativeSection";
import StoryCTA from "./story/StoryCTA";

export default function CustomerStory() {
  const { id, customer: customerParam } = useParams<{ id: string; partner: string; customer: string }>();
  const customerId = customerParam || id;
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return <NotFoundStory />;
  const pm = partnerMeta[customer.partner];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <StoryNav />
      <StoryHero customer={customer} pm={pm} />
      <CompellingEventsSection signals={customer.signals} compellingEvents={customer.compellingEvents} />
      <MetaPatternSection metaPattern={customer.metaPattern} friction={customer.friction} />
      <PartnerCeilingSection customer={customer} pm={pm} />
      <EmbeddedLeverageSection customer={customer} pm={pm} />
      <EmbedDemo />
      <ImpactSection items={customer.quantifiedImpact} />
      <NarrativeSection paragraphs={customer.executiveNarrative} />
      <StoryCTA customer={customer} pm={pm} />

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/20">
        <p>© {new Date().getFullYear()} iorad · This analysis is confidential and prepared for {customer.name}.</p>
      </footer>
    </div>
  );
}

function NotFoundStory() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Customer not found</h1>
        <Link to="/stories" className="text-emerald-400 hover:underline">Back to customers</Link>
      </div>
    </div>
  );
}
