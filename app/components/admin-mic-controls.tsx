'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Room, RoomEvent, LocalAudioTrack, createLocalAudioTrack } from 'livekit-client'

type EventStatus = 'scheduled' | 'live' | 'paused' | 'ended' | 'canceled'

export function AdminMicControls({ eventId, status }: { eventId: string; status: EventStatus }) {
  const identity = useMemo(() => `input:${eventId}`, [eventId])
  const displayName = 'Input Audio Channel'

  const roomRef = useRef<Room | null>(null)
  const trackRef = useRef<LocalAudioTrack | null>(null)
  const hasConnectedRef = useRef(false)

  const meterRaf = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  const [connecting, setConnecting] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const micOnRef = useRef(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // (moved below after meter callbacks are defined)

  // Meter helpers
  const stopMeter = useCallback(() => {
    if (meterRaf.current) {
      cancelAnimationFrame(meterRaf.current)
      meterRaf.current = null
    }
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null
    dataRef.current = null
    setLevel(0)
  }, [])

  const startMeter = useCallback((mediaStreamTrack: MediaStreamTrack) => {
    stopMeter()
    const ctx = new AudioContext()
    const stream = new MediaStream([mediaStreamTrack])
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const data = new Float32Array(analyser.fftSize) as unknown as Float32Array<ArrayBuffer>

    audioCtxRef.current = ctx
    analyserRef.current = analyser
    dataRef.current = data

    const loop = () => {
      if (!micOnRef.current) {
        setLevel(0)
      } else if (analyserRef.current && dataRef.current) {
        analyserRef.current.getFloatTimeDomainData(dataRef.current as unknown as Float32Array<ArrayBuffer>)
        let sum = 0
        for (let i = 0; i < dataRef.current.length; i++) {
          const v = dataRef.current[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataRef.current.length)
        setLevel(Math.min(1, rms * 2))
      }
      meterRaf.current = window.requestAnimationFrame(loop)
    }
    meterRaf.current = window.requestAnimationFrame(loop)
  }, [stopMeter])

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
          const qs = new URLSearchParams({ eventId, identity, name: displayName })
          const res = await fetch(`/api/livekit-token?${qs.toString()}`, { cache: 'no-store' })
          if (!res.ok) throw new Error('Failed to fetch LiveKit token')
          const { token, url } = await res.json()
          if (cancelled) return
          const room = new Room()
          await room.connect(typeof url === 'string' ? url : String(url), typeof token === 'string' ? token : String(token), { autoSubscribe: true })
          roomRef.current = room
          hasConnectedRef.current = true

          room.on(RoomEvent.Disconnected, () => {
            stopMeter()
            trackRef.current = null
            setMicOn(false)
          })
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Connection failed')
        } finally {
          setConnecting(false)
        }
      }

      // Auto-publish when status is live
      if (status === 'live' && roomRef.current && !trackRef.current) {
        try {
          const track = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          })
          await roomRef.current.localParticipant.publishTrack(track)
          trackRef.current = track
          try { await track.unmute() } catch {}
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
        const newTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        })
        await roomRef.current.localParticipant.publishTrack(newTrack)
        trackRef.current = newTrack
        try { await newTrack.unmute() } catch {}
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
        try { await track.unmute() } catch {}
      } else {
        try { await track.mute() } catch {}
      }
      setMicOn(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle mic')
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        const track = trackRef.current
        if (track) {
          try { track.mute() } catch {}
          try { roomRef.current?.localParticipant.unpublishTrack(track, true) } catch {}
        }
        stopMeter()
        roomRef.current?.disconnect()
      } catch {}
      roomRef.current = null
      trackRef.current = null
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


