'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Room, LocalAudioTrack } from 'livekit-client'
import { LivekitService } from '@/lib/services/livekitService'
import { LivekitAdminService } from '@/lib/services/livekitAdminService'
import { useAudioLevelMeter } from '@/hooks/useAudioLevelMeter'

type EventStatus = 'scheduled' | 'live' | 'paused' | 'ended' | 'canceled'

export function AdminMicControls({ eventId, status }: { eventId: string; status: EventStatus }) {
  const identity = useMemo(() => `input:${eventId}`, [eventId])
  const displayName = 'Input Audio Channel'

  const roomRef = useRef<Room | null>(null)
  const trackRef = useRef<LocalAudioTrack | null>(null)
  const hasConnectedRef = useRef(false)

  const { level, start, stop } = useAudioLevelMeter(null as unknown as MediaStreamTrack | null)

  const [connecting, setConnecting] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const micOnRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // (moved below after meter callbacks are defined)

  // Meter bridge
  const startMeter = useCallback((track: MediaStreamTrack) => start(track), [start])
  const stopMeter = useCallback(() => stop(), [stop])

  // Connect while live/paused; disconnect otherwise. Auto-publish on live.
  useEffect(() => {
    let cancelled = false

    async function ensureConnectedAndMaybePublish() {
      // Connect when event is live; remain connected during paused
      const shouldConnect = status === 'live' || (status === 'paused' && hasConnectedRef.current)
      if (!shouldConnect) return

      if (!roomRef.current) {
        try {
          setConnecting(true)
          setError(null)
          const { token, url } = await LivekitService.fetchAdminToken(eventId, identity, displayName)
          if (cancelled) return
          const room = await LivekitAdminService.connect((url ?? '') as string, token, () => {
            stopMeter()
            trackRef.current = null
            setMicOn(false)
          })
          roomRef.current = room
          hasConnectedRef.current = true
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Connection failed')
        } finally {
          setConnecting(false)
        }
      }

      // Auto-publish when status is live
      if (status === 'live' && roomRef.current && !trackRef.current) {
        try {
          const track = await LivekitAdminService.publishMic(roomRef.current)
          trackRef.current = track
          setMicOn(true)
          startMeter(track.mediaStreamTrack)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Mic permission or publish failed')
        }
      }
    }

    function disconnectAll() {
      try {
        stopMeter()
        const track = trackRef.current
        if (track) {
          try { track.mute() } catch {}
          try { roomRef.current?.localParticipant.unpublishTrack(track, true) } catch {}
        }
        trackRef.current = null
        setMicOn(false)
        if (roomRef.current) {
          roomRef.current.disconnect()
        }
      } catch {}
      roomRef.current = null
      hasConnectedRef.current = false
    }

    if (status === 'live' || status === 'paused') {
      ensureConnectedAndMaybePublish()
    } else {
      disconnectAll()
    }

    return () => { cancelled = true }
  }, [eventId, identity, status, startMeter, stopMeter])

  // Mic toggle (mute/unmute without unpublishing or disconnecting)
  const toggleMic = async () => {
    const track = trackRef.current
    if (!track) {
      // If no track yet (e.g., paused when first opening), create and publish now
      if (!roomRef.current) return
      try {
        const newTrack = await LivekitAdminService.publishMic(roomRef.current)
        trackRef.current = newTrack
        setMicOn(true)
        startMeter(newTrack.mediaStreamTrack)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mic permission or publish failed')
      }
      return
    }

    const next = !micOn
    try {
      if (next) {
        await LivekitAdminService.unmute(track)
      } else {
        await LivekitAdminService.mute(track)
      }
      setMicOn(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle mic')
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      (async () => {
        try {
          const track = trackRef.current
          if (track && roomRef.current) {
            await LivekitAdminService.unpublishAndStop(roomRef.current, track)
          }
          stopMeter()
          if (roomRef.current) await LivekitAdminService.disconnect(roomRef.current)
        } catch {}
        roomRef.current = null
        trackRef.current = null
      })()
    }
  }, [stopMeter])

  useEffect(() => { micOnRef.current = micOn }, [micOn])

  const canUse = status === 'live' || status === 'paused'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMic}
          disabled={!canUse || connecting}
          className={`px-3 py-2 rounded text-white ${micOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}
        >
          {micOn ? 'Mic Off' : 'Mic On'}
        </button>
        <div className="text-sm text-gray-600">{displayName}</div>
      </div>
      <div className="h-2 w-64 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-75"
          style={{ width: `${Math.round((micOn ? level : 0) * 100)}%` }}
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}


