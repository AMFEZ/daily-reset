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
      ai_reflections: {
        Row: {
          action_step: string | null
          compassionate_reframe: string | null
          created_at: string
          emotional_themes: string[] | null
          freudian_lens: string | null
          id: string
          interpretation_note: string | null
          journal_entry_id: string | null
          jungian_lens: string | null
          model: string | null
          neuroscience_lens: string | null
          pattern_noticed: string | null
          prompt: string
          questions: string[] | null
          reflection_type: string
          response: string
          summary: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_step?: string | null
          compassionate_reframe?: string | null
          created_at?: string
          emotional_themes?: string[] | null
          freudian_lens?: string | null
          id?: string
          interpretation_note?: string | null
          journal_entry_id?: string | null
          jungian_lens?: string | null
          model?: string | null
          neuroscience_lens?: string | null
          pattern_noticed?: string | null
          prompt: string
          questions?: string[] | null
          reflection_type: string
          response: string
          summary?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_step?: string | null
          compassionate_reframe?: string | null
          created_at?: string
          emotional_themes?: string[] | null
          freudian_lens?: string | null
          id?: string
          interpretation_note?: string | null
          journal_entry_id?: string | null
          jungian_lens?: string | null
          model?: string | null
          neuroscience_lens?: string | null
          pattern_noticed?: string | null
          prompt?: string
          questions?: string[] | null
          reflection_type?: string
          response?: string
          summary?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reflections_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reset_reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          reminder_key: string
          sort_order: number
          time_local: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          reminder_key: string
          sort_order?: number
          time_local: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          reminder_key?: string
          sort_order?: number
          time_local?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reset_scores: {
        Row: {
          completed_protocols: number
          consistency_signal: string | null
          created_at: string
          daily_score: number
          date: string
          id: string
          is_locked: boolean
          locked_at: string | null
          morning_score: number
          night_score: number
          reset_score: number
          system_status: string | null
          total_protocols: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_protocols?: number
          consistency_signal?: string | null
          created_at?: string
          daily_score?: number
          date: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          morning_score?: number
          night_score?: number
          reset_score?: number
          system_status?: string | null
          total_protocols?: number
          trust_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_protocols?: number
          consistency_signal?: string | null
          created_at?: string
          daily_score?: number
          date?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          morning_score?: number
          night_score?: number
          reset_score?: number
          system_status?: string | null
          total_protocols?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reset_settings: {
        Row: {
          created_at: string
          display_density: string
          protein_target: number
          reduced_motion: boolean
          timezone: string
          updated_at: string
          user_id: string
          weight_unit: string
        }
        Insert: {
          created_at?: string
          display_density?: string
          protein_target?: number
          reduced_motion?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          weight_unit?: string
        }
        Update: {
          created_at?: string
          display_density?: string
          protein_target?: number
          reduced_motion?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          weight_unit?: string
        }
        Relationships: []
      }
      daily_resets: {
        Row: {
          created_at: string
          daily_score: number
          date: string
          id: string
          morning_score: number
          night_score: number
          nutrition_score: number
          reflection_score: number
          reset_score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_score?: number
          date?: string
          id?: string
          morning_score?: number
          night_score?: number
          nutrition_score?: number
          reflection_score?: number
          reset_score?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_score?: number
          date?: string
          id?: string
          morning_score?: number
          night_score?: number
          nutrition_score?: number
          reflection_score?: number
          reset_score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean
          completion_status: string
          created_at: string
          date: string
          habit_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completion_status?: string
          created_at?: string
          date?: string
          habit_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completion_status?: string
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          routine_type: string
          section: string
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          routine_type: string
          section: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          routine_type?: string
          section?: string
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          ai_reflection: string | null
          audio_path: string | null
          audio_url: string | null
          cleaned_content: string | null
          cleaned_transcript: string | null
          content: string | null
          created_at: string
          emotion: string | null
          energy: number | null
          entry_type: string | null
          id: string
          mood: string | null
          raw_transcript: string | null
          symbols: string[] | null
          tags: string[] | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_reflection?: string | null
          audio_path?: string | null
          audio_url?: string | null
          cleaned_content?: string | null
          cleaned_transcript?: string | null
          content?: string | null
          created_at?: string
          emotion?: string | null
          energy?: number | null
          entry_type?: string | null
          id?: string
          mood?: string | null
          raw_transcript?: string | null
          symbols?: string[] | null
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_reflection?: string | null
          audio_path?: string | null
          audio_url?: string | null
          cleaned_content?: string | null
          cleaned_transcript?: string | null
          content?: string | null
          created_at?: string
          emotion?: string | null
          energy?: number | null
          entry_type?: string | null
          id?: string
          mood?: string | null
          raw_transcript?: string | null
          symbols?: string[] | null
          tags?: string[] | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          protein_target: number | null
          updated_at: string
          user_id: string
          weight_unit: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          protein_target?: number | null
          updated_at?: string
          user_id: string
          weight_unit?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          protein_target?: number | null
          updated_at?: string
          user_id?: string
          weight_unit?: string | null
        }
        Relationships: []
      }
      protein_logs: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          meal_type: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          id?: string
          meal_type?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          meal_type?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reprogram_beliefs: {
        Row: {
          created_at: string
          displaced_at: string | null
          faulty_belief: string
          id: string
          intensity_score: number
          is_displaced: boolean
          reconstruction_script: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          displaced_at?: string | null
          faulty_belief: string
          id?: string
          intensity_score?: number
          is_displaced?: boolean
          reconstruction_script: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          displaced_at?: string | null
          faulty_belief?: string
          id?: string
          intensity_score?: number
          is_displaced?: boolean
          reconstruction_script?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reprogram_desires: {
        Row: {
          absence_emotions: string | null
          created_at: string
          current_emotional_satisfaction: number
          desire: string
          desire_emotions: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_emotions?: string | null
          created_at?: string
          current_emotional_satisfaction?: number
          desire: string
          desire_emotions: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_emotions?: string | null
          created_at?: string
          current_emotional_satisfaction?: number
          desire?: string
          desire_emotions?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reprogram_emotion_logs: {
        Row: {
          alignment_status: string
          created_at: string
          emotion: string
          id: string
          occurred_at: string
          trigger: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alignment_status: string
          created_at?: string
          emotion: string
          id?: string
          occurred_at?: string
          trigger: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alignment_status?: string
          created_at?: string
          emotion?: string
          id?: string
          occurred_at?: string
          trigger?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reset_goals: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          goal_type: string
          id: string
          notes: string | null
          status: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          goal_type?: string
          id?: string
          notes?: string | null
          status?: string
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          goal_type?: string
          id?: string
          notes?: string | null
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          unit: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          unit?: string
          updated_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_ai_reflection: {
        Args: {
          target_action_step?: string
          target_compassionate_reframe: string
          target_journal_entry_id: string
          target_model?: string
          target_pattern_noticed: string
          target_questions?: string[]
          target_reflection_type: string
          target_summary: string
        }
        Returns: {
          log_action_step: string
          log_compassionate_reframe: string
          log_created_at: string
          log_id: string
          log_journal_entry_id: string
          log_model: string
          log_pattern_noticed: string
          log_questions: string[]
          log_reflection_type: string
          log_summary: string
        }[]
      }
      add_dream_entry: {
        Args: {
          target_audio_path?: string
          target_cleaned_transcript?: string
          target_content: string
          target_emotion?: string
          target_mood?: string
          target_people?: string[]
          target_places?: string[]
          target_raw_transcript?: string
          target_symbols?: string[]
          target_tags?: string[]
          target_title: string
        }
        Returns: {
          log_audio_path: string
          log_cleaned_transcript: string
          log_content: string
          log_created_at: string
          log_energy: number
          log_entry_type: string
          log_id: string
          log_mood: string
          log_raw_transcript: string
          log_tags: string[]
          log_title: string
        }[]
      }
      add_journal_entry: {
        Args: {
          target_content: string
          target_energy?: number
          target_entry_type: string
          target_mood?: string
          target_tags?: string[]
          target_title: string
        }
        Returns: {
          log_content: string
          log_created_at: string
          log_energy: number
          log_entry_type: string
          log_id: string
          log_mood: string
          log_tags: string[]
          log_title: string
        }[]
      }
      add_protein_log: {
        Args: {
          target_amount: number
          target_date: string
          target_meal_type?: string
          target_note?: string
        }
        Returns: {
          log_amount: number
          log_created_at: string
          log_date: string
          log_id: string
          log_meal_type: string
          log_note: string
        }[]
      }
      add_shadow_entry: {
        Args: {
          target_emotion: string
          target_energy?: number
          target_need: string
          target_next_action: string
          target_response: string
          target_story: string
          target_trigger: string
        }
        Returns: {
          log_content: string
          log_created_at: string
          log_energy: number
          log_entry_type: string
          log_id: string
          log_mood: string
          log_tags: string[]
          log_title: string
        }[]
      }
      complete_activity_habit: {
        Args: {
          target_aliases: string[]
          target_date: string
          target_user_id: string
        }
        Returns: {
          completed_date: string
          matched_habit_id: string
          matched_habit_name: string
        }[]
      }
      complete_activity_protocol: {
        Args: {
          protocol_patterns: string[]
          target_date: string
          target_user_id: string
        }
        Returns: undefined
      }
      create_daily_reset_protocol: {
        Args: {
          target_category: string
          target_name: string
          target_routine_type: string
        }
        Returns: {
          protocol_category: string
          protocol_id: string
          protocol_is_active: boolean
          protocol_name: string
          protocol_routine_type: string
          protocol_section: string
          protocol_sort_order: number
        }[]
      }
      move_daily_reset_protocol: {
        Args: { target_direction: string; target_habit_id: string }
        Returns: {
          protocol_category: string
          protocol_id: string
          protocol_is_active: boolean
          protocol_name: string
          protocol_routine_type: string
          protocol_section: string
          protocol_sort_order: number
        }[]
      }
      normalize_protocol_name: {
        Args: { source_name: string }
        Returns: string
      }
      save_daily_reset_reminders: {
        Args: { target_reminders: Json; target_timezone: string }
        Returns: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          reminder_key: string
          sort_order: number
          time_local: string
          timezone: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_reset_reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_daily_reset_settings: {
        Args: {
          target_display_density: string
          target_protein_target: number
          target_reduced_motion: boolean
          target_timezone: string
          target_weight_unit: string
        }
        Returns: {
          setting_display_density: string
          setting_protein_target: number
          setting_reduced_motion: boolean
          setting_timezone: string
          setting_updated_at: string
          setting_user_id: string
          setting_weight_unit: string
        }[]
      }
      seed_default_habits: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      seed_default_reminders: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      seed_default_reset_settings: {
        Args: { target_protein_target?: number; target_user_id: string }
        Returns: undefined
      }
      set_daily_reset_lock: {
        Args: { target_date: string; target_locked: boolean }
        Returns: {
          lock_date: string
          lock_state: boolean
          lock_timestamp: string
        }[]
      }
      toggle_habit_and_save_reset_v2: {
        Args: {
          target_completed: boolean
          target_date: string
          target_habit_id: string
        }
        Returns: undefined
      }
      toggle_habit_log: {
        Args: {
          target_completed: boolean
          target_date: string
          target_habit_id: string
        }
        Returns: undefined
      }
      update_daily_reset_protocol: {
        Args: {
          target_category: string
          target_habit_id: string
          target_is_active: boolean
          target_name: string
          target_routine_type: string
        }
        Returns: {
          protocol_category: string
          protocol_id: string
          protocol_is_active: boolean
          protocol_name: string
          protocol_routine_type: string
          protocol_section: string
          protocol_sort_order: number
        }[]
      }
      upsert_daily_reset_score: {
        Args: {
          target_completed_protocols: number
          target_consistency_signal: string
          target_date: string
          target_reset_score: number
          target_system_status: string
          target_total_protocols: number
        }
        Returns: {
          completed_protocols: number
          consistency_signal: string | null
          created_at: string
          daily_score: number
          date: string
          id: string
          is_locked: boolean
          locked_at: string | null
          morning_score: number
          night_score: number
          reset_score: number
          system_status: string | null
          total_protocols: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_reset_scores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_weight_log: {
        Args: {
          target_date: string
          target_note?: string
          target_unit: string
          target_weight: number
        }
        Returns: {
          log_date: string
          log_id: string
          log_note: string
          log_unit: string
          log_weight: number
        }[]
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
