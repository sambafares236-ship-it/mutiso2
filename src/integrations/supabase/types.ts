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
      activity: {
        Row: {
          activity_code: string | null
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          milestone_id: string | null
          name: string
          parent_id: string | null
          percent_complete: number
          planned_end: string | null
          planned_start: string | null
          responsible_party: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_code?: string | null
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          name: string
          parent_id?: string | null
          percent_complete?: number
          planned_end?: string | null
          planned_start?: string | null
          responsible_party?: string | null
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_code?: string | null
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          name?: string
          parent_id?: string | null
          percent_complete?: number
          planned_end?: string | null
          planned_start?: string | null
          responsible_party?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "site_milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      activity_dependency: {
        Row: {
          activity_id: string
          created_at: string
          depends_on_id: string
          id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          depends_on_id: string
          id?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          depends_on_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_dependency_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_dependency_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
        ]
      }
      actual_cost: {
        Row: {
          activity_id: string | null
          amount: number
          cost_type: string
          created_at: string
          created_by: string
          date_incurred: string
          id: string
          invoice_reference: string | null
          material_delivery_id: string | null
          site_id: string
          subcontractor_id: string | null
        }
        Insert: {
          activity_id?: string | null
          amount: number
          cost_type: string
          created_at?: string
          created_by: string
          date_incurred?: string
          id?: string
          invoice_reference?: string | null
          material_delivery_id?: string | null
          site_id: string
          subcontractor_id?: string | null
        }
        Update: {
          activity_id?: string | null
          amount?: number
          cost_type?: string
          created_at?: string
          created_by?: string
          date_incurred?: string
          id?: string
          invoice_reference?: string | null
          material_delivery_id?: string | null
          site_id?: string
          subcontractor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actual_cost_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_cost_material_delivery_id_fkey"
            columns: ["material_delivery_id"]
            isOneToOne: false
            referencedRelation: "materials_delivered"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_cost_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_cost_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "actual_cost_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractor"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_log: {
        Row: {
          created_at: string
          date: string
          id: string
          marked_by: string
          site_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          marked_by: string
          site_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          marked_by?: string
          site_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "attendance_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_item: {
        Row: {
          activity_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          item_code: string
          quantity: number
          site_id: string
          total_amount: number | null
          unit: string | null
          unit_rate: number
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          item_code: string
          quantity: number
          site_id: string
          total_amount?: number | null
          unit?: string | null
          unit_rate: number
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          item_code?: string
          quantity?: number
          site_id?: string
          total_amount?: number | null
          unit?: string | null
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "boq_item_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_item_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_item_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      budget_line: {
        Row: {
          activity_id: string | null
          budgeted_amount: number
          category: string
          cost_code: string | null
          created_at: string
          created_by: string
          id: string
          site_id: string
        }
        Insert: {
          activity_id?: string | null
          budgeted_amount: number
          category: string
          cost_code?: string | null
          created_at?: string
          created_by: string
          id?: string
          site_id: string
        }
        Update: {
          activity_id?: string | null
          budgeted_amount?: number
          category?: string
          cost_code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      certification: {
        Row: {
          cert_name: string
          cert_number: string | null
          created_at: string
          created_by: string
          expiry_date: string
          id: string
          issued_date: string | null
          site_id: string
          subject_type: string
          tool_id: string | null
          worker_id: string | null
        }
        Insert: {
          cert_name: string
          cert_number?: string | null
          created_at?: string
          created_by: string
          expiry_date: string
          id?: string
          issued_date?: string | null
          site_id: string
          subject_type: string
          tool_id?: string | null
          worker_id?: string | null
        }
        Update: {
          cert_name?: string
          cert_number?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string
          id?: string
          issued_date?: string | null
          site_id?: string
          subject_type?: string
          tool_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certification_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "certification_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tool_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_log: {
        Row: {
          activity_id: string | null
          created_at: string
          description: string
          fixed_at: string | null
          fixed_by: string | null
          fixed_photo_url: string | null
          id: string
          location: string | null
          photo_url: string | null
          reported_by: string
          severity: string
          site_id: string
          status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          description: string
          fixed_at?: string | null
          fixed_by?: string | null
          fixed_photo_url?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          reported_by: string
          severity?: string
          site_id: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          description?: string
          fixed_at?: string | null
          fixed_by?: string | null
          fixed_photo_url?: string | null
          id?: string
          location?: string | null
          photo_url?: string | null
          reported_by?: string
          severity?: string
          site_id?: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      equipment_maintenance_log: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          maintenance_type: string
          next_due_date: string | null
          performed_at: string
          performed_by: string | null
          site_id: string
          tool_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          maintenance_type: string
          next_due_date?: string | null
          performed_at?: string
          performed_by?: string | null
          site_id: string
          tool_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          maintenance_type?: string
          next_due_date?: string | null
          performed_at?: string
          performed_by?: string | null
          site_id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "equipment_maintenance_log_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tool_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_log: {
        Row: {
          category: string
          closed_at: string | null
          closed_by: string | null
          corrective_action: string | null
          created_at: string
          date: string
          description: string
          id: string
          photo_url: string | null
          reported_by: string
          severity: string
          site_id: string
          workers_involved: string | null
        }
        Insert: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          corrective_action?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          photo_url?: string | null
          reported_by: string
          severity?: string
          site_id: string
          workers_involved?: string | null
        }
        Update: {
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          corrective_action?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          photo_url?: string | null
          reported_by?: string
          severity?: string
          site_id?: string
          workers_involved?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      inspection_log: {
        Row: {
          created_at: string
          date: string
          flagged_count: number
          id: string
          inspected_by: string
          results: Json
          site_id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          flagged_count?: number
          id?: string
          inspected_by: string
          results: Json
          site_id: string
          template_id: string
        }
        Update: {
          created_at?: string
          date?: string
          flagged_count?: number
          id?: string
          inspected_by?: string
          results?: Json
          site_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "inspection_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_template"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_template: {
        Row: {
          category: string
          created_at: string
          id: string
          items: Json
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          items: Json
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          items?: Json
          name?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          site_id: string
          token: string
          used: boolean
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          site_id: string
          token?: string
          used?: boolean
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          site_id?: string
          token?: string
          used?: boolean
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      material_inventory: {
        Row: {
          current_quantity: number
          id: string
          last_updated: string
          material_name: string
          site_id: string
          unit: string | null
        }
        Insert: {
          current_quantity?: number
          id?: string
          last_updated?: string
          material_name: string
          site_id: string
          unit?: string | null
        }
        Update: {
          current_quantity?: number
          id?: string
          last_updated?: string
          material_name?: string
          site_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      material_usage_log: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          material_name: string
          quantity: number
          site_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          material_name: string
          quantity: number
          site_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          material_name?: string
          quantity?: number
          site_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_usage_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_usage_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      materials_delivered: {
        Row: {
          created_at: string
          created_by: string
          date: string
          id: string
          material_name: string
          quantity: number
          receipt_photo_url: string | null
          site_id: string
          supplier: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string
          id?: string
          material_name: string
          quantity: number
          receipt_photo_url?: string | null
          site_id: string
          supplier?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          material_name?: string
          quantity?: number
          receipt_photo_url?: string | null
          site_id?: string
          supplier?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_delivered_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_delivered_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string | null
          recipient_role: Database["public"]["Enums"]["app_role"] | null
          related_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string | null
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          related_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string | null
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          related_id?: string | null
          type?: string
        }
        Relationships: []
      }
      payment_certificate: {
        Row: {
          certificate_number: number
          certified_at: string | null
          certified_by: string | null
          created_at: string
          created_by: string
          id: string
          net_amount_due: number
          period_end: string
          period_start: string
          previous_payments_total: number
          retention_amount: number
          retention_percentage: number
          site_id: string
          status: string
          work_completed_value: number
        }
        Insert: {
          certificate_number: number
          certified_at?: string | null
          certified_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          net_amount_due: number
          period_end: string
          period_start: string
          previous_payments_total?: number
          retention_amount: number
          retention_percentage?: number
          site_id: string
          status?: string
          work_completed_value: number
        }
        Update: {
          certificate_number?: number
          certified_at?: string | null
          certified_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          net_amount_due?: number
          period_end?: string
          period_start?: string
          previous_payments_total?: number
          retention_amount?: number
          retention_percentage?: number
          site_id?: string
          status?: string
          work_completed_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_certificate_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_certificate_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      payroll_line: {
        Row: {
          advances: number
          daily_rate: number
          days_present: number
          deductions: number
          gross_amount: number
          id: string
          net_amount: number
          paid: boolean
          paid_at: string | null
          paid_by: string | null
          payroll_run_id: string
          worker_id: string
        }
        Insert: {
          advances?: number
          daily_rate: number
          days_present?: number
          deductions?: number
          gross_amount: number
          id?: string
          net_amount: number
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          payroll_run_id: string
          worker_id: string
        }
        Update: {
          advances?: number
          daily_rate?: number
          days_present?: number
          deductions?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          paid?: boolean
          paid_at?: string | null
          paid_by?: string | null
          payroll_run_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_run: {
        Row: {
          created_at: string
          created_by: string
          id: string
          site_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          site_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          site_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_run_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_run_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      petty_cash_log: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          receipt_photo_url: string | null
          site_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          date?: string
          description: string
          id?: string
          receipt_photo_url?: string | null
          site_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          receipt_photo_url?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email_address: string | null
          full_name: string | null
          id: string
          mpesa_phone_number: string | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          full_name?: string | null
          id: string
          mpesa_phone_number?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_address?: string | null
          full_name?: string | null
          id?: string
          mpesa_phone_number?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resource_plan: {
        Row: {
          activity_id: string | null
          category: string
          created_at: string
          created_by: string
          id: string
          planned_cost: number | null
          planned_quantity: number | null
          resource_type: string
          site_id: string
        }
        Insert: {
          activity_id?: string | null
          category: string
          created_at?: string
          created_by: string
          id?: string
          planned_cost?: number | null
          planned_quantity?: number | null
          resource_type: string
          site_id: string
        }
        Update: {
          activity_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          planned_cost?: number | null
          planned_quantity?: number | null
          resource_type?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_plan_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_plan_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_plan_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      schedule_baseline: {
        Row: {
          created_by: string
          id: string
          label: string | null
          locked_at: string
          site_id: string
        }
        Insert: {
          created_by: string
          id?: string
          label?: string | null
          locked_at?: string
          site_id: string
        }
        Update: {
          created_by?: string
          id?: string
          label?: string | null
          locked_at?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_baseline_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_baseline_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      schedule_baseline_activity: {
        Row: {
          activity_code: string | null
          activity_id: string | null
          baseline_id: string
          id: string
          name: string
          planned_end: string | null
          planned_start: string | null
        }
        Insert: {
          activity_code?: string | null
          activity_id?: string | null
          baseline_id: string
          id?: string
          name: string
          planned_end?: string | null
          planned_start?: string | null
        }
        Update: {
          activity_code?: string | null
          activity_id?: string | null
          baseline_id?: string
          id?: string
          name?: string
          planned_end?: string | null
          planned_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_baseline_activity_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_baseline_activity_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "schedule_baseline"
            referencedColumns: ["id"]
          },
        ]
      }
      site_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          foreman_id: string
          id: string
          is_active: boolean
          site_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          foreman_id: string
          id?: string
          is_active?: boolean
          site_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          foreman_id?: string
          id?: string
          is_active?: boolean
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      site_contract: {
        Row: {
          contract_document_url: string | null
          contract_type: string | null
          contract_value: number | null
          created_at: string
          created_by: string
          currency: string
          id: string
          payment_terms: string | null
          retention_percentage: number | null
          signed_date: string | null
          site_id: string
          updated_at: string
        }
        Insert: {
          contract_document_url?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          payment_terms?: string | null
          retention_percentage?: number | null
          signed_date?: string | null
          site_id: string
          updated_at?: string
        }
        Update: {
          contract_document_url?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          payment_terms?: string | null
          retention_percentage?: number | null
          signed_date?: string | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_contract_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_contract_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      site_diary_log: {
        Row: {
          activity_id: string | null
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          site_id: string
          title: string
        }
        Insert: {
          activity_id?: string | null
          category?: string
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          site_id: string
          title: string
        }
        Update: {
          activity_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          site_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_diary_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_diary_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_diary_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      site_milestone: {
        Row: {
          created_at: string
          id: string
          inspected_by: string | null
          name: string
          sequence: number
          signed_off_at: string | null
          site_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspected_by?: string | null
          name: string
          sequence: number
          signed_off_at?: string | null
          site_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspected_by?: string | null
          name?: string
          sequence?: number
          signed_off_at?: string | null
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_milestone_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_milestone_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      site_photos: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          diary_id: string | null
          id: string
          photo_url: string
          site_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          category?: string
          created_at?: string
          diary_id?: string | null
          id?: string
          photo_url: string
          site_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          diary_id?: string | null
          id?: string
          photo_url?: string
          site_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_photos_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "site_diary_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_photos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_photos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      sites: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location: string | null
          location_recapture_requested_at: string | null
          longitude: number | null
          owner_id: string
          site_name: string
          status: string
          subscription_end: string | null
          subscription_start: string | null
          subscription_tier: string
          updated_at: string
          whatsapp_bot_enabled: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          location_recapture_requested_at?: string | null
          longitude?: number | null
          owner_id: string
          site_name: string
          status?: string
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_tier?: string
          updated_at?: string
          whatsapp_bot_enabled?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          location_recapture_requested_at?: string | null
          longitude?: number | null
          owner_id?: string
          site_name?: string
          status?: string
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_tier?: string
          updated_at?: string
          whatsapp_bot_enabled?: boolean
        }
        Relationships: []
      }
      subcontractor: {
        Row: {
          company_name: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          insurance_expiry: string | null
          nca_number: string | null
          site_id: string
          trade: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          nca_number?: string | null
          site_id: string
          trade?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          nca_number?: string | null
          site_id?: string
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      subcontractor_work_order: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          site_id: string
          status: string
          subcontractor_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          site_id: string
          status?: string
          subcontractor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          site_id?: string
          status?: string
          subcontractor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_work_order_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_work_order_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "subcontractor_work_order_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractor"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment: {
        Row: {
          amount: number
          checkout_request_id: string
          completed_at: string | null
          id: string
          includes_bot: boolean
          initiated_at: string
          initiated_by: string | null
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          payment_method: string
          phone_number: string
          site_id: string
          status: string
        }
        Insert: {
          amount: number
          checkout_request_id: string
          completed_at?: string | null
          id?: string
          includes_bot?: boolean
          initiated_at?: string
          initiated_by?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_method?: string
          phone_number: string
          site_id: string
          status?: string
        }
        Update: {
          amount?: number
          checkout_request_id?: string
          completed_at?: string | null
          id?: string
          includes_bot?: boolean
          initiated_at?: string
          initiated_by?: string | null
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          payment_method?: string
          phone_number?: string
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      tool_checkout_log: {
        Row: {
          checked_out_at: string
          checked_out_by: string
          checked_out_to: string
          condition_on_return: string | null
          id: string
          meter_reading_in: number | null
          meter_reading_out: number | null
          notes: string | null
          returned_at: string | null
          site_id: string
          tool_id: string
          worker_id: string | null
        }
        Insert: {
          checked_out_at?: string
          checked_out_by: string
          checked_out_to: string
          condition_on_return?: string | null
          id?: string
          meter_reading_in?: number | null
          meter_reading_out?: number | null
          notes?: string | null
          returned_at?: string | null
          site_id: string
          tool_id: string
          worker_id?: string | null
        }
        Update: {
          checked_out_at?: string
          checked_out_by?: string
          checked_out_to?: string
          condition_on_return?: string | null
          id?: string
          meter_reading_in?: number | null
          meter_reading_out?: number | null
          notes?: string | null
          returned_at?: string | null
          site_id?: string
          tool_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_checkout_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_checkout_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
          {
            foreignKeyName: "tool_checkout_log_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tool_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_checkout_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_inventory: {
        Row: {
          category: string
          condition_notes: string | null
          created_at: string
          current_holder_name: string | null
          id: string
          meter_unit: string | null
          site_id: string
          status: string
          tool_id_number: string | null
          tool_name: string
        }
        Insert: {
          category?: string
          condition_notes?: string | null
          created_at?: string
          current_holder_name?: string | null
          id?: string
          meter_unit?: string | null
          site_id: string
          status?: string
          tool_id_number?: string | null
          tool_name: string
        }
        Update: {
          category?: string
          condition_notes?: string | null
          created_at?: string
          current_holder_name?: string | null
          id?: string
          meter_unit?: string | null
          site_id?: string
          status?: string
          tool_id_number?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_inventory_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      toolbox_talk_attendance: {
        Row: {
          created_at: string
          id: string
          toolbox_talk_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          toolbox_talk_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          toolbox_talk_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_attendance_toolbox_talk_id_fkey"
            columns: ["toolbox_talk_id"]
            isOneToOne: false
            referencedRelation: "toolbox_talk_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_talk_attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers_master"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talk_log: {
        Row: {
          conducted_by: string
          created_at: string
          date: string
          id: string
          site_id: string
          topic: string
        }
        Insert: {
          conducted_by: string
          created_at?: string
          date?: string
          id?: string
          site_id: string
          topic: string
        }
        Update: {
          conducted_by?: string
          created_at?: string
          date?: string
          id?: string
          site_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_talk_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
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
      variation_order: {
        Row: {
          cost_impact: number | null
          created_at: string
          decided_by: string | null
          description: string
          id: string
          raised_by: string
          site_id: string
          status: string
          time_impact_days: number | null
          title: string
        }
        Insert: {
          cost_impact?: number | null
          created_at?: string
          decided_by?: string | null
          description: string
          id?: string
          raised_by: string
          site_id: string
          status?: string
          time_impact_days?: number | null
          title: string
        }
        Update: {
          cost_impact?: number | null
          created_at?: string
          decided_by?: string | null
          description?: string
          id?: string
          raised_by?: string
          site_id?: string
          status?: string
          time_impact_days?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "variation_order_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variation_order_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      variation_order_response: {
        Row: {
          created_at: string
          id: string
          message: string
          responder_id: string
          variation_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          responder_id: string
          variation_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          responder_id?: string
          variation_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variation_order_response_variation_order_id_fkey"
            columns: ["variation_order_id"]
            isOneToOne: false
            referencedRelation: "variation_order"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_log: {
        Row: {
          company: string | null
          created_at: string
          created_by: string
          host_name: string | null
          id: string
          purpose: string | null
          site_id: string
          time_in: string
          time_out: string | null
          visitor_name: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by: string
          host_name?: string | null
          id?: string
          purpose?: string | null
          site_id: string
          time_in?: string
          time_out?: string | null
          visitor_name: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string
          host_name?: string | null
          id?: string
          purpose?: string | null
          site_id?: string
          time_in?: string
          time_out?: string | null
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      waste_log: {
        Row: {
          created_at: string
          created_by: string
          date: string
          disposal_method: string
          disposal_partner: string | null
          id: string
          photo_url: string | null
          quantity: number | null
          site_id: string
          unit: string | null
          waste_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string
          disposal_method: string
          disposal_partner?: string | null
          id?: string
          photo_url?: string | null
          quantity?: number | null
          site_id: string
          unit?: string | null
          waste_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          disposal_method?: string
          disposal_partner?: string | null
          id?: string
          photo_url?: string | null
          quantity?: number | null
          site_id?: string
          unit?: string | null
          waste_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      work_permit: {
        Row: {
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          milestone_id: string | null
          permit_type: string
          requested_by: string
          site_id: string
          status: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          permit_type: string
          requested_by: string
          site_id: string
          status?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          permit_type?: string
          requested_by?: string
          site_id?: string
          status?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_permit_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "site_milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permit_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permit_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
      workers_master: {
        Row: {
          created_at: string
          daily_rate: number | null
          full_name: string
          id: string
          phone_number: string | null
          site_id: string
          trade: string | null
          worker_id_number: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number | null
          full_name: string
          id?: string
          phone_number?: string | null
          site_id: string
          trade?: string | null
          worker_id_number: string
        }
        Update: {
          created_at?: string
          daily_rate?: number | null
          full_name?: string
          id?: string
          phone_number?: string | null
          site_id?: string
          trade?: string | null
          worker_id_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_master_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_master_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "subscription_reminder_queue"
            referencedColumns: ["site_id"]
          },
        ]
      }
    }
    Views: {
      subscription_reminder_queue: {
        Row: {
          days_left: number | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          reminder_kind: string | null
          site_id: string | null
          site_name: string | null
          subscription_end: string | null
          subscription_tier: string | null
          whatsapp_bot_enabled: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      _extend_site_subscription: {
        Args: { p_includes_bot: boolean; p_site_id: string }
        Returns: undefined
      }
      approve_site: { Args: { p_site_id: string }; Returns: undefined }
      bot_query_site_data: {
        Args: {
          p_date_range_days?: number
          p_query_type: string
          p_site_id: string
        }
        Returns: Json
      }
      can_access_activity: {
        Args: { _activity_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_baseline: {
        Args: { _baseline_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_payroll_run: {
        Args: { _payroll_run_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_toolbox_talk: {
        Args: { _toolbox_talk_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_variation_order: {
        Args: { _user_id: string; _variation_order_id: string }
        Returns: boolean
      }
      checkout_tool: {
        Args: {
          p_meter_reading?: number
          p_tool_id: string
          p_worker_id: string
        }
        Returns: string
      }
      complete_subscription_payment: {
        Args: {
          p_checkout_request_id: string
          p_mpesa_receipt_number?: string
          p_status: string
        }
        Returns: undefined
      }
      confirm_manual_subscription_payment: {
        Args: { p_mpesa_receipt_number?: string; p_payment_id: string }
        Returns: undefined
      }
      consume_invite: { Args: { p_token: string }; Returns: string }
      create_site_with_manual_payment: {
        Args: {
          p_includes_bot?: boolean
          p_location?: string
          p_mpesa_receipt_number?: string
          p_site_name: string
          p_subscription_tier?: string
        }
        Returns: {
          payment_id: string
          site_id: string
        }[]
      }
      create_toolbox_talk: {
        Args: {
          p_date: string
          p_site_id: string
          p_topic: string
          p_worker_ids: string[]
        }
        Returns: string
      }
      generate_payment_certificate: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_retention_percentage?: number
          p_site_id: string
          p_work_completed_value: number
        }
        Returns: string
      }
      generate_payroll_run: {
        Args: { p_site_id: string; p_week_end: string; p_week_start: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_foreman: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      is_assigned_foreman_of_pro_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      is_site_assignee: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      is_site_owner: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      log_material_delivery: {
        Args: {
          p_date?: string
          p_material_name: string
          p_quantity: number
          p_receipt_photo_url?: string
          p_site_id: string
          p_supplier: string
          p_unit: string
        }
        Returns: undefined
      }
      log_material_usage: {
        Args: {
          p_date?: string
          p_description: string
          p_material_name: string
          p_quantity: number
          p_site_id: string
          p_unit: string
        }
        Returns: undefined
      }
      mark_payroll_line_paid: {
        Args: { p_line_id: string }
        Returns: undefined
      }
      owns_baseline_site: {
        Args: { _baseline_id: string; _user_id: string }
        Returns: boolean
      }
      owns_payroll_run_site: {
        Args: { _payroll_run_id: string; _user_id: string }
        Returns: boolean
      }
      owns_pro_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      owns_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      recompute_milestone_auto_status: {
        Args: { p_milestone_id: string }
        Returns: undefined
      }
      replace_site_activities: {
        Args: { p_activities: Json; p_site_id: string }
        Returns: number
      }
      request_manual_subscription_payment: {
        Args: {
          p_includes_bot?: boolean
          p_mpesa_receipt_number?: string
          p_site_id: string
        }
        Returns: string
      }
      return_tool: {
        Args: {
          p_condition_on_return?: string
          p_meter_reading?: number
          p_tool_id: string
        }
        Returns: string
      }
      save_schedule_baseline: {
        Args: { p_label?: string; p_site_id: string }
        Returns: string
      }
      verify_defect: { Args: { p_defect_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "contractor" | "admin" | "foreman"
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
    Enums: {
      app_role: ["super_admin", "contractor", "admin", "foreman"],
    },
  },
} as const
