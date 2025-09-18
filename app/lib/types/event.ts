import { Database } from '@/types/database.types'

// Re-export database types with cleaner names
export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

export type EventLanguage = Database['public']['Tables']['event_languages']['Row']
export type EventLanguageInsert = Database['public']['Tables']['event_languages']['Insert']
export type EventLanguageUpdate = Database['public']['Tables']['event_languages']['Update']

export type Language = Database['public']['Tables']['languages']['Row']

// Re-export event status enum
export type EventStatus = Database['public']['Enums']['event_status']

// Event with joined languages data
export type EventWithLanguages = Event & {
  event_languages: (EventLanguage & {
    language: Language
  })[]
}

// Note: This now uses generated Supabase types from the database schema
