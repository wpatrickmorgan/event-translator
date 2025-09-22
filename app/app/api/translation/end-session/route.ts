import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST(req: NextRequest) {
  try {
    const {
      roomName,
      sessionId,
      duration,
      participantCount = 0,
      reason = 'user_ended'
    } = await req.json()

    if (!roomName && !sessionId) {
      return NextResponse.json({ error: 'Either roomName or sessionId is required' }, { status: 400 })
    }

    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Calculate final duration and end time
    const endTime = new Date().toISOString()
    const finalDuration = duration ? Math.floor(duration / 1000) : 0

    // Update session as completed in Supabase
    const updateData = {
      status: 'completed',
      ended_at: endTime,
      duration_seconds: finalDuration,
      final_participant_count: participantCount,
      end_reason: reason,
      updated_at: endTime
    }

    // TODO: End session in Supabase (requires translation_sessions table)
    // let query = supabase.from('translation_sessions')
    
    // if (sessionId) {
    //   query = query.update(updateData).eq('id', sessionId)
    // } else {
    //   query = query.update(updateData).eq('room_name', roomName)
    // }

    // const { data: session, error: updateError } = await query.select().single()

    // if (updateError) {
    //   console.error('Error ending session:', updateError)
    //   // Continue anyway - non-critical error
    // }
    const session = { id: sessionId || `room-${roomName}`, room_name: roomName, ...updateData }; // Placeholder

    // Log analytics event for session completion
    if (session && finalDuration > 0) {
      try {
        console.log(`Translation session completed: ${session.id}, duration: ${finalDuration}s`)
      } catch (analyticsError) {
        console.warn('Analytics logging failed:', analyticsError)
      }
    }

    return NextResponse.json({
      success: true,
      session: session || { roomName, duration: finalDuration },
      message: 'Session ended successfully'
    })

  } catch (error) {
    console.error('Error ending session:', error)
    return NextResponse.json({
      error: 'Failed to end session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
