import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { customers } from "@/data/customers";
import { partnerMeta } from "@/data/partnerMeta";
import { StoryNav } from "@/pages/CustomerList";
import {
  ArrowLeft, TrendingUp, AlertTriangle, Layers, Zap, BarChart3,
  FileText, Mail, CheckCircle2, XCircle, ArrowRight
} from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6 },
};

const SIGNATURE = "If a workflow requires a human to explain it, you don't have scale — you have dependency.";

export default function CustomerStory() {
  const { id } = useParams<{ id: string }>();
  const customer = customers.find((c) => c.id === id);
  if (!customer) return <NotFoundStory />;
  const pm = partnerMeta[customer.partner];

  const mailSubject = encodeURIComponent(`Interested in embedded iorad via ${pm.label}`);
  const mailBody = encodeURIComponent(
    `Hi Kate, I saw the ${customer.name} embedded iorad page and want to learn more about how this could work for us.`
  );
  const mailto = `mailto:kate@iorad.com?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <StoryNav />

      {/* Back link */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <Link to="/stories" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> All customers
        </Link>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
              style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
            >
              Embedded inside {pm.label}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl">
              Unlock more value from {pm.label} at{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {customer.name}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed mb-8">
              {customer.whyNow}
            </p>
            <p className="text-sm italic text-white/30 border-l-2 border-emerald-500/30 pl-4 max-w-xl">
              "{SIGNATURE}"
            </p>
          </motion.div>
        </div>
      </section>

      {/* WHY NOW */}
      <Section icon={TrendingUp} label="Why Now" title={`Why ${customer.name} needs this today`}>
        <p className="text-white/60 text-lg leading-relaxed max-w-3xl">{customer.whyNow}</p>
      </Section>

      {/* SIGNALS */}
      <Section icon={Zap} label="What We Saw" title="Signals that reveal the opportunity">
        <div className="grid md:grid-cols-2 gap-4">
          {customer.signals.map((s, i) => (
            <motion.div
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
            >
              <h4 className="font-semibold text-sm mb-2 text-emerald-400">{s.title}</h4>
              <p className="text-sm text-white/50 leading-relaxed">{s.detail}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* FRICTION */}
      <Section icon={AlertTriangle} label="The Hidden Tax" title="Where operational friction compounds">
        <div className="space-y-4">
          {customer.friction.map((f, i) => (
            <motion.div
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-5"
            >
              <h4 className="font-semibold text-sm mb-2 text-red-400">{f.title}</h4>
              <p className="text-sm text-white/50 leading-relaxed">{f.detail}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* PARTNER CEILING */}
      <Section icon={Layers} label={`The ${pm.label} Ceiling`} title={`Where ${pm.label} excels — and where it stops`}>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-4">Platform Strengths</h4>
            <ul className="space-y-3">
              {customer.partnerPlatform.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h4 className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">Execution Gaps</h4>
            <ul className="space-y-3">
              {customer.partnerPlatform.executionGaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                  <XCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* EMBEDDED IORAD LEVERAGE */}
      <Section icon={Zap} label="Embedded iorad Leverage" title="From constraint to transformation">
        <div className="grid md:grid-cols-2 gap-4">
          {(
            [
              { label: "Situation", text: customer.embeddedIorad.situation, color: "text-blue-400" },
              { label: "Constraint", text: customer.embeddedIorad.constraint, color: "text-amber-400" },
              { label: "Intervention", text: customer.embeddedIorad.intervention, color: "text-emerald-400" },
              { label: "Transformation", text: customer.embeddedIorad.transformation, color: "text-teal-300" },
            ] as const
          ).map((item, i) => (
            <motion.div
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.12 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
            >
              <p className={`text-xs font-mono uppercase tracking-widest ${item.color} mb-2`}>{item.label}</p>
              <p className="text-sm text-white/60 leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8">
          <h4 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-3">
            Where iorad embeds inside {pm.label}
          </h4>
          <ul className="space-y-2">
            {pm.embedBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                <ArrowRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* IFRAME */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <motion.div {...fade}>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400 mb-3">Embedded Walkthrough</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">See it in action</h2>
          <p className="text-white/50 max-w-2xl mb-8 leading-relaxed">
            This is what an embedded iorad tutorial looks like inside a learning path. Partners don't leave the platform — they learn by doing, right where they work.
          </p>
          <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02]" style={{ aspectRatio: "16/9" }}>
            <iframe
              src="https://ior.ad/b973?iframeHash=trysteps-1"
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
              title="iorad embedded tutorial"
            />
          </div>
        </motion.div>
      </section>

      {/* QUANTIFIED IMPACT */}
      <Section icon={BarChart3} label="Quantified Impact" title="The numbers behind the narrative">
        <div className="grid md:grid-cols-2 gap-6">
          {customer.quantifiedImpact.map((q, i) => (
            <motion.div
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.15 }}
              className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-6"
            >
              <h4 className="font-semibold mb-3">{q.title}</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-1">Assumptions</p>
                  <p className="text-white/50">{q.assumptions}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-1">Calculation</p>
                  <p className="font-mono text-emerald-400 text-xs">{q.math}</p>
                </div>
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="font-semibold text-emerald-300">{q.result}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* EXECUTIVE NARRATIVE */}
      <Section icon={FileText} label="Executive Narrative" title="The board-level view">
        <div className="space-y-5 max-w-3xl">
          {customer.executiveNarrative.map((para, i) => (
            <motion.p
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="text-white/55 leading-relaxed"
            >
              {para}
            </motion.p>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-24" id="cta">
        <motion.div {...fade} className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to unlock more value inside {pm.label}?
          </h2>
          <p className="text-white/50 max-w-xl mx-auto mb-8 leading-relaxed">
            {customer.name}'s partner enablement can move faster with iorad embedded directly inside {pm.label}. This strengthens {pm.label} adoption and ROI — not just training completion rates.
          </p>
          <a
            href={mailto}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 text-black font-semibold text-base hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Mail className="w-5 h-5" />
            Get in touch with Kate to learn more
          </a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/20">
        <p>© {new Date().getFullYear()} iorad · This analysis is confidential and prepared for {customer.name}.</p>
      </footer>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: React.ElementType;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">{label}</p>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">{title}</h2>
        {children}
      </motion.div>
    </section>
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
