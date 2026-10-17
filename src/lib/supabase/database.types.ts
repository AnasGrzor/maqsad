export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_profiles: {
        Row: {
          about: string
          agency_name: string
          city: string
          destinations: string[]
          fees: string
          kind: Database["public"]["Enums"]["agent_kind"]
          levels: Database["public"]["Enums"]["education_level"][]
          specialisations: string[]
          updated_at: string
          user_id: string
          website: string
        }
        Insert: {
          about?: string
          agency_name: string
          city?: string
          destinations?: string[]
          fees?: string
          kind: Database["public"]["Enums"]["agent_kind"]
          levels?: Database["public"]["Enums"]["education_level"][]
          specialisations?: string[]
          updated_at?: string
          user_id: string
          website?: string
        }
        Update: {
          about?: string
          agency_name?: string
          city?: string
          destinations?: string[]
          fees?: string
          kind?: Database["public"]["Enums"]["agent_kind"]
          levels?: Database["public"]["Enums"]["education_level"][]
          specialisations?: string[]
          updated_at?: string
          user_id?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          actor_id: string
          case_id: string
          created_at: string
          detail: Json
          id: number
          kind: string
        }
        Insert: {
          actor_id: string
          case_id: string
          created_at?: string
          detail?: Json
          id?: never
          kind: string
        }
        Update: {
          actor_id?: string
          case_id?: string
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_items: {
        Row: {
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          details: string
          due_on: string | null
          id: string
          kind: Database["public"]["Enums"]["case_item_kind"]
          status: Database["public"]["Enums"]["case_item_status"]
          title: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          details?: string
          due_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["case_item_kind"]
          status?: Database["public"]["Enums"]["case_item_status"]
          title: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          details?: string
          due_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["case_item_kind"]
          status?: Database["public"]["Enums"]["case_item_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_records: {
        Row: {
          amount: number | null
          case_id: string
          corrects: string | null
          created_at: string
          currency: string | null
          id: string
          kind: Database["public"]["Enums"]["case_record_kind"]
          on_date: string | null
          recorded_by: string
          summary: string
        }
        Insert: {
          amount?: number | null
          case_id: string
          corrects?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          kind: Database["public"]["Enums"]["case_record_kind"]
          on_date?: string | null
          recorded_by: string
          summary: string
        }
        Update: {
          amount?: number | null
          case_id?: string
          corrects?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["case_record_kind"]
          on_date?: string | null
          recorded_by?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_records_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_records_corrects_fkey"
            columns: ["corrects"]
            isOneToOne: false
            referencedRelation: "case_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          agent_id: string
          connection_id: string
          country: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["case_kind"]
          opened_by: string
          status: Database["public"]["Enums"]["case_status"]
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          connection_id: string
          country: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["case_kind"]
          opened_by: string
          status?: Database["public"]["Enums"]["case_status"]
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          connection_id?: string
          country?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["case_kind"]
          opened_by?: string
          status?: Database["public"]["Enums"]["case_status"]
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          message: string
          requested_by: string
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          student_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          message?: string
          requested_by: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          student_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          message?: string
          requested_by?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          agent_id: string
          created_at: string
          document_path: string | null
          id: string
          issuer: string
          kind: Database["public"]["Enums"]["credential_kind"]
          reference: string
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["credential_status"]
        }
        Insert: {
          agent_id: string
          created_at?: string
          document_path?: string | null
          id?: string
          issuer: string
          kind: Database["public"]["Enums"]["credential_kind"]
          reference?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Update: {
          agent_id?: string
          created_at?: string
          document_path?: string | null
          id?: string
          issuer?: string
          kind?: Database["public"]["Enums"]["credential_kind"]
          reference?: string
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Relationships: [
          {
            foreignKeyName: "credentials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          against: string
          case_id: string | null
          connection_id: string
          created_at: string
          details: string
          id: string
          kind: Database["public"]["Enums"]["dispute_kind"]
          raised_by: string
          reason: Database["public"]["Enums"]["dispute_reason"]
          record_id: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          against: string
          case_id?: string | null
          connection_id: string
          created_at?: string
          details: string
          id?: string
          kind: Database["public"]["Enums"]["dispute_kind"]
          raised_by: string
          reason: Database["public"]["Enums"]["dispute_reason"]
          record_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          against?: string
          case_id?: string | null
          connection_id?: string
          created_at?: string
          details?: string
          id?: string
          kind?: Database["public"]["Enums"]["dispute_kind"]
          raised_by?: string
          reason?: Database["public"]["Enums"]["dispute_reason"]
          record_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_against_fkey"
            columns: ["against"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "case_records"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          case_id: string | null
          connection_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          case_id?: string | null
          connection_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          case_id?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          case_id: string | null
          connection_id: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id: string
          case_id?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string
          case_id?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          audience: Database["public"]["Enums"]["user_role"]
          features: string[]
          id: string
          offered: boolean
          price_monthly_pkr: number | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          verification_reports_per_month: number | null
        }
        Insert: {
          audience: Database["public"]["Enums"]["user_role"]
          features?: string[]
          id: string
          offered?: boolean
          price_monthly_pkr?: number | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          verification_reports_per_month?: number | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["user_role"]
          features?: string[]
          id?: string
          offered?: boolean
          price_monthly_pkr?: number | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          verification_reports_per_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          destinations: string[]
          education_level: Database["public"]["Enums"]["education_level"]
          experience: string
          field: string
          goal: Database["public"]["Enums"]["journey_goal"]
          goals_note: string
          qualifications: string
          skills: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          destinations?: string[]
          education_level: Database["public"]["Enums"]["education_level"]
          experience?: string
          field: string
          goal: Database["public"]["Enums"]["journey_goal"]
          goals_note?: string
          qualifications?: string
          skills?: string
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          destinations?: string[]
          education_level?: Database["public"]["Enums"]["education_level"]
          experience?: string
          field?: string
          goal?: Database["public"]["Enums"]["journey_goal"]
          goals_note?: string
          qualifications?: string
          skills?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          id: string
          message: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          message?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          message?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string
          plan_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string
          plan_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_reports: {
        Row: {
          case_id: string | null
          created_at: string
          doc_type: string
          findings: Json
          id: string
          issuer_name: string
          official_contact: Json | null
          owner_id: string
          risk: string
          summary_en: string
          summary_ur: string
          warnings: Json
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          doc_type: string
          findings?: Json
          id?: string
          issuer_name?: string
          official_contact?: Json | null
          owner_id: string
          risk: string
          summary_en?: string
          summary_ur?: string
          warnings?: Json
        }
        Update: {
          case_id?: string | null
          created_at?: string
          doc_type?: string
          findings?: Json
          id?: string
          issuer_name?: string
          official_contact?: Json | null
          owner_id?: string
          risk?: string
          summary_en?: string
          summary_ur?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "verification_reports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_case_item: {
        Args: {
          details?: string
          due_on?: string
          kind: Database["public"]["Enums"]["case_item_kind"]
          target_case: string
          title: string
        }
        Returns: string
      }
      add_case_record: {
        Args: {
          amount?: number
          correction_of?: string
          currency?: string
          kind: Database["public"]["Enums"]["case_record_kind"]
          on_date?: string
          summary: string
          target_case: string
        }
        Returns: string
      }
      allowance: { Args: { kind?: string }; Returns: Json }
      codes_ok: { Args: { codes: string[]; pattern: string }; Returns: boolean }
      current_plan: { Args: never; Returns: string }
      decide_plan_request: {
        Args: { approve: boolean; note?: string; request: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_case_party: { Args: { target_case: string }; Returns: boolean }
      is_connection_party: { Args: { connection: string }; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      open_case: {
        Args: {
          connection: string
          country: string
          kind: Database["public"]["Enums"]["case_kind"]
          title: string
        }
        Returns: string
      }
      plan_allows: { Args: { feature: string }; Returns: boolean }
      plan_of: { Args: { who: string }; Returns: string }
      raise_dispute: {
        Args: {
          connection: string
          details: string
          kind: Database["public"]["Enums"]["dispute_kind"]
          reason: Database["public"]["Enums"]["dispute_reason"]
          target_case?: string
          target_record?: string
        }
        Returns: string
      }
      request_connection: {
        Args: { note?: string; target: string }
        Returns: string
      }
      request_plan: { Args: { note?: string; plan: string }; Returns: string }
      require_case: {
        Args: { action: string; target_case: string }
        Returns: {
          agent_id: string
          connection_id: string
          country: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["case_kind"]
          opened_by: string
          status: Database["public"]["Enums"]["case_status"]
          student_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_connection: {
        Args: { action: string; connection: string }
        Returns: {
          agent_id: string
          created_at: string
          id: string
          message: string
          requested_by: string
          responded_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_connection: {
        Args: { accept: boolean; connection: string }
        Returns: undefined
      }
      review_credential: {
        Args: {
          credential: string
          note?: string
          verdict: Database["public"]["Enums"]["credential_status"]
        }
        Returns: undefined
      }
      send_message: {
        Args: { body: string; connection: string; target_case?: string }
        Returns: string
      }
      set_case_status: {
        Args: {
          new_status: Database["public"]["Enums"]["case_status"]
          target_case: string
        }
        Returns: undefined
      }
      set_item_status: {
        Args: { done: boolean; item: string }
        Returns: undefined
      }
      update_plan: {
        Args: {
          is_offered: boolean
          plan: string
          price: number
          reports: number
        }
        Returns: undefined
      }
      usage_month_start: { Args: { ts: string }; Returns: string }
      use_allowance: { Args: { kind?: string }; Returns: Json }
      withdraw_connection: { Args: { connection: string }; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "suspended"
      agent_kind: "education" | "recruitment" | "both"
      case_item_kind:
        | "requirement"
        | "document_request"
        | "milestone"
        | "deadline"
      case_item_status: "open" | "done"
      case_kind: "study" | "work"
      case_record_kind:
        | "fee_disclosed"
        | "responsibility"
        | "promise"
        | "expected_date"
        | "terms_change"
        | "payment_reported"
      case_status: "active" | "completed" | "closed"
      connection_status: "pending" | "accepted" | "declined" | "withdrawn"
      credential_kind:
        | "business_registration"
        | "oep_licence"
        | "partnership"
        | "membership"
        | "other"
      credential_status: "submitted" | "under_review" | "verified" | "rejected"
      dispute_kind: "report" | "dispute"
      dispute_reason:
        | "misleading_information"
        | "undisclosed_fees"
        | "fee_dispute"
        | "missed_commitment"
        | "document_concern"
        | "pressure_tactics"
        | "harassment"
        | "impersonation"
        | "other"
      dispute_status: "open" | "under_review" | "resolved" | "dismissed"
      education_level:
        | "secondary"
        | "diploma"
        | "bachelors"
        | "masters"
        | "phd"
        | "other"
      journey_goal: "study" | "work" | "both"
      subscription_request_status: "pending" | "approved" | "declined"
      user_role: "student" | "agent" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "suspended"],
      agent_kind: ["education", "recruitment", "both"],
      case_item_kind: [
        "requirement",
        "document_request",
        "milestone",
        "deadline",
      ],
      case_item_status: ["open", "done"],
      case_kind: ["study", "work"],
      case_record_kind: [
        "fee_disclosed",
        "responsibility",
        "promise",
        "expected_date",
        "terms_change",
        "payment_reported",
      ],
      case_status: ["active", "completed", "closed"],
      connection_status: ["pending", "accepted", "declined", "withdrawn"],
      credential_kind: [
        "business_registration",
        "oep_licence",
        "partnership",
        "membership",
        "other",
      ],
      credential_status: ["submitted", "under_review", "verified", "rejected"],
      dispute_kind: ["report", "dispute"],
      dispute_reason: [
        "misleading_information",
        "undisclosed_fees",
        "fee_dispute",
        "missed_commitment",
        "document_concern",
        "pressure_tactics",
        "harassment",
        "impersonation",
        "other",
      ],
      dispute_status: ["open", "under_review", "resolved", "dismissed"],
      education_level: [
        "secondary",
        "diploma",
        "bachelors",
        "masters",
        "phd",
        "other",
      ],
      journey_goal: ["study", "work", "both"],
      subscription_request_status: ["pending", "approved", "declined"],
      user_role: ["student", "agent", "admin"],
    },
  },
} as const

