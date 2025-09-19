import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { ensureRoom } from '@/lib/livekit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, org_id, room_name')
      .eq('id', eventId)
      .single()
    if (evErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const { data: membership } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', event.org_id)
    if (!membership || membership.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: langs, error: langErr } = await supabase
      .from('event_languages')
      .select('mode, voice_id, language:languages(code, name_en, name_native)')
      .eq('event_id', eventId)
    if (langErr) return NextResponse.json({ error: 'Failed to load languages' }, { status: 500 })

    const outputs = (langs || []).map(l => ({
      lang: l.language.code as string,
      captions: l.mode === 'captions_only' || l.mode === 'both',
      audio: l.mode === 'audio_only' || l.mode === 'both',
      voiceId: l.voice_id ?? undefined,
    }))

    await ensureRoom(event.room_name, {
      eventId,
      orgId: event.org_id,
      outputs,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update room metadata' }, { status: 500 })
  }
}


