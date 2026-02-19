export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type JobStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'

export type JobType = 'video' | 'photo_captions' | 'faceswap'

export type Plan = 'free' | 'pro' | 'agency'

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export type FontSize = 'small' | 'medium' | 'large'

export type CaptionPosition = 'top' | 'center' | 'bottom'

export type CaptionSource = 'manual' | 'ai'

export interface CaptionPhotoEntry {
  file_path: string
  caption: string
}

export interface CaptionSettings {
  captions: string[]
  photos?: CaptionPhotoEntry[]
  font_size: FontSize
  position: CaptionPosition
  generate_video: boolean
  caption_source: CaptionSource
  ai_niche?: string
  ai_style?: string
}

export interface FaceswapSettings {
  face_id: string
  face_path: string
  source_type: 'video' | 'image'
  swap_only: boolean
  variant_count: number
}

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

export interface NotificationPreferences {
  processing_complete: boolean
  quota_warnings: boolean
  plan_expiry_reminder: boolean
  product_updates: boolean
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
          monthly_quota: number
          quota_used: number
          quota_reset_at: string
          plan_expires_at: string | null
          referred_by: string | null
          notification_preferences: NotificationPreferences | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: Plan
          monthly_quota?: number
          quota_used?: number
          quota_reset_at?: string
          plan_expires_at?: string | null
          referred_by?: string | null
          notification_preferences?: NotificationPreferences | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          plan?: Plan
          monthly_quota?: number
          quota_used?: number
          quota_reset_at?: string
          plan_expires_at?: string | null
          referred_by?: string | null
          notification_preferences?: NotificationPreferences | null
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          job_type: JobType
          status: JobStatus
          source_file_path: string | null
          source_file_name: string | null
          source_file_size: number | null
          source_duration: number | null
          variant_count: number
          settings: ProcessingSettings | CaptionSettings | FaceswapSettings
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
          job_type?: JobType
          status?: JobStatus
          source_file_path?: string | null
          source_file_name?: string | null
          source_file_size?: number | null
          source_duration?: number | null
          variant_count?: number
          settings?: ProcessingSettings | CaptionSettings
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
          job_type?: JobType
          status?: JobStatus
          source_file_path?: string | null
          source_file_name?: string | null
          source_file_size?: number | null
          source_duration?: number | null
          variant_count?: number
          settings?: ProcessingSettings | CaptionSettings
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
          caption_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          file_path?: string | null
          file_size?: number | null
          transformations?: Json | null
          file_hash?: string | null
          caption_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          file_path?: string | null
          file_size?: number | null
          transformations?: Json | null
          file_hash?: string | null
          caption_text?: string | null
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
      payments: {
        Row: {
          id: string
          user_id: string
          charge_id: string
          plan: string
          amount: number
          currency: string
          crypto_currency: string | null
          status: 'pending' | 'confirmed' | 'failed' | 'expired'
          created_at: string
          confirmed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          charge_id: string
          plan: string
          amount: number
          currency?: string
          crypto_currency?: string | null
          status?: 'pending' | 'confirmed' | 'failed' | 'expired'
          created_at?: string
          confirmed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          charge_id?: string
          plan?: string
          amount?: number
          currency?: string
          crypto_currency?: string | null
          status?: 'pending' | 'confirmed' | 'failed' | 'expired'
          created_at?: string
          confirmed_at?: string | null
        }
      }
      affiliates: {
        Row: {
          id: string
          user_id: string
          code: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          is_active?: boolean
          created_at?: string
        }
      }
      referrals: {
        Row: {
          id: string
          affiliate_id: string
          referred_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          affiliate_id: string
          referred_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          affiliate_id?: string
          referred_user_id?: string
          created_at?: string
        }
      }
      commissions: {
        Row: {
          id: string
          affiliate_id: string
          payment_id: string
          referred_user_id: string
          amount: number
          status: 'pending' | 'paid'
          created_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          affiliate_id: string
          payment_id: string
          referred_user_id: string
          amount: number
          status?: 'pending' | 'paid'
          created_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          affiliate_id?: string
          payment_id?: string
          referred_user_id?: string
          amount?: number
          status?: 'pending' | 'paid'
          created_at?: string
          paid_at?: string | null
        }
      }
      faces: {
        Row: {
          id: string
          user_id: string
          name: string
          file_path: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          file_path: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          file_path?: string
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
      check_expired_plans: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      try_consume_quota: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      refund_quota: {
        Args: { p_user_id: string }
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

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']

export type Affiliate = Database['public']['Tables']['affiliates']['Row']
export type AffiliateInsert = Database['public']['Tables']['affiliates']['Insert']
export type Referral = Database['public']['Tables']['referrals']['Row']
export type ReferralInsert = Database['public']['Tables']['referrals']['Insert']
export type Commission = Database['public']['Tables']['commissions']['Row']
export type CommissionInsert = Database['public']['Tables']['commissions']['Insert']

export type Face = Database['public']['Tables']['faces']['Row']
export type FaceInsert = Database['public']['Tables']['faces']['Insert']
