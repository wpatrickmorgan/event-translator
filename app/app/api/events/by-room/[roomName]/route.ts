import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { hasLanguageCode } from '@/lib/utils/type-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params
    const supabase = await getSupabaseServer()

    // Find event by room name
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, org_id, room_name, status')
      .eq('room_name', roomName)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Get event languages
    const { data: langs, error: langError } = await supabase
      .from('event_languages')
      .select('mode, voice_id, language:languages(code, name_en, name_native)')
      .eq('event_id', event.id)

    if (langError) {
      return NextResponse.json({ error: 'Failed to load languages' }, { status: 500 })
    }

    // Format outputs for agent
    const outputs = (langs || [])
      .filter(hasLanguageCode)
      .map(l => ({
        lang: l.language.code,
        captions: l.mode === 'captions_only' || l.mode === 'both',
        audio: l.mode === 'audio_only' || l.mode === 'both',
        voice: l.voice_id ?? undefined,
      }))

    // Return event configuration for agent
    return NextResponse.json({
      eventId: event.id,
      eventName: event.name,
      orgId: event.org_id,
      roomName: event.room_name,
      status: event.status,
      sourceLanguage: 'en-US', // Default source language
      outputs,
    })

  } catch (error) {
    console.error('Error fetching event by room name:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
