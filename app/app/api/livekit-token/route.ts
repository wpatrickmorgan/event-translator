import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { mintJoinToken } from '@/lib/livekit'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')
    const identity = searchParams.get('identity')
    const displayName = searchParams.get('name') ?? undefined
    if (!eventId || !identity) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, org_id, room_name, is_public')
      .eq('id', eventId)
      .single()
    if (evErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const { data: membership } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', event.org_id)

    if (!membership || membership.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const token = mintJoinToken({
      roomName: event.room_name,
      identity,
      name: displayName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_SERVER_URL })
  } catch {
    return NextResponse.json({ error: 'Failed to issue token' }, { status: 500 })
  }
}
