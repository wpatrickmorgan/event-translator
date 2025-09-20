import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { mintJoinToken } from '@/lib/livekit'
import { randomUUID } from 'crypto'

type PostBody = {
  code: string
  languageId: string
  enableAudio?: boolean
  enableCaptions?: boolean
  name?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody
    const code = (body.code || '').trim()
    const languageId = (body.languageId || '').trim()
    if (!code || !languageId) {
      return NextResponse.json({ message: 'Missing code or languageId' }, { status: 400 })
    }

    // Anonymous/public route – do NOT require auth. Use RPC to fetch event context by join code
    const supabase = await getSupabaseServer()
    const { data, error } = await supabase.rpc('get_public_event_and_languages_by_code', { p_code: code })
    if (error) {
      return NextResponse.json({ message: 'Failed to resolve event' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ message: 'Invalid or expired code' }, { status: 404 })
    }

    const firstRow = data[0] as {
      event_id: string
      room_name: string
      is_public?: boolean
      language_id: string
      mode: 'audio_only' | 'captions_only' | 'both'
    }
    const eventId: string | null = firstRow.event_id ?? null
    const roomName: string | null = firstRow.room_name ?? null

    if (!eventId || !roomName) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 })
    }

    // Explicit public enforcement: if the RPC includes is_public, enforce it here
    // If not present, continue (backward compatible with older RPC definition)
    if (Object.prototype.hasOwnProperty.call(firstRow, 'is_public') && firstRow.is_public === false) {
      return NextResponse.json({ message: 'Event is not public' }, { status: 403 })
    }

    // Validate that requested language belongs to this event via the RPC result set
    const matchingLanguage = data.find((row) => row.language_id === languageId)
    if (!matchingLanguage) {
      return NextResponse.json({ message: 'Language not available for this event' }, { status: 400 })
    }

    // Optionally validate requested capabilities vs available mode
    const mode: 'audio_only' | 'captions_only' | 'both' | null = matchingLanguage.mode ?? null
    const wantsAudio = !!body.enableAudio
    const wantsCaptions = body.enableCaptions === undefined ? true : !!body.enableCaptions
    const audioAllowed = mode === 'audio_only' || mode === 'both'
    const captionsAllowed = mode === 'captions_only' || mode === 'both'
    if ((wantsAudio && !audioAllowed) || (wantsCaptions && !captionsAllowed)) {
      return NextResponse.json({ message: 'Requested streams are not available for selected language' }, { status: 400 })
    }

    // Create an anonymous attendee identity
    const identity = `attendee:${randomUUID()}`

    // Public attendees should only be able to subscribe
    const token = await mintJoinToken({
      roomName,
      identity,
      name: body.name?.slice(0, 64),
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    })

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString() // 2h window

    return NextResponse.json({
      token,
      roomName,
    expiresAt,
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_SERVER_URL,
    })
  } catch {
    return NextResponse.json({ message: 'Failed to issue attendee token' }, { status: 500 })
  }
}


