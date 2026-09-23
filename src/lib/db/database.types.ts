// Generated from the Supabase schema (supabase/migrations). Regenerate after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      projects: {
        Row: {
          annotations: Json;
          calibration: Json;
          created_at: string;
          description: string | null;
          geometry_version: number;
          id: string;
          mat: Json | null;
          model: Json | null;
          object_to_mat: Json | null;
          owner_id: string;
          published_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          view_count: number;
        };
        Insert: {
          annotations?: Json;
          calibration?: Json;
          created_at?: string;
          description?: string | null;
          geometry_version?: number;
          id: string;
          mat?: Json | null;
          model?: Json | null;
          object_to_mat?: Json | null;
          owner_id?: string;
          published_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          annotations?: Json;
          calibration?: Json;
          created_at?: string;
          description?: string | null;
          geometry_version?: number;
          id?: string;
          mat?: Json | null;
          model?: Json | null;
          object_to_mat?: Json | null;
          owner_id?: string;
          published_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_published_project: { Args: { p_id: string }; Returns: Json };
      record_view: { Args: { p_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
