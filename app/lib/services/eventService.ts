import { supabase } from '@/lib/supabase'
import type { EventWithLanguages, Event, EventStatus } from '@/lib/types/event'
import type { CreateEventFormData } from '@/lib/schemas/event'
import { OrganizationService } from './organizationService'
import { slugify } from '@/lib/utils'
import { fromZonedTime } from 'date-fns-tz'

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

  /**
   * Get event by ID
   */
  static async getEventById(eventId: string): Promise<{ data: Event | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) {
        console.error('Error fetching event:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in getEventById:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch event' 
      }
    }
  }

  /**
   * Create a new event
   */
  static async createEvent(
    orgId: string,
    userId: string,
    input: CreateEventFormData,
    createdAt = new Date()
  ): Promise<{ data: Event | null; error: string | null }> {
    try {
      // Fetch organization to get slug
      const { data: orgData, error: orgError } = await OrganizationService.getOrganization(orgId)
      if (orgError || !orgData) {
        return { data: null, error: 'Failed to fetch organization' }
      }

      // Normalize event name (case-insensitive, trimmed)
      const normalizedName = this.normalizeEventName(input.name)

      // Generate room name slug using normalized name
      const roomName = this.generateRoomNameSlug(orgData.slug, normalizedName, createdAt)

      // Convert start_time_local to UTC using user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const startTimeUtc = fromZonedTime(input.start_time_local, userTimezone).toISOString()

      // Generate join code if public
      const joinCode = input.is_public ? this.generateJoinCode() : null

      // Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          name: normalizedName,
          org_id: orgId,
          room_name: roomName,
          start_time: startTimeUtc,
          created_by: userId,
          record_transcript: input.record_transcript,
          is_public: input.is_public,
          status: 'scheduled',
          join_code: joinCode,
        })
        .select()
        .single()

      if (eventError) {
        // Handle unique constraint violation from Postgres (duplicate event name per org)
        const code = (eventError as { code?: string }).code
        const message = (eventError as { message?: string }).message || ''
        if (code === '23505' || /duplicate key value|already exists/i.test(message)) {
          return { data: null, error: 'An event with this name already exists in your organization.' }
        }
        console.error('Error creating event:', eventError)
        return { data: null, error: message || 'Failed to create event' }
      }

      // Insert event languages if any
      if (input.languages.length > 0) {
        const eventLanguages = input.languages.map(lang => ({
          event_id: eventData.id,
          language_id: lang.language_id,
          mode: this.getLanguageMode(lang.text, lang.audio),
          voice_id: lang.voice_id,
        }))

        const { error: languagesError } = await supabase
          .from('event_languages')
          .insert(eventLanguages)

        if (languagesError) {
          console.error('Error creating event languages:', languagesError)
          return { data: null, error: JSON.stringify(languagesError) }
        }
      }

      // Build LiveKit room metadata now that event and languages exist (server route to avoid client SDK usage)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/events/${eventData.id}/metadata`, {
          method: 'POST',
          cache: 'no-store',
        })
      } catch (e) {
        console.warn('Failed to call metadata route (non-fatal):', e)
      }

      return { data: eventData, error: null }
    } catch (error) {
      console.error('Error in createEvent:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create event' 
      }
    }
  }

  /**
   * Normalize event name for consistent comparison (case-insensitive, trimmed)
   */
  private static normalizeEventName(name: string): string {
    return name.trim()
  }

  /**
   * Generate room name slug: ${orgSlug}-${slugify(eventName)}-${YYYYMMDDHHmm}
   */
  private static generateRoomNameSlug(orgSlug: string, eventName: string, createdAt: Date): string {
    const eventSlug = slugify(eventName)
    const timestamp = createdAt.toISOString().replace(/[-:T.]/g, '').slice(0, 12)
    return `${orgSlug}-${eventSlug}-${timestamp}`
  }

  /**
   * Generate 6-character join code using non-ambiguous characters
   */
  private static generateJoinCode(length = 6): string {
    const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz2346789'
    let out = ''
    for (let i = 0; i < length; i++) {
      out += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]
    }
    return out
  }

  /**
   * Convert text/audio booleans to language mode
   */
  private static getLanguageMode(text: boolean, audio: boolean): 'captions_only' | 'audio_only' | 'both' {
    if (text && audio) return 'both'
    if (text) return 'captions_only'
    return 'audio_only'
  }

  /**
   * Update event status
   */
  static async updateEventStatus(
    eventId: string,
    status: EventStatus
  ): Promise<{ data: Event | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('events')
        .update({ status })
        .eq('id', eventId)
        .select()
        .single()

      if (error) {
        console.error('Error updating event status:', error)
        return { data: null, error: error.message }
      }
      return { data, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update status',
      }
    }
  }

  // TODO: Add subscribeToEvents realtime helper for future phases
}
