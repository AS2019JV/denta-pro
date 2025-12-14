export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          end_time: string
          id: string
          notes: string | null
          patient_id: string
          start_time: string
          status: string | null
          type: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          patient_id: string
          start_time: string
          status?: string | null
          type?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          patient_id?: string
          start_time?: string
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          created_at: string
          days_before: number | null
          email_enabled: boolean | null
          enabled: boolean | null
          id: string
          reminder_template: string | null
          user_id: string
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          days_before?: number | null
          email_enabled?: boolean | null
          enabled?: boolean | null
          id?: string
          reminder_template?: string | null
          user_id: string
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          days_before?: number | null
          email_enabled?: boolean | null
          enabled?: boolean | null
          id?: string
          reminder_template?: string | null
          user_id?: string
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billings: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          patient_id: string
          status: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          patient_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          patient_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          settings: Json | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hcu033_forms: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          form_data: Json
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          form_data: Json
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          form_data?: Json
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcu033_forms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcu033_forms_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcu033_forms_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_id: string | null
          clinic_id: string | null
          created_at: string | null
          id: string
          invoice_number: string | null
          items: Json | null
          patient_id: string
          pdf_url: string | null
          sri_access_key: string | null
          sri_authorization: string | null
          status: string | null
          total_amount: number
          xml_content: string | null
        }
        Insert: {
          billing_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          items?: Json | null
          patient_id: string
          pdf_url?: string | null
          sri_access_key?: string | null
          sri_authorization?: string | null
          status?: string | null
          total_amount: number
          xml_content?: string | null
        }
        Update: {
          billing_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          items?: Json | null
          patient_id?: string
          pdf_url?: string | null
          sri_access_key?: string | null
          sri_authorization?: string | null
          status?: string | null
          total_amount?: number
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          clinic_id: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          clinic_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          clinic_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          cedula: string | null
          clinic_id: string | null
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medical_history: Json | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cedula?: string | null
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medical_history?: Json | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cedula?: string | null
          clinic_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medical_history?: Json | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          clinic_id: string | null
          email: string | null
          full_name: string | null
          id: string
          license_number: string | null
          phone: string | null
          role: string | null
          specialization: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          license_number?: string | null
          phone?: string | null
          role?: string | null
          specialization?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          license_number?: string | null
          phone?: string | null
          role?: string | null
          specialization?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          description: string | null
          duration: number
          id: string
          name: string
          price: number
          user_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number
          id?: string
          name: string
          price?: number
          user_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number
          id?: string
          name?: string
          price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
