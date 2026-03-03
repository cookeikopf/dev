/**
 * AgentLink MVP - Supabase Database Types
 * Generated types for TypeScript support
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          identity_address: string;
          owner_id: string;
          capabilities: Json;
          endpoint_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          identity_address: string;
          owner_id: string;
          capabilities?: Json;
          endpoint_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          identity_address?: string;
          owner_id?: string;
          capabilities?: Json;
          endpoint_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          agent_id: string;
          payer_address: string;
          receiver_address: string;
          amount: string;
          fee: string;
          memo: string | null;
          tx_hash: string | null;
          status: Database["public"]["Enums"]["transaction_status"];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          payer_address: string;
          receiver_address: string;
          amount: string;
          fee?: string;
          memo?: string | null;
          tx_hash?: string | null;
          status?: Database["public"]["Enums"]["transaction_status"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          payer_address?: string;
          receiver_address?: string;
          amount?: string;
          fee?: string;
          memo?: string | null;
          tx_hash?: string | null;
          status?: Database["public"]["Enums"]["transaction_status"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          }
        ];
      };
      telemetry_events: {
        Row: {
          id: string;
          agent_id: string;
          event_type: string;
          payload: Json;
          source_ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          event_type: string;
          payload?: Json;
          source_ip?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          event_type?: string;
          payload?: Json;
          source_ip?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telemetry_events_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          }
        ];
      };
      api_keys: {
        Row: {
          id: string;
          agent_id: string;
          key_hash: string;
          key_prefix: string;
          name: string | null;
          scopes: Json;
          is_active: boolean;
          last_used_at: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          key_hash: string;
          key_prefix: string;
          name?: string | null;
          scopes?: Json;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          key_hash?: string;
          key_prefix?: string;
          name?: string | null;
          scopes?: Json;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          }
        ];
      };
      rate_limits: {
        Row: {
          id: string;
          key: string;
          count: number;
          window_start: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          count?: number;
          window_start?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          count?: number;
          window_start?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      webhook_configs: {
        Row: {
          id: string;
          agent_id: string | null;
          url: string;
          secret: string;
          events: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id?: string | null;
          url: string;
          secret: string;
          events?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string | null;
          url?: string;
          secret?: string;
          events?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_configs_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          }
        ];
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event_type: string;
          payload: Json;
          response_status: number | null;
          response_body: string | null;
          delivery_attempts: number;
          delivered_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          event_type: string;
          payload: Json;
          response_status?: number | null;
          response_body?: string | null;
          delivery_attempts?: number;
          delivered_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          webhook_id?: string;
          event_type?: string;
          payload?: Json;
          response_status?: number | null;
          response_body?: string | null;
          delivery_attempts?: number;
          delivered_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey";
            columns: ["webhook_id"];
            referencedRelation: "webhook_configs";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: string;
          old_data: Json | null;
          new_data: Json | null;
          user_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: string;
          old_data?: Json | null;
          new_data?: Json | null;
          user_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          action?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          user_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      agent_summary: {
        Row: {
          id: string | null;
          name: string | null;
          identity_address: string | null;
          owner_id: string | null;
          is_active: boolean | null;
          created_at: string | null;
          total_transactions: number | null;
          confirmed_transactions: number | null;
          total_volume: string | null;
        };
        Relationships: [];
      };
      telemetry_summary: {
        Row: {
          agent_id: string | null;
          event_type: string | null;
          event_count: number | null;
          first_seen: string | null;
          last_seen: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      update_updated_at_column: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      user_owns_agent: {
        Args: {
          agent_uuid: string;
        };
        Returns: boolean;
      };
      get_agent_owner: {
        Args: {
          agent_uuid: string;
        };
        Returns: string;
      };
      verify_api_key_ownership: {
        Args: {
          key_hash: string;
          agent_uuid: string;
        };
        Returns: boolean;
      };
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      transaction_status: "pending" | "confirmed" | "failed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
