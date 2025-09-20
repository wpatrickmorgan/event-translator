import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { ensureRoom } from '@/lib/livekit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, name, org_id, room_name, status')
    .eq('id', eventId)
    .single()
  if (evErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const { data: membership } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', event.org_id)
  if (!membership || membership.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: langs } = await supabase
    .from('event_languages')
    .select('mode, voice_id, language:languages(code, name_en, name_native)')
    .eq('event_id', eventId)

  // Ensure room metadata (no forced delete to avoid dispatch race)
  try {
    await ensureRoom(event.room_name, {
      eventId,
      orgId: event.org_id,
      outputs: (langs || []).map(l => ({
        lang: l.language.code,
        captions: l.mode === 'captions_only' || l.mode === 'both',
        audio: l.mode === 'audio_only' || l.mode === 'both',
        voice: (l as { voice_id?: string }).voice_id ?? undefined,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to ensure room metadata'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { error: updErr } = await supabase
    .from('events')
    .update({ status: 'live' })
    .eq('id', eventId)
  if (updErr) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })

  // Agents framework handles worker dispatch automatically once the room exists

  return NextResponse.json({ ok: true })
}
