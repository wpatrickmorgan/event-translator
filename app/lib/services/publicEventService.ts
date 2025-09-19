import { supabase } from '@/lib/supabase'

export interface PublicEventData {
  event: {
    id: string
    name: string
    is_public: boolean
    starts_at?: string | null
    ends_at?: string | null
  }
  languages: Array<{
    id: string
    code: string
    name: string
    has_audio: boolean
    has_captions: boolean
  }>
}

export class PublicEventService {
  /**
   * Fetch public event and available languages by join code
   */
  static async getEventByCode(code: string): Promise<PublicEventData | null> {
    try {
      const { data, error } = await supabase.rpc('get_public_event_and_languages_by_code', {
        code,
      })

      if (error) {
        console.error('Error fetching public event:', error)
        throw new Error('Failed to fetch event data')
      }

      if (!data || data.length === 0) {
        return null
      }

      // Transform the flat RPC result into structured data
      const firstRow = data[0]
      if (!firstRow.event_id || !firstRow.event_name) {
        return null
      }

      const event = {
        id: firstRow.event_id,
        name: firstRow.event_name,
        is_public: 'is_public' in firstRow && typeof firstRow.is_public === 'boolean' ? firstRow.is_public : true,
        starts_at: firstRow.start_time,
        ends_at: firstRow.end_time,
      }

      // Group languages from the flat result
      const languagesMap = new Map<string, {
        id: string
        code: string
        name: string
        has_audio: boolean
        has_captions: boolean
      }>()

      data.forEach((row) => {
        if (row.language_id && row.language_code && row.language_name_en) {
          const mode = row.mode
          languagesMap.set(row.language_id, {
            id: row.language_id,
            code: row.language_code,
            name: row.language_name_en,
            has_audio: mode === 'audio_only' || mode === 'both',
            has_captions: mode === 'captions_only' || mode === 'both',
          })
        }
      })

      const languages = Array.from(languagesMap.values())

      return {
        event,
        languages,
      }
    } catch (error) {
      console.error('Error in PublicEventService.getEventByCode:', error)
      throw error
    }
  }
}
