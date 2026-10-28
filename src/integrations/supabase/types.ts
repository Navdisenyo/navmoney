export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      emi_payments: {
        Row: {
          amount: number;
          created_at: string;
          due_date: string;
          id: string;
          installment_number: number;
          loan_id: string;
          paid_date: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_date: string;
          id?: string;
          installment_number: number;
          loan_id: string;
          paid_date?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_date?: string;
          id?: string;
          installment_number?: number;
          loan_id?: string;
          paid_date?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emi_payments_loan_fk";
            columns: ["loan_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "emi_payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string;
          created_at: string;
          due_date: string;
          emi_payment_id: string | null;
          id: string;
          notes: string | null;
          payment_date: string | null;
          payment_method: string | null;
          payment_status: string;
          recurrence: string;
          recurrence_end_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id: string;
          created_at?: string;
          due_date: string;
          emi_payment_id?: string | null;
          id?: string;
          notes?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          recurrence?: string;
          recurrence_end_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string;
          created_at?: string;
          due_date?: string;
          emi_payment_id?: string | null;
          id?: string;
          notes?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          recurrence?: string;
          recurrence_end_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_fk";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_emi_payment_fk";
            columns: ["emi_payment_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "emi_payments";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      income_transactions: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          id: string;
          investment_id: string | null;
          notes: string | null;
          received_date: string;
          recurrence: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          id?: string;
          investment_id?: string | null;
          notes?: string | null;
          received_date: string;
          recurrence?: string;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          id?: string;
          investment_id?: string | null;
          notes?: string | null;
          received_date?: string;
          recurrence?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "income_transactions_investment_fk";
            columns: ["investment_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "investments";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "income_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      investments: {
        Row: {
          annual_rate: number;
          compounding_method: string;
          created_at: string;
          current_value: number | null;
          id: string;
          institution: string | null;
          maturity_date: string | null;
          name: string;
          notes: string | null;
          payout_frequency: string;
          principal_amount: number;
          rate_type: string;
          start_date: string;
          status: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          annual_rate?: number;
          compounding_method?: string;
          created_at?: string;
          current_value?: number | null;
          id?: string;
          institution?: string | null;
          maturity_date?: string | null;
          name: string;
          notes?: string | null;
          payout_frequency?: string;
          principal_amount: number;
          rate_type?: string;
          start_date: string;
          status?: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          annual_rate?: number;
          compounding_method?: string;
          created_at?: string;
          current_value?: number | null;
          id?: string;
          institution?: string | null;
          maturity_date?: string | null;
          name?: string;
          notes?: string | null;
          payout_frequency?: string;
          principal_amount?: number;
          rate_type?: string;
          start_date?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      loans: {
        Row: {
          created_at: string;
          emi_amount: number;
          end_date: string | null;
          id: string;
          interest_rate: number | null;
          lender: string | null;
          monthly_due_day: number;
          name: string;
          notes: string | null;
          original_amount: number;
          outstanding_principal: number | null;
          remaining_installments: number | null;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emi_amount: number;
          end_date?: string | null;
          id?: string;
          interest_rate?: number | null;
          lender?: string | null;
          monthly_due_day: number;
          name: string;
          notes?: string | null;
          original_amount: number;
          outstanding_principal?: number | null;
          remaining_installments?: number | null;
          start_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emi_amount?: number;
          end_date?: string | null;
          id?: string;
          interest_rate?: number | null;
          lender?: string | null;
          monthly_due_day?: number;
          name?: string;
          notes?: string | null;
          original_amount?: number;
          outstanding_principal?: number | null;
          remaining_installments?: number | null;
          start_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string;
          currency: string;
          date_format: string;
          monthly_budget: number | null;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          date_format?: string;
          monthly_budget?: number | null;
          updated_at?: string;
          user_id: string;
          week_start?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          date_format?: string;
          monthly_budget?: number | null;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
