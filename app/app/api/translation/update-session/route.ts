import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  try {
    const {
      roomName,
      sessionId,
      status,
      participantCount,
      duration
    } = await req.json()

    if (!roomName && !sessionId) {
      return NextResponse.json({ error: 'Either roomName or sessionId is required' }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (status) updateData.status = status
    if (typeof participantCount === 'number') updateData.participant_count = participantCount
    if (typeof duration === 'number') updateData.duration_seconds = Math.floor(duration / 1000)

    // Update session in Supabase
    let query = supabase.table('translation_sessions')

    if (sessionId) {
      query = query.update(updateData).eq('id', sessionId)
    } else {
      query = query.update(updateData).eq('room_name', roomName)
    }

    const { data, error } = await query.select().single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      session: data 
    })

  } catch (error) {
    console.error('Error in update-session:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
