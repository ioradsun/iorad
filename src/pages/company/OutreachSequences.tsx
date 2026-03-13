import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { copyToClipboard } from "./types";
import { toast } from "sonner";
import type { EmailTouch, LinkedInStep } from "./types";

function copy(text: string) {
  copyToClipboard(text);
  toast.success("Copied to clipboard");
}

export function EmailSequenceUI({ emails }: { emails: Record<string, EmailTouch> }) {
  const entries = Object.entries(emails).sort();
  if (entries.length === 0) return null;
  return (
    <Accordion type="multiple" className="space-y-1.5">
      {entries.map(([key, email]) => (
        <AccordionItem key={key} value={key} className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="text-body font-medium">
              {key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {email.subject_lines?.length > 0 && (
                <div>
                  <div className="field-label mb-1.5">Subject Lines</div>
                  {email.subject_lines.map((s, i) => (
                    <div key={i} className="text-caption text-foreground/65 flex items-center gap-2">
                      <span>• {s}</span>
                      <button onClick={() => copy(s)} className="text-foreground/45 hover:text-primary"><Copy className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="field-label mb-1.5">Body</div>
                <div className="text-body text-foreground/65 whitespace-pre-wrap leading-[1.7] rounded-lg bg-foreground/[0.02] border border-border/15 p-4">{email.body}</div>
              </div>
              <Button size="sm" variant="ghost" className="gap-1 text-caption h-8" onClick={() => copy(`Subject: ${email.subject_lines?.[0] || ""}\n\n${email.body}`)}>
                <Copy className="w-3 h-3" /> Copy Full Email
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function LinkedInSequenceUI({ steps }: { steps: LinkedInStep[] }) {
  if (!steps?.length) return null;
  return (
    <Accordion type="multiple" className="space-y-1.5">
      {steps.map((step) => (
        <AccordionItem key={step.step} value={`li-${step.step}`} className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="text-body font-medium">Step {step.step} — {step.timing}</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-body text-foreground/65 whitespace-pre-wrap leading-[1.7] rounded-lg bg-foreground/[0.02] border border-border/15 p-4">{step.message}</div>
            <Button size="sm" variant="ghost" className="gap-1 text-caption h-8 mt-2" onClick={() => copy(step.message)}>
              <Copy className="w-3 h-3" /> Copy
            </Button>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
