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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          meta: Json
          subject_id: string
          subject_type: Database["public"]["Enums"]["custom_entity"]
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          subject_id: string
          subject_type: Database["public"]["Enums"]["custom_entity"]
          type?: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["custom_entity"]
          type?: Database["public"]["Enums"]["activity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string | null
          created_at: string
          detail: Json | null
          id: string
          status: string
          workspace_id: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          status?: string
          workspace_id: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          trigger: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actions: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          trigger: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          trigger?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          custom: Json
          email: string | null
          id: string
          name: string
          owner_id: string | null
          phone: string | null
          sector: string | null
          size: string | null
          source: string | null
          tags: string[]
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom?: Json
          email?: string | null
          id?: string
          name: string
          owner_id?: string | null
          phone?: string | null
          sector?: string | null
          size?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom?: Json
          email?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          phone?: string | null
          sector?: string | null
          size?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          custom: Json
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          owner_id: string | null
          phone: string | null
          role_title: string | null
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          owner_id?: string | null
          phone?: string | null
          role_title?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          owner_id?: string | null
          phone?: string | null
          role_title?: string | null
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          entity: Database["public"]["Enums"]["custom_entity"]
          id: string
          key: string
          label: string
          options: Json | null
          position: number
          type: Database["public"]["Enums"]["custom_field_type"]
          workspace_id: string
        }
        Insert: {
          entity: Database["public"]["Enums"]["custom_entity"]
          id?: string
          key: string
          label: string
          options?: Json | null
          position?: number
          type?: Database["public"]["Enums"]["custom_field_type"]
          workspace_id: string
        }
        Update: {
          entity?: Database["public"]["Enums"]["custom_entity"]
          id?: string
          key?: string
          label?: string
          options?: Json | null
          position?: number
          type?: Database["public"]["Enums"]["custom_field_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          expected_close: string | null
          id: string
          last_activity_at: string | null
          owner_id: string | null
          pipeline_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          stage_id: string
          status: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at: string
          value: number | null
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          last_activity_at?: string | null
          owner_id?: string | null
          pipeline_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          stage_id: string
          status?: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at?: string
          value?: number | null
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          last_activity_at?: string | null
          owner_id?: string | null
          pipeline_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          stage_id?: string
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string
          updated_at?: string
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token_enc: string
          account_email: string | null
          calendar_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc: string | null
          scopes: string[]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token_enc: string
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token_enc?: string
          account_email?: string | null
          calendar_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_enc?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          position: number
          probability: number
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          position?: number
          probability?: number
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          probability?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          calendar_provider:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          calendar_synced_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          done: boolean
          done_at: string | null
          due_at: string
          external_event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          notes: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          remind_at: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          calendar_provider?:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          calendar_synced_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          done_at?: string | null
          due_at: string
          external_event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          remind_at?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          calendar_provider?:
            | Database["public"]["Enums"]["integration_provider"]
            | null
          calendar_synced_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          done?: boolean
          done_at?: string | null
          due_at?: string
          external_event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          remind_at?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          secret: string
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          secret: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          secret?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          branding: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan?: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_admin: { Args: { ws: string }; Returns: boolean }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      activity_type:
        | "note"
        | "email"
        | "call"
        | "meeting"
        | "task"
        | "stage_change"
        | "system"
      custom_entity: "company" | "contact" | "deal"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "checkbox"
        | "url"
        | "email"
        | "phone"
      deal_status: "open" | "won" | "lost"
      integration_provider: "google" | "microsoft"
      member_role: "owner" | "admin" | "member"
      priority_level: "low" | "normal" | "high"
      task_kind: "follow_up" | "call" | "email" | "meeting" | "todo"
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
      activity_type: [
        "note",
        "email",
        "call",
        "meeting",
        "task",
        "stage_change",
        "system",
      ],
      custom_entity: ["company", "contact", "deal"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "select",
        "checkbox",
        "url",
        "email",
        "phone",
      ],
      deal_status: ["open", "won", "lost"],
      integration_provider: ["google", "microsoft"],
      member_role: ["owner", "admin", "member"],
      priority_level: ["low", "normal", "high"],
      task_kind: ["follow_up", "call", "email", "meeting", "todo"],
    },
  },
} as const
