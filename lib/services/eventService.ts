import { supabase } from '@/lib/supabase'
import type { EventWithLanguages } from '@/lib/types/event'

export class EventService {
  /**
   * List events for an organization with their associated languages
   */
  static async listEventsForOrg(orgId: string): Promise<{ data: EventWithLanguages[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_languages (
            *,
            language:languages (*)
          )
        `)
        .eq('org_id', orgId)
        .order('start_time', { ascending: false })

      if (error) {
        console.error('Error fetching events:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in listEventsForOrg:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch events' 
      }
    }
  }

  // TODO: Add subscribeToEvents realtime helper for future phases
}
