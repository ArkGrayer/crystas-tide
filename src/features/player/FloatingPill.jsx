import { useState, useRef } from 'react'
import { Play, Pause, SkipBack, CloudUpload } from 'lucide-react'

export default function FloatingPill({
  isPlaying,
  progress,
  onPlayPause,
  onRewind,
  onUploadClick,
  disabled,
}) {
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rotateX = ((y - centerY) / centerY) * -4
    const rotateY = ((x - centerX) / centerX) * 4
    setTilt({ x: rotateX, y: rotateY })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  const progressPercent = Math.round((progress ?? 0) * 100)

  return (
    <div className="perspective-1000 fixed bottom-[40px] left-1/2 -translate-x-1/2 z-50">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.2s ease-out',
        }}
        className="
          relative w-[280px] h-[64px]
          bg-zinc-950/30 backdrop-blur-2xl
          rounded-full border border-white/10
          flex items-center justify-center gap-8
          shadow-[0_20px_50px_rgba(0,0,0,0.5)]
          overflow-hidden
          group
        "
      >
        {/* Specular Highlight */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-50" />

        {/* Rewind */}
        <button
          onClick={onRewind}
          disabled={disabled}
          className="text-white/40 hover:text-white/90 transition-colors duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <SkipBack size={20} fill="currentColor" className="opacity-80" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onPlayPause}
          disabled={disabled}
          className="text-white/90 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <Pause size={28} fill="currentColor" />
          ) : (
            <Play size={28} fill="currentColor" className="ml-1" />
          )}
        </button>

        {/* Upload trigger */}
        <button
          onClick={onUploadClick}
          className="text-white/40 hover:text-white/90 transition-colors duration-300"
        >
          <CloudUpload size={22} />
        </button>

        {/* Integrated Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5">
          <div
            className="h-full bg-ocean-400 shadow-[0_0_10px_rgba(0,188,212,0.5)]"
            style={{
              width: `${progressPercent}%`,
              transition: 'width 0.15s linear',
            }}
          />
        </div>

        {/* Inner Glow following mouse */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${tilt.y * 20 + 50}% ${tilt.x * -20 + 50}%, rgba(255,255,255,0.08), transparent 50%)`,
          }}
        />
      </div>
    </div>
  )
}
