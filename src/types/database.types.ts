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
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
          submitted_at: string | null
          unanswered_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_schema_version?: number
          client_updated_at: string
          correct_count?: number | null
          created_at?: string
          deterministic_max_score?: number | null
          deterministic_score?: number | null
          grading_version?: string
          id?: string
          incorrect_count?: number | null
          partial_count?: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id?: string | null
          submitted_at?: string | null
          unanswered_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_schema_version?: number
          client_updated_at?: string
          correct_count?: number | null
          created_at?: string
          deterministic_max_score?: number | null
          deterministic_score?: number | null
          grading_version?: string
          id?: string
          incorrect_count?: number | null
          partial_count?: number
          quiz_id?: string
          quiz_revision?: string
          started_at?: string
          status?: string
          submission_request_id?: string | null
          submitted_at?: string | null
          unanswered_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fill_judgments: {
        Row: {
          answer_hash: string
          attempt_id: string
          confidence: string | null
          created_at: string
          finalized_at: string
          id: string
          judge_version: string
          model: string | null
          question_id: string
          quiz_id: string
          quiz_revision: string
          reason: string | null
          reasoning_effort: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          answer_hash: string
          attempt_id: string
          confidence?: string | null
          created_at?: string
          finalized_at?: string
          id?: string
          judge_version: string
          model?: string | null
          question_id: string
          quiz_id: string
          quiz_revision: string
          reason?: string | null
          reasoning_effort?: string | null
          source: string
          status: string
          user_id: string
        }
        Update: {
          answer_hash?: string
          attempt_id?: string
          confidence?: string | null
          created_at?: string
          finalized_at?: string
          id?: string
          judge_version?: string
          model?: string | null
          question_id?: string
          quiz_id?: string
          quiz_revision?: string
          reason?: string | null
          reasoning_effort?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fill_judgments_attempt_id_user_id_fkey"
            columns: ["attempt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "user_id"]
          },
        ]
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
      rubric_judgments: {
        Row: {
          answer_hash: string
          attempt_id: string
          confidence: string | null
          created_at: string
          criteria: Json
          details: Json
          finalized_at: string
          id: string
          judge_version: string
          max_score: number
          model: string | null
          provider_response_id: string | null
          question_id: string
          question_type: string
          quiz_id: string
          quiz_revision: string
          reasoning_effort: string | null
          score: number
          source: string
          status: string
          summary: string | null
          user_id: string
        }
        Insert: {
          answer_hash: string
          attempt_id: string
          confidence?: string | null
          created_at?: string
          criteria: Json
          details?: Json
          finalized_at?: string
          id?: string
          judge_version: string
          max_score: number
          model?: string | null
          provider_response_id?: string | null
          question_id: string
          question_type: string
          quiz_id: string
          quiz_revision: string
          reasoning_effort?: string | null
          score: number
          source: string
          status: string
          summary?: string | null
          user_id: string
        }
        Update: {
          answer_hash?: string
          attempt_id?: string
          confidence?: string | null
          created_at?: string
          criteria?: Json
          details?: Json
          finalized_at?: string
          id?: string
          judge_version?: string
          max_score?: number
          model?: string | null
          provider_response_id?: string | null
          question_id?: string
          question_type?: string
          quiz_id?: string
          quiz_revision?: string
          reasoning_effort?: string | null
          score?: number
          source?: string
          status?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_judgments_attempt_id_user_id_fkey"
            columns: ["attempt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_account_recovery: {
        Args: { p_code_hash: string; p_ip_hash: string; p_username: string }
        Returns: Json
      }
      claim_fill_judgment: {
        Args: {
          p_answer_hash: string
          p_attempt_id: string
          p_expected_updated_at: string
          p_question_id: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_rubric_judgment: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_max_score: number
          p_question_id: string
          p_question_type: string
          p_quiz_id: string
          p_quiz_revision: string
          p_request_id: string
          p_system_unanswered: boolean
          p_user_id: string
        }
        Returns: Json
      }
      claim_rubric_judgment_v4: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_max_score: number
          p_question_id: string
          p_question_type: string
          p_quiz_id: string
          p_quiz_revision: string
          p_request_id: string
          p_system_unanswered: boolean
          p_user_id: string
        }
        Returns: Json
      }
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
      complete_fill_judgment: {
        Args: {
          p_cached_input_tokens: number
          p_claim_token: string
          p_confidence: string
          p_input_tokens: number
          p_output_tokens: number
          p_provider_response_id: string
          p_reason: string
          p_reasoning_tokens: number
          p_verdict: string
        }
        Returns: boolean
      }
      complete_rubric_judgment: {
        Args: {
          p_cached_input_tokens: number
          p_claim_token: string
          p_input_tokens: number
          p_output_tokens: number
          p_provider_response_id: string
          p_reasoning_tokens: number
          p_response: Json
        }
        Returns: boolean
      }
      fail_fill_judgment: {
        Args: { p_claim_token: string; p_error_code: string }
        Returns: boolean
      }
      fail_rubric_judgment: {
        Args: { p_claim_token: string; p_error_code: string }
        Returns: undefined
      }
      finalize_ai_grading_submission: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_fill_judgments: Json
          p_questions: Json
          p_quiz_id: string
          p_quiz_revision: string
          p_request_id: string
          p_result: Json
          p_rubric_judgments: Json
          p_user_id: string
        }
        Returns: {
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
      finalize_ai_grading_v4_submission: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_fill_judgments: Json
          p_questions: Json
          p_quiz_id: string
          p_quiz_revision: string
          p_request_id: string
          p_result: Json
          p_rubric_judgments: Json
          p_user_id: string
        }
        Returns: {
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
      finalize_semantic_fill_submission: {
        Args: {
          p_attempt_id: string
          p_expected_updated_at: string
          p_judgments: Json
          p_request_id: string
          p_result: Json
          p_user_id: string
        }
        Returns: {
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
      get_ai_responses_for_attempt: {
        Args: { p_attempt_id: string; p_user_id: string }
        Returns: {
          completed_at: string
          feature: string
          pending: boolean
          question_id: string
          response: Json
        }[]
      }
      get_ai_usage_page: {
        Args: {
          p_cursor_at?: string
          p_cursor_id?: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          attempt_id: string
          created_at: string
          credits: number
          feature: string
          id: string
          question_id: string
          status: string
        }[]
      }
      get_ai_usage_summary: { Args: { p_user_id: string }; Returns: Json }
      get_or_create_quiz_draft: {
        Args: { p_owner_id: string; p_quiz_id: string; p_quiz_revision: string }
        Returns: {
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
      manage_account_recovery: {
        Args: { p_code_hash?: string; p_session_id: string; p_user_id: string }
        Returns: Json
      }
      refund_ai_request: {
        Args: { p_error_code: string; p_request_id: string; p_user_id: string }
        Returns: boolean
      }
      release_account_recovery: {
        Args: { p_claim_id: string; p_user_id: string }
        Returns: string
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
      rubric_answer_hashes_v4: {
        Args: { p_attempt_id: string; p_user_id: string }
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
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
      save_quiz_attempt_v4: {
        Args: {
          p_answers: Json
          p_attempt_id: string
          p_client_updated_at: string
          p_expected_updated_at: string
          p_user_id: string
        }
        Returns: {
          answer_schema_version: number
          client_updated_at: string
          correct_count: number | null
          created_at: string
          deterministic_max_score: number | null
          deterministic_score: number | null
          grading_version: string
          id: string
          incorrect_count: number | null
          partial_count: number
          quiz_id: string
          quiz_revision: string
          started_at: string
          status: string
          submission_request_id: string | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
