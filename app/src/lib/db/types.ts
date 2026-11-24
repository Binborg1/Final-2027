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
      ai_usage: {
        Row: {
          created_at: string
          id: number
          model: string
          task: string
          teacher_id: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          created_at?: string
          id?: never
          model: string
          task: string
          teacher_id: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          created_at?: string
          id?: never
          model?: string
          task?: string
          teacher_id?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          correct: boolean | null
          id: string
          live_question_id: string
          marked_by: string | null
          marks: number | null
          participant_id: string
          response: Json
          saved_at: string
          session_id: string
          teacher_id: string
        }
        Insert: {
          correct?: boolean | null
          id?: string
          live_question_id: string
          marked_by?: string | null
          marks?: number | null
          participant_id: string
          response: Json
          saved_at?: string
          session_id: string
          teacher_id: string
        }
        Update: {
          correct?: boolean | null
          id?: string
          live_question_id?: string
          marked_by?: string | null
          marks?: number | null
          participant_id?: string
          response?: Json
          saved_at?: string
          session_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_live_question_id_session_id_fkey"
            columns: ["live_question_id", "session_id"]
            isOneToOne: false
            referencedRelation: "live_questions"
            referencedColumns: ["id", "session_id"]
          },
          {
            foreignKeyName: "answers_participant_id_session_id_fkey"
            columns: ["participant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id", "session_id"]
          },
          {
            foreignKeyName: "answers_session_id_teacher_id_fkey"
            columns: ["session_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          id: string
          outcome_refs: string[]
          position: number
          source_kind: string
          source_ref: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          outcome_refs?: string[]
          position?: number
          source_kind?: string
          source_ref?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          outcome_refs?: string[]
          position?: number
          source_kind?: string
          source_ref?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_teacher_id_fkey"
            columns: ["course_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          curriculum_course_id: string | null
          id: string
          level: number | null
          position: number
          share_on: boolean
          share_slug: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_course_id?: string | null
          id?: string
          level?: number | null
          position?: number
          share_on?: boolean
          share_slug?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_course_id?: string | null
          id?: string
          level?: number | null
          position?: number
          share_on?: boolean
          share_slug?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          created_at: string
          google_email: string
          refresh_token: string
          scopes: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          google_email: string
          refresh_token: string
          scopes?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          google_email?: string
          refresh_token?: string
          scopes?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_questions: {
        Row: {
          answer_count: number | null
          correct_count: number | null
          ends_at: string | null
          id: string
          position: number
          question_id: string
          revealed_at: string | null
          session_id: string
          started_at: string | null
          teacher_id: string
        }
        Insert: {
          answer_count?: number | null
          correct_count?: number | null
          ends_at?: string | null
          id?: string
          position: number
          question_id: string
          revealed_at?: string | null
          session_id: string
          started_at?: string | null
          teacher_id: string
        }
        Update: {
          answer_count?: number | null
          correct_count?: number | null
          ends_at?: string | null
          id?: string
          position?: number
          question_id?: string
          revealed_at?: string | null
          session_id?: string
          started_at?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_questions_question_id_teacher_id_fkey"
            columns: ["question_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "live_questions_session_id_teacher_id_fkey"
            columns: ["session_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          ask_student_no: boolean
          code: string
          course_id: string
          created_at: string
          current_question_id: string | null
          ended_at: string | null
          id: string
          state: string
          students_purged_at: string | null
          teacher_id: string
          timer_s: number
        }
        Insert: {
          ask_student_no?: boolean
          code: string
          course_id: string
          created_at?: string
          current_question_id?: string | null
          ended_at?: string | null
          id?: string
          state?: string
          students_purged_at?: string | null
          teacher_id: string
          timer_s?: number
        }
        Update: {
          ask_student_no?: boolean
          code?: string
          course_id?: string
          created_at?: string
          current_question_id?: string | null
          ended_at?: string | null
          id?: string
          state?: string
          students_purged_at?: string | null
          teacher_id?: string
          timer_s?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_course_id_teacher_id_fkey"
            columns: ["course_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "live_sessions_current_question_id_id_fkey"
            columns: ["current_question_id", "id"]
            isOneToOne: false
            referencedRelation: "live_questions"
            referencedColumns: ["id", "session_id"]
          },
        ]
      }
      participants: {
        Row: {
          id: string
          joined_at: string
          name: string
          session_id: string
          student_no: string | null
          teacher_id: string
          token_hash: string
        }
        Insert: {
          id?: string
          joined_at?: string
          name: string
          session_id: string
          student_no?: string | null
          teacher_id: string
          token_hash: string
        }
        Update: {
          id?: string
          joined_at?: string
          name?: string
          session_id?: string
          student_no?: string | null
          teacher_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_teacher_id_fkey"
            columns: ["session_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      publications: {
        Row: {
          channel: string
          external_id: string | null
          id: string
          published_at: string
          teacher_id: string
          version_id: string
        }
        Insert: {
          channel: string
          external_id?: string | null
          id?: string
          published_at?: string
          teacher_id: string
          version_id: string
        }
        Update: {
          channel?: string
          external_id?: string | null
          id?: string
          published_at?: string
          teacher_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_version_id_teacher_id_fkey"
            columns: ["version_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "resource_versions"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: Json
          answer_count: number
          chapter_id: string | null
          correct_count: number
          created_at: string
          difficulty: number | null
          fingerprint: string | null
          id: string
          last_used_at: string | null
          marks: number
          options: Json | null
          outcome_ref: string | null
          retired: boolean
          stem: string
          teacher_id: string
          times_used: number
          type: string
          updated_at: string
        }
        Insert: {
          answer: Json
          answer_count?: number
          chapter_id?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: number | null
          fingerprint?: string | null
          id?: string
          last_used_at?: string | null
          marks?: number
          options?: Json | null
          outcome_ref?: string | null
          retired?: boolean
          stem: string
          teacher_id: string
          times_used?: number
          type: string
          updated_at?: string
        }
        Update: {
          answer?: Json
          answer_count?: number
          chapter_id?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: number | null
          fingerprint?: string | null
          id?: string
          last_used_at?: string | null
          marks?: number
          options?: Json | null
          outcome_ref?: string | null
          retired?: boolean
          stem?: string
          teacher_id?: string
          times_used?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_teacher_id_fkey"
            columns: ["chapter_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "questions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_chapters: {
        Row: {
          chapter_id: string
          resource_id: string
          teacher_id: string
        }
        Insert: {
          chapter_id: string
          resource_id: string
          teacher_id: string
        }
        Update: {
          chapter_id?: string
          resource_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_chapters_chapter_id_teacher_id_fkey"
            columns: ["chapter_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "resource_chapters_resource_id_teacher_id_fkey"
            columns: ["resource_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      resource_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: Json
          created_at: string
          id: string
          number: number
          resource_id: string
          teacher_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content: Json
          created_at?: string
          id?: string
          number: number
          resource_id: string
          teacher_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: Json
          created_at?: string
          id?: string
          number?: number
          resource_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_versions_resource_id_teacher_id_fkey"
            columns: ["resource_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      resources: {
        Row: {
          course_id: string
          created_at: string
          current_version_id: string | null
          id: string
          kind: string
          status: string
          teacher_id: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind: string
          status?: string
          teacher_id: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind?: string
          status?: string
          teacher_id?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_course_id_teacher_id_fkey"
            columns: ["course_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "resources_current_version_id_id_fkey"
            columns: ["current_version_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_versions"
            referencedColumns: ["id", "resource_id"]
          },
          {
            foreignKeyName: "resources_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          chapter_id: string
          created_at: string
          file_path: string | null
          id: string
          kind: string
          teacher_id: string
          text: string | null
          title: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind: string
          teacher_id: string
          text?: string | null
          title: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          teacher_id?: string
          text?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_chapter_id_teacher_id_fkey"
            columns: ["chapter_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          grades: number[]
          id: string
          name: string
          school: string
          setup_done_at: string | null
          subjects: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          grades?: number[]
          id: string
          name?: string
          school?: string
          setup_done_at?: string | null
          subjects?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          grades?: number[]
          id?: string
          name?: string
          school?: string
          setup_done_at?: string | null
          subjects?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      template_pins: {
        Row: {
          position: number
          question_id: string
          teacher_id: string
          template_id: string
        }
        Insert: {
          position?: number
          question_id: string
          teacher_id: string
          template_id: string
        }
        Update: {
          position?: number
          question_id?: string
          teacher_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_pins_question_id_teacher_id_fkey"
            columns: ["question_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "template_pins_template_id_teacher_id_fkey"
            columns: ["template_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      templates: {
        Row: {
          built_in: boolean
          created_at: string
          format: Json
          id: string
          kind: string
          name: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          built_in?: boolean
          created_at?: string
          format?: Json
          id?: string
          kind: string
          name: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          built_in?: boolean
          created_at?: string
          format?: Json
          id?: string
          kind?: string
          name?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      version_questions: {
        Row: {
          position: number
          question_id: string
          teacher_id: string
          version_id: string
        }
        Insert: {
          position?: number
          question_id: string
          teacher_id: string
          version_id: string
        }
        Update: {
          position?: number
          question_id?: string
          teacher_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_questions_question_id_teacher_id_fkey"
            columns: ["question_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "version_questions_version_id_teacher_id_fkey"
            columns: ["version_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "resource_versions"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_version: {
        Args: { p_questions?: Json; p_version: string }
        Returns: number
      }
      purge_student_data: { Args: { older_than?: string }; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

