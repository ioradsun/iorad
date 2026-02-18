// Status enums used by StatusBadge and UI components
export type SnapshotStatus = "Generated" | "Low Signal" | "No Change" | "Error";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type JobItemStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";

// CSV upload types
export interface CSVRow {
  company_name: string;
  domain: string | null;
  partner: string | null;
  partner_rep_email: string | null;
  partner_rep_name: string | null;
  hq_country: string | null;
  industry: string | null;
  headcount: number | null;
  is_existing_customer: boolean;
  persona: string | null;
  category: string | null;
  stage: string | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}
