import { useCallback, useEffect, useRef, useState } from 'react'

export function useAudioLevelMeter(mediaStreamTrack: MediaStreamTrack | null) {
  const meterRaf = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const [level, setLevel] = useState(0)
  const [active, setActive] = useState(false)

  const stop = useCallback(() => {
    if (meterRaf.current) {
      cancelAnimationFrame(meterRaf.current)
      meterRaf.current = null
    }
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null
    dataRef.current = null
    setLevel(0)
    setActive(false)
  }, [])

  const start = useCallback((track: MediaStreamTrack) => {
    stop()
    const ctx = new AudioContext()
    const stream = new MediaStream([track])
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const data = new Float32Array(analyser.fftSize) as unknown as Float32Array<ArrayBuffer>
    audioCtxRef.current = ctx
    analyserRef.current = analyser
    dataRef.current = data
    setActive(true)
    const loop = () => {
      if (analyserRef.current && dataRef.current) {
        analyserRef.current.getFloatTimeDomainData(dataRef.current as unknown as Float32Array<ArrayBuffer>)
        let sum = 0
        for (let i = 0; i < dataRef.current.length; i++) {
          const v = dataRef.current[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataRef.current.length)
        setLevel(Math.min(1, rms * 2))
      } else {
        setLevel(0)
      }
      meterRaf.current = window.requestAnimationFrame(loop)
    }
    meterRaf.current = window.requestAnimationFrame(loop)
  }, [stop])

  useEffect(() => {
    if (mediaStreamTrack) start(mediaStreamTrack)
    else stop()
  }, [mediaStreamTrack, start, stop])

  useEffect(() => () => { stop() }, [stop])

  return { level, active, start, stop }
}


