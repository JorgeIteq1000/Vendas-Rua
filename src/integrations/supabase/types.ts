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
      customers: {
        Row: {
          cpf: string | null
          created_at: string
          curso_escolhido: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_completo: string
          pdv_id: string | null
          seller_id: string | null
          telefone: string | null
          updated_at: string
          valor_inscricao: number | null
          valor_mensalidade: number | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          curso_escolhido?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_completo: string
          pdv_id?: string | null
          seller_id?: string | null
          telefone?: string | null
          updated_at?: string
          valor_inscricao?: number | null
          valor_mensalidade?: number | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          curso_escolhido?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_completo?: string
          pdv_id?: string | null
          seller_id?: string | null
          telefone?: string | null
          updated_at?: string
          valor_inscricao?: number | null
          valor_mensalidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "points_of_interest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_of_interest: {
        Row: {
          bairro: string
          cep: string | null
          coordenadas: string | null
          created_at: string
          created_by: string | null
          endereco: string
          id: string
          last_visit_at: string | null
          nome: string
          telefone: string | null
          tipo: Database["public"]["Enums"]["poi_type"]
          updated_at: string
        }
        Insert: {
          bairro: string
          cep?: string | null
          coordenadas?: string | null
          created_at?: string
          created_by?: string | null
          endereco: string
          id?: string
          last_visit_at?: string | null
          nome: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["poi_type"]
          updated_at?: string
        }
        Update: {
          bairro?: string
          cep?: string | null
          coordenadas?: string | null
          created_at?: string
          created_by?: string | null
          endereco?: string
          id?: string
          last_visit_at?: string | null
          nome?: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["poi_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_of_interest_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_neighborhoods: string[] | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          manager_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          assigned_neighborhoods?: string[] | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          assigned_neighborhoods?: string[] | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          checkin_time: string | null
          checkout_time: string | null
          collaborator_count: number | null
          created_at: string
          id: string
          point_id: string
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_time?: string | null
          checkout_time?: string | null
          collaborator_count?: number | null
          created_at?: string
          id?: string
          point_id: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_time?: string | null
          checkout_time?: string | null
          collaborator_count?: number | null
          created_at?: string
          id?: string
          point_id?: string
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "points_of_interest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_user_id_fkey"
            columns: ["user_id"]
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
      [_ in never]: never
    }
    Enums: {
      poi_type:
        | "escola"
        | "hospital"
        | "upa"
        | "clinica"
        | "empresa"
        | "comercio"
        | "outro"
      user_role: "admin" | "manager" | "seller"
      visit_status: "a_visitar" | "em_rota" | "visitado" | "finalizado"
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
      poi_type: [
        "escola",
        "hospital",
        "upa",
        "clinica",
        "empresa",
        "comercio",
        "outro",
      ],
      user_role: ["admin", "manager", "seller"],
      visit_status: ["a_visitar", "em_rota", "visitado", "finalizado"],
    },
  },
} as const
