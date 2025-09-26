'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Room, RoomEvent, RemoteTrackPublication, Track, RemoteParticipant } from 'livekit-client'
import { useAttendeeStore } from '@/lib/stores/attendeeStore'

interface AttendeeLiveProps {
  roomName: string
  token: string
  url: string
}

export function AttendeeLive(props: AttendeeLiveProps) {
  const { roomName, token, url } = props

  const {
    selectedLanguageId,
    enableAudio,
    enableCaptions,
    eventData,
  } = useAttendeeStore()

  const [captions, setCaptions] = useState<string[]>([])
  const [needsUserGesture, setNeedsUserGesture] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioPubRef = useRef<RemoteTrackPublication | null>(null)

  const selectedLangCode = useMemo(() => {
    if (!eventData || !selectedLanguageId) return null
    const lang = eventData.languages.find(l => l.id === selectedLanguageId)
    return lang?.code ?? null
  }, [eventData, selectedLanguageId])

  // Connect to LiveKit
  useEffect(() => {
    const r = new Room({ adaptiveStream: true })
    roomRef.current = r
    async function connect() {
      try {
        await r.connect(url, token)
      } catch {
        // ignore
      }
    }
    connect()

    r.on(RoomEvent.Disconnected, () => {})

    // Register handler for agent transcriptions using LiveKit's text stream API
    const handleTranscriptions = async (reader: any, participantInfo: any) => {
      try {
        if (!enableCaptions || !selectedLangCode) return
        
        // Check if this transcription is from our target language translator agent
        const expectedAgentId = `translator-${selectedLangCode}`
        if (participantInfo.identity !== expectedAgentId) return
        
        const message = await reader.readAll()
        if (message && typeof message === 'string') {
          setCaptions(prev => {
            const next = [...prev, message]
            return next.slice(-50) // Keep last 50 captions
          })
        }
      } catch (error) {
        console.warn('Error handling transcription:', error)
      }
    }
    
    // Register the text stream handler for agent transcriptions
    r.registerTextStreamHandler('lk.transcription', handleTranscriptions)

    return () => {
      try { 
        // Unregister text stream handler
        r.unregisterTextStreamHandler('lk.transcription')
        r.removeAllListeners() 
      } catch {}
      try { r.disconnect() } catch {}
      // no-op
    }
  }, [roomName, token, url, enableCaptions, selectedLangCode])

  // Manage audio subscription to track name translation-audio-<lang>
  useEffect(() => {
    const r = roomRef.current
    if (!r) return

    // Snapshot the current audio element for this effect's lifetime
    const mediaElAtEffect = audioElRef.current

    function tryAttach(pub: RemoteTrackPublication, participant: RemoteParticipant) {
      if (!selectedLangCode) return
      
      // Look for translator agent with matching language (as per agent identity)
      const expectedAgentId = `translator-${selectedLangCode}`
      if (participant.identity !== expectedAgentId) return
      
      // Subscribe to the agent's audio track (agents publish standard audio tracks)
      if (pub.kind === Track.Kind.Audio) {
        currentAudioPubRef.current = pub
        if (pub.track && mediaElAtEffect) {
          const mediaEl = mediaElAtEffect
          // Attach agent's audio track
          pub.track.attach(mediaEl)
          // Respect audio toggle
          mediaEl.muted = !enableAudio
          // Best-effort play
          mediaEl.play().catch(() => { setNeedsUserGesture(true) })
        }
      }
    }

    const onTrackSubscribed = (track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      tryAttach(pub, participant)
    }

    const onTrackUnsubscribed = (_track: Track, pub: RemoteTrackPublication) => {
      if (currentAudioPubRef.current === pub) {
        try {
          if (mediaElAtEffect) pub.track?.detach(mediaElAtEffect)
        } catch {}
        currentAudioPubRef.current = null
      }
    }

    // Try existing publications first
    for (const participant of r.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        tryAttach(pub, participant)
      }
    }

    r.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    r.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)

    return () => {
      r.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
      r.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      // Detach current (use local ref snapshot)
      const pub = currentAudioPubRef.current
      if (pub && mediaElAtEffect) {
        try { pub.track?.detach(mediaElAtEffect) } catch {}
      }
      currentAudioPubRef.current = null
    }
  }, [selectedLangCode, enableAudio])

  // React to enableAudio changes
  useEffect(() => {
    const el = audioElRef.current
    if (!el) return
    el.muted = !enableAudio
    if (enableAudio) {
      el.play().catch(() => { setNeedsUserGesture(true) })
    }
  }, [enableAudio])

  return (
    <div className="space-y-4">
      <audio ref={audioElRef} autoPlay playsInline hidden />
      {needsUserGesture && enableAudio && (
        <div className="p-3 rounded border bg-amber-50 text-amber-800">
          <button
            className="px-3 py-2 text-sm rounded bg-amber-600 text-white"
            onClick={() => {
              const el = audioElRef.current
              if (!el) return
              el.muted = false
              el.play().then(() => setNeedsUserGesture(false)).catch(() => setNeedsUserGesture(true))
            }}
          >
            Tap to enable audio
          </button>
        </div>
      )}
      <div className="min-h-[200px] p-4 rounded border bg-white">
        {enableCaptions ? (
          captions.length > 0 ? (
            <div className="space-y-2">
              {captions.slice(-6).map((line, i) => (
                <div key={i} className="text-lg leading-relaxed">{line}</div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">Waiting for translations…</div>
          )
        ) : (
          <div className="text-gray-500">Captions disabled</div>
        )}
      </div>
    </div>
  )
}


