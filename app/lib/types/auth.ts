import { User as SupabaseUser } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Re-export database types with cleaner names
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'] 
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert']
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update']

export type UserOrganization = Database['public']['Tables']['user_organizations']['Row']
export type UserOrganizationInsert = Database['public']['Tables']['user_organizations']['Insert']

// Supabase User type (different from our Profile)
export type User = SupabaseUser

// Domain-specific types
export type UserState = 
  | 'not_signed_up'
  | 'unconfirmed'
  | 'confirmed_no_organization'
  | 'confirmed_with_organization'

// Organization creation data
export type CreateOrganizationData = {
  name: string
  address_line_1: string
  address_line_2?: string | null
  city: string
  state: string
  zip_code: string
}

// Sign up data
export type SignUpData = {
  email: string
  password: string
  first_name: string
  last_name: string
}

// API response types
export type AuthResponse<T = unknown> = {
  data: T | null
  error: unknown | null
}

export type AuthError = {
  message: string
}

// Helper to check if error has message
export function hasErrorMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string'
}
