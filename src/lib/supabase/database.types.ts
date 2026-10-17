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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      codes_ok: { Args: { codes: string[]; pattern: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      request_connection: {
        Args: { note?: string; target: string }
        Returns: string
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
      withdraw_connection: { Args: { connection: string }; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "suspended"
      agent_kind: "education" | "recruitment" | "both"
      connection_status: "pending" | "accepted" | "declined" | "withdrawn"
      credential_kind:
        | "business_registration"
        | "oep_licence"
        | "partnership"
        | "membership"
        | "other"
      credential_status: "submitted" | "under_review" | "verified" | "rejected"
      education_level:
        | "secondary"
        | "diploma"
        | "bachelors"
        | "masters"
        | "phd"
        | "other"
      journey_goal: "study" | "work" | "both"
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
      connection_status: ["pending", "accepted", "declined", "withdrawn"],
      credential_kind: [
        "business_registration",
        "oep_licence",
        "partnership",
        "membership",
        "other",
      ],
      credential_status: ["submitted", "under_review", "verified", "rejected"],
      education_level: [
        "secondary",
        "diploma",
        "bachelors",
        "masters",
        "phd",
        "other",
      ],
      journey_goal: ["study", "work", "both"],
      user_role: ["student", "agent", "admin"],
    },
  },
} as const

