import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { mintJoinToken } from '@/lib/livekit'

export async function POST(req: NextRequest) {
  try {
    const {
      organizationId,
      sourceLanguage = 'auto-detect',
      targetLanguages = ['spanish'],
      userName = 'User'
    } = await req.json()

    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)

    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: 'Access denied to organization' }, { status: 403 })
    }

    // Generate unique room name for translation session
    const roomName = `translation-${organizationId}-${Date.now()}`
    
    // Create participant metadata for the agent to understand
    const participantMetadata = JSON.stringify({
      sourceLanguage,
      targetLanguages,
      organizationId,
      role: 'participant',
      userId: user.id
    })

    // Generate LiveKit access token
    const token = await mintJoinToken({
      roomName,
      identity: `user-${user.id}`,
      name: userName,
      metadata: participantMetadata,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    // TODO: Log session start in Supabase (requires translation_sessions table to be created)
    // const { data: session, error: sessionError } = await supabase
    //   .from('translation_sessions')
    //   .insert([
    //     {
    //       room_name: roomName,
    //       user_id: user.id,
    //       organization_id: organizationId,
    //       source_language: sourceLanguage,
    //       target_languages: targetLanguages,
    //       status: 'starting',
    //       participant_count: 0,
    //       agent_type: 'livekit_openai_realtime'
    //     }
    //   ])
    //   .select()
    //   .single()

    // if (sessionError) {
    //   console.error('Error logging session to Supabase:', sessionError)
    //   // Continue even if logging fails - don't block the user
    // }
    // const session = null; // Placeholder until translation_sessions table is created

    // Return connection details
    return NextResponse.json({
      token,
      roomName,
      sessionId: null, // Placeholder until translation_sessions table is created
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_SERVER_URL,
      config: {
        sourceLanguage,
        targetLanguages,
        organizationId
      }
    })

  } catch (error) {
    console.error('Error creating translation room:', error)
    return NextResponse.json({ 
      error: 'Failed to create translation room',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
