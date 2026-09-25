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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_requests: {
        Row: {
          attempt_id: string
          cached_input_tokens: number | null
          completed_at: string | null
          created_at: string
          credits: number
          error_code: string | null
          feature: string
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider_response_id: string | null
          question_id: string
          reasoning_effort: string
          reasoning_tokens: number | null
          refunded_at: string | null
          request_id: string
          reserved_until: string
          response: Json | null
          status: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          cached_input_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          credits: number
          error_code?: string | null
          feature: string
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider_response_id?: string | null
          question_id: string
          reasoning_effort: string
          reasoning_tokens?: number | null
          refunded_at?: string | null
          request_id: string
          reserved_until: string
          response?: Json | null
          status: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          cached_input_tokens?: number | null
          completed_at?: string | null
          created_at?: string
          credits?: number
          error_code?: string | null
          feature?: string
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider_response_id?: string | null
          question_id?: string
          reasoning_effort?: string
          reasoning_tokens?: number | null
          refunded_at?: string | null
          request_id?: string
          reserved_until?: string
          response?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          answer: Json
          attempt_id: string
          created_at: string
          grade: Json | null
          id: string
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: Json
          attempt_id: string
          created_at?: string
          grade?: Json | null
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: Json
          attempt_id?: string
          created_at?: string
          grade?: Json | null
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_user_id_fkey"
            columns: ["attempt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      attempts: {
        Row: {
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          id: string
          incorrect_count: number | null
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submitted_at: string | null
          unanswered_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at: string
          correct_count?: number | null
          created_at?: string
          deterministic_max_score?: number | null
          deterministic_score?: number | null
          id?: string
          incorrect_count?: number | null
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submitted_at?: string | null
          unanswered_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_updated_at?: string
          correct_count?: number | null
          created_at?: string
          deterministic_max_score?: number | null
          deterministic_score?: number | null
          id?: string
          incorrect_count?: number | null
          quiz_id?: string
          quiz_revision?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          unanswered_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      password_hints: {
        Row: {
          created_at: string
          hint: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hint: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hint?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_ai_request: {
        Args: {
          p_cached_input_tokens: number
          p_input_tokens: number
          p_output_tokens: number
          p_provider_response_id: string
          p_reasoning_tokens: number
          p_request_id: string
          p_response: Json
          p_user_id: string
        }
        Returns: boolean
      }
      find_ai_request: {
        Args: {
          p_attempt_id: string
          p_feature: string
          p_model: string
          p_question_id: string
          p_reasoning_effort: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      get_ai_quota_status: { Args: { p_user_id: string }; Returns: Json }
      get_or_create_quiz_draft: {
        Args: { p_owner_id: string; p_quiz_id: string; p_quiz_revision: string }
        Returns: {
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          id: string
          incorrect_count: number | null
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submitted_at: string | null
          unanswered_count: number | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      refund_ai_request: {
        Args: { p_error_code: string; p_request_id: string; p_user_id: string }
        Returns: boolean
      }
      request_password_hint: {
        Args: { p_ip_hash: string; p_username: string }
        Returns: Json
      }
      reserve_ai_request: {
        Args: {
          p_attempt_id: string
          p_feature: string
          p_model: string
          p_question_id: string
          p_reasoning_effort: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      save_quiz_attempt: {
        Args: {
          p_expected_id?: string
          p_expected_updated_at?: string
          p_payload: Json
          p_quiz_id: string
        }
        Returns: {
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          id: string
          incorrect_count: number | null
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submitted_at: string | null
          unanswered_count: number | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_quiz_attempt_v3: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_payload: Json
        }
        Returns: {
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          id: string
          incorrect_count: number | null
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submitted_at: string | null
          unanswered_count: number | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
  public: {
    Enums: {},
  },
} as const
