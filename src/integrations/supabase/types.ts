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
      ai_config: {
        Row: {
          cards_prompt_template: string
          company_prompt: string
          id: number
          model: string
          outreach_prompt: string
          prompt_template: string
          story_prompt: string
          strategy_prompt: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          cards_prompt_template?: string
          company_prompt?: string
          id?: number
          model?: string
          outreach_prompt?: string
          prompt_template?: string
          story_prompt?: string
          strategy_prompt?: string
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          cards_prompt_template?: string
          company_prompt?: string
          id?: number
          model?: string
          outreach_prompt?: string
          prompt_template?: string
          story_prompt?: string
          strategy_prompt?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          theme: string
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
          theme?: string
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
          theme?: string
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
          clay_pushed_at: string | null
          created_at: string
          domain: string | null
          headcount: number | null
          hq_country: string | null
          id: string
          industry: string | null
          iorad_url: string | null
          is_existing_customer: boolean
          last_processed_at: string | null
          last_score_total: number | null
          loom_url: string | null
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
          clay_pushed_at?: string | null
          created_at?: string
          domain?: string | null
          headcount?: number | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          iorad_url?: string | null
          is_existing_customer?: boolean
          last_processed_at?: string | null
          last_score_total?: number | null
          loom_url?: string | null
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
          clay_pushed_at?: string | null
          created_at?: string
          domain?: string | null
          headcount?: number | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          iorad_url?: string | null
          is_existing_customer?: boolean
          last_processed_at?: string | null
          last_score_total?: number | null
          loom_url?: string | null
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
      company_cards: {
        Row: {
          account_json: Json
          assets_json: Json
          cards_json: Json
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          model_version: string | null
        }
        Insert: {
          account_json?: Json
          assets_json?: Json
          cards_json?: Json
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          model_version?: string | null
        }
        Update: {
          account_json?: Json
          assets_json?: Json
          cards_json?: Json
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          model_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      compelling_events: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          confidence: string | null
          created_at: string
          email: string | null
          id: string
          linkedin: string | null
          name: string
          reasoning: string | null
          source: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          confidence?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin?: string | null
          name: string
          reasoning?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin?: string | null
          name?: string
          reasoning?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      iorad_libraries: {
        Row: {
          created_at: string
          help_center_url: string
          id: string
          label: string
        }
        Insert: {
          created_at?: string
          help_center_url: string
          id?: string
          label: string
        }
        Update: {
          created_at?: string
          help_center_url?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          action_items: Json | null
          attendees: Json | null
          company_id: string | null
          created_at: string
          duration_seconds: number | null
          fathom_meeting_id: string
          fathom_url: string | null
          id: string
          meeting_date: string | null
          summary: string | null
          synced_at: string
          title: string
          transcript: string | null
        }
        Insert: {
          action_items?: Json | null
          attendees?: Json | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id: string
          fathom_url?: string | null
          id?: string
          meeting_date?: string | null
          summary?: string | null
          synced_at?: string
          title: string
          transcript?: string | null
        }
        Update: {
          action_items?: Json | null
          attendees?: Json | null
          company_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          fathom_meeting_id?: string
          fathom_url?: string | null
          id?: string
          meeting_date?: string | null
          summary?: string | null
          synced_at?: string
          title?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_config: {
        Row: {
          color: string
          embed_bullets: string[]
          gradient: string
          id: string
          is_active: boolean
          label: string
          positioning: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          embed_bullets?: string[]
          gradient?: string
          id: string
          is_active?: boolean
          label: string
          positioning?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          embed_bullets?: string[]
          gradient?: string
          id?: string
          is_active?: boolean
          label?: string
          positioning?: string
          sort_order?: number
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
