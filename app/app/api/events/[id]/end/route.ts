import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { closeRoom } from '@/lib/livekit'
import { stopEventWorker } from '@/lib/railway'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: event } = await supabase
    .from('events')
    .select('id, org_id, room_name')
    .eq('id', eventId)
    .single()
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const { data: membership } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', event.org_id)
  if (!membership || membership.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await closeRoom(event.room_name)
  const workerUrl = process.env.WORKER_PUBLIC_URL
  if (workerUrl) {
    try {
      await fetch(`${workerUrl.replace(/\/$/, '')}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ roomName: event.room_name }),
      })
    } catch {}
  } else {
    await stopEventWorker()
  }

  const { error: updErr } = await supabase
    .from('events')
    .update({ status: 'ended' })
    .eq('id', eventId)
  if (updErr) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
