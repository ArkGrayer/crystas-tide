import { useState, useEffect, useRef, useCallback } from 'react'

const FFT_SIZE = 2048

// Frequency bin ranges (at 44100 Hz sample rate, each bin ≈ 21.5 Hz)
const BASS_LOW = 1     // ~21 Hz
const BASS_HIGH = 10   // ~215 Hz
const TREBLE_LOW = 100 // ~2150 Hz
const TREBLE_HIGH = 512 // ~11025 Hz (Nyquist / 2)

function averageRange(dataArray, start, end) {
  let sum = 0
  const clampedEnd = Math.min(end, dataArray.length)
  const clampedStart = Math.max(start, 0)
  const count = clampedEnd - clampedStart

  if (count <= 0) return 0

  for (let i = clampedStart; i < clampedEnd; i++) {
    sum += dataArray[i]
  }

  return sum / count / 255 // Normalize to 0.0–1.0
}

export function useAudioAnalyser() {
  const [audioFile, setAudioFile] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [analysisData, setAnalysisData] = useState({
    progress: 0,
    bass: 0,
    treble: 0,
  })

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const audioElementRef = useRef(null)
  const rafIdRef = useRef(null)
  const dataArrayRef = useRef(null)

  // Cleanup everything: disconnect nodes, close context, cancel RAF
  const cleanup = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch {}
      sourceRef.current = null
    }

    if (analyserRef.current) {
      try { analyserRef.current.disconnect() } catch {}
      analyserRef.current = null
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause()
      URL.revokeObjectURL(audioElementRef.current.src)
      audioElementRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    dataArrayRef.current = null
    setIsPlaying(false)
    setAnalysisData({ progress: 0, bass: 0, treble: 0 })
  }, [])

  // The analysis loop — runs every frame via requestAnimationFrame
  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const audio = audioElementRef.current
    const dataArray = dataArrayRef.current

    if (!analyser || !audio || !dataArray) return

    analyser.getByteFrequencyData(dataArray)

    const progress = audio.duration
      ? audio.currentTime / audio.duration
      : 0

    const bass = averageRange(dataArray, BASS_LOW, BASS_HIGH)
    const treble = averageRange(dataArray, TREBLE_LOW, TREBLE_HIGH)

    setAnalysisData({ progress, bass, treble })

    rafIdRef.current = requestAnimationFrame(tick)
  }, [])

  // Load a new audio file → tear down old graph, build new one
  const loadFile = useCallback(
    (file) => {
      cleanup()
      setAudioFile(file)

      // Build a fresh Web Audio graph
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8

      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.src = URL.createObjectURL(file)
      audio.preload = 'auto'

      const source = ctx.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(ctx.destination)

      // Store refs
      audioContextRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = source
      audioElementRef.current = audio
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

      // When the track ends, stop the loop
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        setAnalysisData((prev) => ({ ...prev, progress: 1 }))
      })
    },
    [cleanup]
  )

  // Play
  const play = useCallback(async () => {
    const audio = audioElementRef.current
    const ctx = audioContextRef.current
    if (!audio || !ctx) return

    // Resume the context if it was suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    await audio.play()
    setIsPlaying(true)

    // Start the analysis loop
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  // Pause
  const pause = useCallback(() => {
    const audio = audioElementRef.current
    if (!audio) return

    audio.pause()
    setIsPlaying(false)

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  // Rewind to start
  const rewind = useCallback(() => {
    const audio = audioElementRef.current
    if (!audio) return

    audio.currentTime = 0
    setAnalysisData((prev) => ({ ...prev, progress: 0 }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    audioFile,
    isPlaying,
    progress: analysisData.progress,
    bass: analysisData.bass,
    treble: analysisData.treble,
    loadFile,
    play,
    pause,
    togglePlayPause,
    rewind,
  }
}
