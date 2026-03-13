import { PartnerMeta } from "@/data/partnerMeta";
import { Customer } from "@/data/customers";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useState, forwardRef } from "react";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface StoryHeroProps {
  customer: Customer;
  pm: PartnerMeta;
}

const partnerLogoMap: Record<string, string> = {
  seismic: "/logos/seismic.png",
  workramp: "/logos/workramp.png",
  "360learning": "/logos/360learning.png",
  docebo: "/logos/docebo.png",
  gainsight: "/logos/gainsight.png",
};

function LogoPill({ src, alt, fallbackLabel }: { src?: string; alt: string; fallbackLabel: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center overflow-hidden"
      style={{ background: "var(--story-surface)", border: "1px solid var(--story-border)" }}
    >
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" className="h-7 w-7 md:h-8 md:w-8 object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--story-muted)" }}>
          {fallbackLabel.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center w-6 md:w-8">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-20">
        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const StoryHero = forwardRef<HTMLElement, StoryHeroProps>(function StoryHero({ customer, pm }, _ref) {
  const ctx = useStoryEdit();
  const isEditing = ctx?.isEditing;

  const isDark = getComputedStyle(document.documentElement).getPropertyValue("--story-bg").trim() === "#0A0A0F";
  const ioradLogo = isDark ? ioradLogoDark : ioradLogoLight;

  const customerLogoUrl = customer.domain ? `https://www.google.com/s2/favicons?domain=${customer.domain}&sz=128` : undefined;
  const partnerLogoUrl = partnerLogoMap[pm.key] || (pm.domain ? `https://www.google.com/s2/favicons?domain=${pm.domain}&sz=128` : undefined);

  const subtitle = customer.overrides?.["hero.subtitle"]
    || customer.openingHook?.openingParagraph
    || `An operating brief exploring where reinforcement gaps typically show up at ${customer.name}'s current stage.`;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--story-accent-dim), transparent, transparent)" }} />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
        <div>
          {/* Logo lockup */}
          <div className="flex items-center gap-0 mb-10">
            <div className="inline-flex items-center gap-1 md:gap-2 px-2 py-2 rounded-[1.25rem]" style={{ background: "var(--story-surface)", border: "1px solid var(--story-border)" }}>
              <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: "var(--story-bg)", border: "1px solid var(--story-border)" }}>
                <img src={ioradLogo} alt="iorad" fetchPriority="high" className="h-5 md:h-6 object-contain" />
              </div>
              {pm.key !== "inbound" && (
                <>
                  <Connector />
                  <LogoPill src={partnerLogoUrl} alt={pm.label} fallbackLabel={pm.label} />
                </>
              )}
              <Connector />
              <LogoPill src={customerLogoUrl} alt={customer.name} fallbackLabel={customer.name} />
            </div>
          </div>

          {isEditing ? (
            <EditableText
              value={customer.overrides?.["hero.badge"] ?? `Prepared for ${customer.name}`}
              field="overrides.hero.badge"
              as="span"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
              style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
            />
          ) : (
            <span
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
              style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
            >
              {customer.overrides?.["hero.badge"] ?? `Prepared for ${customer.name}`}
            </span>
          )}

          {(() => {
            const defaultHeading = customer.contactName
              ? `${customer.contactName}, here's what we're seeing at ${customer.name}`
              : `An operating brief for ${customer.name}`;
            const headingValue = customer.overrides?.["hero.heading"] ?? defaultHeading;

            if (isEditing) {
              return (
                <EditableText
                  value={headingValue}
                  field="overrides.hero.heading"
                  as="h1"
                  className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6 max-w-3xl"
                  style={{ backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                />
              );
            }

            // Non-edit mode: use gradient on company name only
            return (
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6 max-w-3xl">
                {customer.overrides?.["hero.heading"] ? (
                  customer.overrides["hero.heading"]
                ) : customer.contactName ? (
                  <>
                    {customer.contactName}, here's what we're seeing at{" "}
                    <span style={{ backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {customer.name}
                    </span>
                  </>
                ) : (
                  <>
                    An operating brief for{" "}
                    <span style={{ backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {customer.name}
                    </span>
                  </>
                )}
              </h1>
            );
          })()}

          {isEditing ? (
            <EditableText
              value={subtitle}
              field="overrides.hero.subtitle"
              as="p"
              className="text-lg max-w-2xl leading-relaxed"
              style={{ color: "var(--story-muted)" }}
            />
          ) : (
            <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--story-muted)" }}>{subtitle}</p>
          )}
        </div>
      </div>
    </section>
  );
});

export default StoryHero;
