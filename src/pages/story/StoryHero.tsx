import { motion } from "framer-motion";
import { PartnerMeta } from "@/data/partnerMeta";
import { Customer } from "@/data/customers";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useState } from "react";

interface StoryHeroProps {
  customer: Customer;
  pm: PartnerMeta;
}

/** Map of known partner keys to local favicon files */
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
      style={{
        background: "var(--story-surface)",
        border: "1px solid var(--story-border)",
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className="h-7 w-7 md:h-8 md:w-8 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--story-muted)" }}
        >
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

export default function StoryHero({ customer, pm }: StoryHeroProps) {
  const isDark = getComputedStyle(document.documentElement)
    .getPropertyValue("--story-bg")
    .trim() === "#0A0A0F";
  const ioradLogo = isDark ? ioradLogoDark : ioradLogoLight;

  // Customer logo: Google favicon (universally available)
  const customerLogoUrl = customer.domain
    ? `https://www.google.com/s2/favicons?domain=${customer.domain}&sz=128`
    : undefined;

  // Partner logo: local file (pre-downloaded), fallback to Google favicon
  const partnerLogoUrl = partnerLogoMap[pm.key] ||
    (pm.domain ? `https://www.google.com/s2/favicons?domain=${pm.domain}&sz=128` : undefined);

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, var(--story-accent-dim), transparent, transparent)" }}
      />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* Logo lockup */}
          <motion.div
            className="flex items-center gap-0 mb-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div
              className="inline-flex items-center gap-1 md:gap-2 px-2 py-2 rounded-[1.25rem]"
              style={{
                background: "var(--story-surface)",
                border: "1px solid var(--story-border)",
              }}
            >
              {/* iorad */}
              <div
                className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: "var(--story-bg)",
                  border: "1px solid var(--story-border)",
                }}
              >
                <img src={ioradLogo} alt="iorad" className="h-5 md:h-6 object-contain" />
              </div>

              <Connector />

              {/* Partner */}
              <LogoPill
                src={partnerLogoUrl}
                alt={pm.label}
                fallbackLabel={pm.label}
              />

              <Connector />

              {/* Customer */}
              <LogoPill
                src={customerLogoUrl}
                alt={customer.name}
                fallbackLabel={customer.name}
              />
            </div>
          </motion.div>

          <span
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
            style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
          >
            Prepared for {customer.name}
          </span>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6 max-w-3xl">
            {customer.contactName ? (
              <>
                {customer.contactName}, here's what we're seeing at{" "}
                <span
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {customer.name}
                </span>
              </>
            ) : (
              <>
                An operating brief for{" "}
                <span
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {customer.name}
                </span>
              </>
            )}
          </h1>

          <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--story-muted)" }}>
            Based on public signals, here's a grounded look at where {customer.name} is heading — and where reinforcement gaps typically show up at this stage.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
