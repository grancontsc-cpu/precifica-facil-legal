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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          contact: string | null
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          organization_id: string | null
          reason_code: string
          requested_area: string | null
          requester_id: string
          simulation_id: string | null
          status: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          organization_id?: string | null
          reason_code?: string
          requested_area?: string | null
          requester_id: string
          simulation_id?: string | null
          status?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          organization_id?: string | null
          reason_code?: string
          requested_area?: string | null
          requester_id?: string
          simulation_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bootstrap_super_admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          normalized_email: string | null
          provider: string
          provider_status: string | null
          request_reference: string | null
          request_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          normalized_email?: string | null
          provider?: string
          provider_status?: string | null
          request_reference?: string | null
          request_status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          normalized_email?: string | null
          provider?: string
          provider_status?: string | null
          request_reference?: string | null
          request_status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          feature_key: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          feature_key: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          feature_key?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      global_user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      icms_aliquotas_interestaduais: {
        Row: {
          aliquota: number
          aliquota_importado: number
          created_at: string
          created_by: string | null
          fonte: string | null
          id: string
          observacao: string | null
          uf_destino: string
          uf_origem: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota: number
          aliquota_importado?: number
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          observacao?: string | null
          uf_destino: string
          uf_origem: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          aliquota?: number
          aliquota_importado?: number
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          observacao?: string | null
          uf_destino?: string
          uf_origem?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      icms_aliquotas_internas: {
        Row: {
          aliquota: number
          created_at: string
          created_by: string | null
          fcp: number
          fonte: string | null
          id: string
          observacao: string | null
          uf: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota: number
          created_at?: string
          created_by?: string | null
          fcp?: number
          fonte?: string | null
          id?: string
          observacao?: string | null
          uf: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          aliquota?: number
          created_at?: string
          created_by?: string | null
          fcp?: number
          fonte?: string | null
          id?: string
          observacao?: string | null
          uf?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          intended_role: string
          invitation_status: string
          invited_by: string | null
          organization_id: string
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          intended_role: string
          invitation_status?: string
          invited_by?: string | null
          organization_id: string
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          intended_role?: string
          invitation_status?: string
          invited_by?: string | null
          organization_id?: string
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      license_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          license_id: string | null
          new_expiration: string | null
          new_status: string | null
          organization_id: string | null
          previous_expiration: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          license_id?: string | null
          new_expiration?: string | null
          new_status?: string | null
          organization_id?: string | null
          previous_expiration?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          license_id?: string | null
          new_expiration?: string | null
          new_status?: string | null
          organization_id?: string | null
          previous_expiration?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_events_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      license_feature_overrides: {
        Row: {
          configuration: Json
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          license_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          license_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          license_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_feature_overrides_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_feature_overrides_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string | null
          plan: string
          plan_id: string | null
          starts_at: string | null
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          plan?: string
          plan_id?: string | null
          starts_at?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          plan?: string
          plan_id?: string | null
          starts_at?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_join_requests: {
        Row: {
          created_at: string
          id: string
          normalized_cnpj: string | null
          organization_id: string | null
          requested_name: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_cnpj?: string | null
          organization_id?: string | null
          requested_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_cnpj?: string | null
          organization_id?: string | null
          requested_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_join_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          membership_status: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          membership_status?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          membership_status?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          archived_at: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          default_tax_profile_id: string | null
          defaults: Json
          icms_contribuinte: boolean
          id: string
          legal_name: string | null
          name: string
          normalized_cnpj: string | null
          regime: string | null
          status: string
          trade_name: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          default_tax_profile_id?: string | null
          defaults?: Json
          icms_contribuinte?: boolean
          id?: string
          legal_name?: string | null
          name: string
          normalized_cnpj?: string | null
          regime?: string | null
          status?: string
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          default_tax_profile_id?: string | null
          defaults?: Json
          icms_contribuinte?: boolean
          id?: string
          legal_name?: string | null
          name?: string
          normalized_cnpj?: string | null
          regime?: string | null
          status?: string
          trade_name?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_default_tax_profile_fk"
            columns: ["default_tax_profile_id"]
            isOneToOne: false
            referencedRelation: "tax_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          configuration: Json
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          default_duration_days: number | null
          description: string | null
          id: string
          name: string
          plan_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_duration_days?: number | null
          description?: string | null
          id?: string
          name: string
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_duration_days?: number | null
          description?: string | null
          id?: string
          name?: string
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          defaults: Json
          id: string
          ncm: string | null
          nome: string
          organization_id: string
          sku: string | null
          unidade: string
          updated_at: string
          valor_unitario: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          defaults?: Json
          id?: string
          ncm?: string | null
          nome: string
          organization_id: string
          sku?: string | null
          unidade?: string
          updated_at?: string
          valor_unitario?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          defaults?: Json
          id?: string
          ncm?: string | null
          nome?: string
          organization_id?: string
          sku?: string | null
          unidade?: string
          updated_at?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          created_at: string
          email: string | null
          email_verified_at: string | null
          full_name: string | null
          id: string
          last_access_at: string | null
          normalized_email: string | null
          phone: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          last_access_at?: string | null
          normalized_email?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          last_access_at?: string | null
          normalized_email?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      simulation_purchase_lines: {
        Row: {
          chave: string
          created_at: string
          descricao: string
          id: string
          simulation_id: string
          valor: number
        }
        Insert: {
          chave: string
          created_at?: string
          descricao: string
          id?: string
          simulation_id: string
          valor?: number
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string
          id?: string
          simulation_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_purchase_lines_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_sale_expenses: {
        Row: {
          chave: string
          created_at: string
          descricao: string
          id: string
          simulation_id: string
          tipo: string
          valor: number
          valor_unitario: number
        }
        Insert: {
          chave: string
          created_at?: string
          descricao: string
          id?: string
          simulation_id: string
          tipo?: string
          valor?: number
          valor_unitario?: number
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string
          id?: string
          simulation_id?: string
          tipo?: string
          valor?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_sale_expenses_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_tax_lines: {
        Row: {
          base: number
          created_at: string
          credit_mode: string | null
          credito: number
          id: string
          label: string
          rate: number
          side: string
          simulation_id: string
          tax_id: string
          treatment: string
          valor: number
        }
        Insert: {
          base?: number
          created_at?: string
          credit_mode?: string | null
          credito?: number
          id?: string
          label: string
          rate?: number
          side: string
          simulation_id: string
          tax_id: string
          treatment?: string
          valor?: number
        }
        Update: {
          base?: number
          created_at?: string
          credit_mode?: string | null
          credito?: number
          id?: string
          label?: string
          rate?: number
          side?: string
          simulation_id?: string
          tax_id?: string
          treatment?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_tax_lines_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          archived_at: string | null
          calculated_at: string
          calculation_version: string
          created_at: string
          created_by: string | null
          custo_liquido_unitario: number | null
          id: string
          input_snapshot: Json
          margem_efetiva: number | null
          organization_id: string
          overridden_fields: Json
          preco_final: number | null
          product_id: string | null
          produto_nome: string | null
          quantidade: number
          result_snapshot: Json
          status: Database["public"]["Enums"]["simulation_status"]
          tax_profile_id: string | null
          tax_profile_name: string | null
          tax_profile_snapshot: Json
          tax_profile_version: number | null
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          calculated_at?: string
          calculation_version?: string
          created_at?: string
          created_by?: string | null
          custo_liquido_unitario?: number | null
          id?: string
          input_snapshot?: Json
          margem_efetiva?: number | null
          organization_id: string
          overridden_fields?: Json
          preco_final?: number | null
          product_id?: string | null
          produto_nome?: string | null
          quantidade?: number
          result_snapshot?: Json
          status?: Database["public"]["Enums"]["simulation_status"]
          tax_profile_id?: string | null
          tax_profile_name?: string | null
          tax_profile_snapshot?: Json
          tax_profile_version?: number | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          calculated_at?: string
          calculation_version?: string
          created_at?: string
          created_by?: string | null
          custo_liquido_unitario?: number | null
          id?: string
          input_snapshot?: Json
          margem_efetiva?: number | null
          organization_id?: string
          overridden_fields?: Json
          preco_final?: number | null
          product_id?: string | null
          produto_nome?: string | null
          quantidade?: number
          result_snapshot?: Json
          status?: Database["public"]["Enums"]["simulation_status"]
          tax_profile_id?: string | null
          tax_profile_name?: string | null
          tax_profile_snapshot?: Json
          tax_profile_version?: number | null
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "tax_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_profile_lines: {
        Row: {
          base_manual: number
          base_mode: string
          base_reduction: number
          credit_manual: number
          credit_mode: string
          credit_percent: number
          enabled: boolean
          id: string
          label: string
          manual_tax_value: number
          note: string
          rate: number
          side: string
          tax_id: string
          tax_profile_id: string
          treatment: string
          use_manual_tax: boolean
        }
        Insert: {
          base_manual?: number
          base_mode?: string
          base_reduction?: number
          credit_manual?: number
          credit_mode?: string
          credit_percent?: number
          enabled?: boolean
          id?: string
          label: string
          manual_tax_value?: number
          note?: string
          rate?: number
          side: string
          tax_id: string
          tax_profile_id: string
          treatment?: string
          use_manual_tax?: boolean
        }
        Update: {
          base_manual?: number
          base_mode?: string
          base_reduction?: number
          credit_manual?: number
          credit_mode?: string
          credit_percent?: number
          enabled?: boolean
          id?: string
          label?: string
          manual_tax_value?: number
          note?: string
          rate?: number
          side?: string
          tax_id?: string
          tax_profile_id?: string
          treatment?: string
          use_manual_tax?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tax_profile_lines_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "tax_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_profiles: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          locked_fields: Json
          name: string
          notes: string | null
          organization_id: string | null
          scenario: Database["public"]["Enums"]["tax_scenario"]
          updated_at: string
          valid_from: string
          valid_to: string | null
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          locked_fields?: Json
          name: string
          notes?: string | null
          organization_id?: string | null
          scenario?: Database["public"]["Enums"]["tax_scenario"]
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          locked_fields?: Json
          name?: string
          notes?: string | null
          organization_id?: string | null
          scenario?: Database["public"]["Enums"]["tax_scenario"]
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_claims: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          normalized_cnpj: string | null
          normalized_email: string | null
          organization_id: string | null
          reason: string | null
          status: string
          trial_ends_at: string
          trial_started_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_cnpj?: string | null
          normalized_email?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          trial_ends_at: string
          trial_started_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_cnpj?: string | null
          normalized_email?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          trial_ends_at?: string
          trial_started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_grancont_admin: { Args: never; Returns: boolean }
      bootstrap_super_admin: { Args: never; Returns: boolean }
      can_access_simulation: { Args: { _sim: string }; Returns: boolean }
      can_manage_license: { Args: { _org: string }; Returns: boolean }
      can_manage_org_users: { Args: { _org: string }; Returns: boolean }
      can_read_simulation: { Args: { _sim: string }; Returns: boolean }
      can_use_feature: {
        Args: { _feature_key: string; _org: string }
        Returns: boolean
      }
      can_write_simulation: { Args: { _sim: string }; Returns: boolean }
      complete_customer_onboarding: {
        Args: {
          p_city?: string
          p_cnpj?: string
          p_company_name: string
          p_full_name: string
          p_privacy_version?: string
          p_state?: string
          p_terms_version?: string
        }
        Returns: Json
      }
      has_active_license: { Args: { _org: string }; Returns: boolean }
      has_active_trial: { Args: { _org: string }; Returns: boolean }
      has_org_role: { Args: { _org: string; _role: string }; Returns: boolean }
      has_organization_role: {
        Args: { _org: string; _role: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_access: { Args: { _org: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_grancont_admin: { Args: never; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      is_organization_member: { Args: { _org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      licenca_valida: { Args: { _user_id: string }; Returns: boolean }
      process_expired_trials: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "grancont_admin"
      org_role: "org_admin" | "viewer"
      simulation_status: "rascunho" | "salva" | "arquivada"
      tax_scenario: "atual" | "transicao" | "novo" | "personalizado"
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
      app_role: ["grancont_admin"],
      org_role: ["org_admin", "viewer"],
      simulation_status: ["rascunho", "salva", "arquivada"],
      tax_scenario: ["atual", "transicao", "novo", "personalizado"],
    },
  },
} as const
