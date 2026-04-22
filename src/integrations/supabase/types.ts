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
      exercices: {
        Row: {
          alignement_test_digital: string
          bloc: string
          created_at: string
          duree_serie: string
          id: string
          indicateur_cognitif: string
          materiel: string | null
          niveau: string
          numero: number
          objectif_cognitif: string
          recuperation_secondes: number
          regle_reponse: string | null
          series: number
          source_scientifique: string | null
          stimulus_detail: Json | null
          stimulus_interval_max: number
          stimulus_interval_min: number
          stimulus_type: string
          tache_motrice: string
          titre: string
        }
        Insert: {
          alignement_test_digital?: string
          bloc?: string
          created_at?: string
          duree_serie?: string
          id?: string
          indicateur_cognitif?: string
          materiel?: string | null
          niveau?: string
          numero?: number
          objectif_cognitif?: string
          recuperation_secondes?: number
          regle_reponse?: string | null
          series?: number
          source_scientifique?: string | null
          stimulus_detail?: Json | null
          stimulus_interval_max?: number
          stimulus_interval_min?: number
          stimulus_type?: string
          tache_motrice?: string
          titre: string
        }
        Update: {
          alignement_test_digital?: string
          bloc?: string
          created_at?: string
          duree_serie?: string
          id?: string
          indicateur_cognitif?: string
          materiel?: string | null
          niveau?: string
          numero?: number
          objectif_cognitif?: string
          recuperation_secondes?: number
          regle_reponse?: string | null
          series?: number
          source_scientifique?: string | null
          stimulus_detail?: Json | null
          stimulus_interval_max?: number
          stimulus_interval_min?: number
          stimulus_type?: string
          tache_motrice?: string
          titre?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          category: Database["public"]["Enums"]["player_category"] | null
          created_at: string
          dominant_foot: Database["public"]["Enums"]["dominant_foot"] | null
          full_name: string | null
          id: string
          position: Database["public"]["Enums"]["player_position"] | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          category?: Database["public"]["Enums"]["player_category"] | null
          created_at?: string
          dominant_foot?: Database["public"]["Enums"]["dominant_foot"] | null
          full_name?: string | null
          id: string
          position?: Database["public"]["Enums"]["player_position"] | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          category?: Database["public"]["Enums"]["player_category"] | null
          created_at?: string
          dominant_foot?: Database["public"]["Enums"]["dominant_foot"] | null
          full_name?: string | null
          id?: string
          position?: Database["public"]["Enums"]["player_position"] | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      resultats_test: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          metrique: string
          session_id: string
          test_type: string
          unite: string | null
          user_id: string
          valeur: number | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          metrique: string
          session_id: string
          test_type: string
          unite?: string | null
          user_id: string
          valeur?: number | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          metrique?: string
          session_id?: string
          test_type?: string
          unite?: string | null
          user_id?: string
          valeur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resultats_test_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_test"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_test: {
        Row: {
          created_at: string
          donnees_brutes: Json | null
          duree_totale: number | null
          id: string
          score_global: number | null
          test_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          donnees_brutes?: Json | null
          duree_totale?: number | null
          id?: string
          score_global?: number | null
          test_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          donnees_brutes?: Json | null
          duree_totale?: number | null
          id?: string
          score_global?: number | null
          test_type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dominant_foot: "Droit" | "Gauche" | "Les deux"
      player_category: "U13" | "U14" | "U15" | "U16" | "U17" | "U18" | "U21"
      player_position: "Attaquant" | "Milieu" | "Défenseur" | "Gardien"
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
      dominant_foot: ["Droit", "Gauche", "Les deux"],
      player_category: ["U13", "U14", "U15", "U16", "U17", "U18", "U21"],
      player_position: ["Attaquant", "Milieu", "Défenseur", "Gardien"],
    },
  },
} as const
