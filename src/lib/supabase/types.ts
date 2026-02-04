export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type JobStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'

export type Plan = 'free' | 'pro' | 'agency'

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export interface ProcessingSettings {
  brightness_range: [number, number]
  saturation_range: [number, number]
  hue_range: [number, number]
  crop_px_range: [number, number]
  speed_range: [number, number]
  remove_watermark: boolean
  add_watermark: boolean
  watermark_path: string | null
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          plan: Plan
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          monthly_quota: number
          quota_used: number
          quota_reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: Plan
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_quota?: number
          quota_used?: number
          quota_reset_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: Plan
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_quota?: number
          quota_used?: number
          quota_reset_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          status: JobStatus
          source_file_path: string | null
          source_file_name: string | null
          source_file_size: number | null
          source_duration: number | null
          variant_count: number
          settings: ProcessingSettings
          progress: number
          variants_completed: number
          output_zip_path: string | null
          error_message: string | null
          error_code: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: JobStatus
          source_file_path?: string | null
          source_file_name?: string | null
          source_file_size?: number | null
          source_duration?: number | null
          variant_count?: number
          settings?: ProcessingSettings
          progress?: number
          variants_completed?: number
          output_zip_path?: string | null
          error_message?: string | null
          error_code?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: JobStatus
          source_file_path?: string | null
          source_file_name?: string | null
          source_file_size?: number | null
          source_duration?: number | null
          variant_count?: number
          settings?: ProcessingSettings
          progress?: number
          variants_completed?: number
          output_zip_path?: string | null
          error_message?: string | null
          error_code?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
      variants: {
        Row: {
          id: string
          job_id: string
          file_path: string | null
          file_size: number | null
          transformations: Json | null
          file_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          file_path?: string | null
          file_size?: number | null
          transformations?: Json | null
          file_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          file_path?: string | null
          file_size?: number | null
          transformations?: Json | null
          file_hash?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          metadata?: Json
          created_at?: string
        }
      }
      api_usage: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          method: string
          response_code: number | null
          response_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          method: string
          response_code?: number | null
          response_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          method?: string
          response_code?: number | null
          response_time_ms?: number | null
          created_at?: string
        }
      }
      watermarks: {
        Row: {
          id: string
          user_id: string
          name: string
          file_path: string
          position: WatermarkPosition
          opacity: number
          scale: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          file_path: string
          position?: WatermarkPosition
          opacity?: number
          scale?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          file_path?: string
          position?: WatermarkPosition
          opacity?: number
          scale?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_monthly_quotas: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      job_status: JobStatus
    }
  }
}

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type Variant = Database['public']['Tables']['variants']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Watermark = Database['public']['Tables']['watermarks']['Row']

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type JobInsert = Database['public']['Tables']['jobs']['Insert']
export type VariantInsert = Database['public']['Tables']['variants']['Insert']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type WatermarkInsert = Database['public']['Tables']['watermarks']['Insert']
