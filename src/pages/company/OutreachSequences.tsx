import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Mail, Linkedin, Copy } from "lucide-react";
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
    <Accordion type="multiple" className="space-y-1">
      {entries.map(([key, email]) => (
        <AccordionItem key={key} value={key} className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              {key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {email.subject_lines?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">Subject Lines</div>
                  {email.subject_lines.map((s, i) => (
                    <div key={i} className="text-xs text-foreground/90 flex items-center gap-2">
                      <span>• {s}</span>
                      <button onClick={() => copy(s)} className="text-muted-foreground hover:text-primary"><Copy className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground mb-1">Body</div>
                <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3">{email.body}</div>
              </div>
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => copy(`Subject: ${email.subject_lines?.[0] || ""}\n\n${email.body}`)}>
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
    <Accordion type="multiple" className="space-y-1">
      {steps.map((step) => (
        <AccordionItem key={step.step} value={`li-${step.step}`} className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              Step {step.step} — {step.timing}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3">{step.message}</div>
            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 mt-2" onClick={() => copy(step.message)}>
              <Copy className="w-3 h-3" /> Copy
            </Button>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
