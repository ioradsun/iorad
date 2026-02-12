export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          batch_size: number
          coverage_mode: string
          id: number
          jobs_lookback_days: number
          max_companies_per_run: number
          news_lookback_days: number
          run_frequency: string
          run_time_local: string
          snapshot_max_age_days: number
          snapshot_threshold: number
          timezone: string
          top_n: number
          updated_at: string
          weekly_run_day: string
        }
        Insert: {
          batch_size?: number
          coverage_mode?: string
          id?: number
          jobs_lookback_days?: number
          max_companies_per_run?: number
          news_lookback_days?: number
          run_frequency?: string
          run_time_local?: string
          snapshot_max_age_days?: number
          snapshot_threshold?: number
          timezone?: string
          top_n?: number
          updated_at?: string
          weekly_run_day?: string
        }
        Update: {
          batch_size?: number
          coverage_mode?: string
          id?: number
          jobs_lookback_days?: number
          max_companies_per_run?: number
          news_lookback_days?: number
          run_frequency?: string
          run_time_local?: string
          snapshot_max_age_days?: number
          snapshot_threshold?: number
          timezone?: string
          top_n?: number
          updated_at?: string
          weekly_run_day?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          buyer_email: string | null
          buyer_linkedin: string | null
          buyer_name: string | null
          buyer_title: string | null
          created_at: string
          domain: string | null
          headcount: number | null
          hq_country: string | null
          id: string
          industry: string | null
          is_existing_customer: boolean
          last_processed_at: string | null
          last_score_total: number | null
          name: string
          partner: string | null
          partner_rep_email: string | null
          partner_rep_name: string | null
          persona: string | null
          snapshot_status: string | null
          updated_at: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_linkedin?: string | null
          buyer_name?: string | null
          buyer_title?: string | null
          created_at?: string
          domain?: string | null
          headcount?: number | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          is_existing_customer?: boolean
          last_processed_at?: string | null
          last_score_total?: number | null
          name: string
          partner?: string | null
          partner_rep_email?: string | null
          partner_rep_name?: string | null
          persona?: string | null
          snapshot_status?: string | null
          updated_at?: string
        }
        Update: {
          buyer_email?: string | null
          buyer_linkedin?: string | null
          buyer_name?: string | null
          buyer_title?: string | null
          created_at?: string
          domain?: string | null
          headcount?: number | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          is_existing_customer?: boolean
          last_processed_at?: string | null
          last_score_total?: number | null
          name?: string
          partner?: string | null
          partner_rep_email?: string | null
          partner_rep_name?: string | null
          persona?: string | null
          snapshot_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      processing_job_items: {
        Row: {
          company_id: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_id: string
          signals_found_count: number
          snapshot_status: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          signals_found_count?: number
          snapshot_status?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          signals_found_count?: number
          snapshot_status?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_job_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          companies_failed: number
          companies_processed: number
          companies_succeeded: number
          error_summary: string | null
          finished_at: string | null
          id: string
          settings_snapshot: Json
          started_at: string
          status: string
          total_companies_targeted: number
          trigger: string
        }
        Insert: {
          companies_failed?: number
          companies_processed?: number
          companies_succeeded?: number
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          settings_snapshot?: Json
          started_at?: string
          status?: string
          total_companies_targeted?: number
          trigger?: string
        }
        Update: {
          companies_failed?: number
          companies_processed?: number
          companies_succeeded?: number
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          settings_snapshot?: Json
          started_at?: string
          status?: string
          total_companies_targeted?: number
          trigger?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          company_id: string
          date: string | null
          discovered_at: string
          evidence_snippets: Json
          id: string
          last_seen_at: string
          raw_excerpt: string | null
          title: string
          type: string
          url: string
        }
        Insert: {
          company_id: string
          date?: string | null
          discovered_at?: string
          evidence_snippets?: Json
          id?: string
          last_seen_at?: string
          raw_excerpt?: string | null
          title: string
          type: string
          url: string
        }
        Update: {
          company_id?: string
          date?: string | null
          discovered_at?: string
          evidence_snippets?: Json
          id?: string
          last_seen_at?: string
          raw_excerpt?: string | null
          title?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          model_version: string | null
          prompt_version: string | null
          score_breakdown: Json
          score_total: number
          snapshot_json: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          model_version?: string | null
          prompt_version?: string | null
          score_breakdown?: Json
          score_total?: number
          snapshot_json?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          model_version?: string | null
          prompt_version?: string | null
          score_breakdown?: Json
          score_total?: number
          snapshot_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
