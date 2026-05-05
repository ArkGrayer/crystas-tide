import { useRef } from 'react'
import { useAudioAnalyser } from './features/audio/useAudioAnalyser'
import FloatingPill from './features/player/FloatingPill'
import OceanScene from './features/scene/OceanScene'

export default function App() {
  const { isPlaying, progress, bass, treble, loadFile, togglePlayPause, rewind, audioFile } =
    useAudioAnalyser()

  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    loadFile(file)
  }

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleHiddenInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div className="relative w-full min-h-dvh bg-surface overflow-hidden">
      {/* 3D Ocean Background */}
      <OceanScene sunElevation={2} sunAzimuth={180} />

      {/* Debug overlay — real-time analysis data */}
      {audioFile && (
        <div className="fixed top-8 right-8 z-50 font-mono text-xs text-white/40 space-y-2 select-none text-right">
          <p className="tracking-widest uppercase opacity-50 mb-1">Live Spectrum</p>
          <div className="space-y-1">
            <p>BASS: <span className="text-ocean-400">{bass.toFixed(3)}</span></p>
            <p>TREBLE: <span className="text-ocean-300">{treble.toFixed(3)}</span></p>
            <p>PROGRESS: {Math.round(progress * 100)}%</p>
          </div>
          <div className="mt-4 text-[10px] opacity-30 italic">
            Arquivo: {audioFile.name}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.flac,.aac"
        onChange={handleHiddenInputChange}
        className="hidden"
      />

      {/* The Only UI: Floating Pill */}
      <FloatingPill
        isPlaying={isPlaying}
        progress={progress}
        onPlayPause={togglePlayPause}
        onRewind={rewind}
        onUploadClick={handleUploadClick}
        disabled={!audioFile}
      />

      {!audioFile && (
        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <p className="text-white/20 font-display font-light tracking-[0.2em] uppercase text-sm animate-pulse">
            Clique no ícone de upload para começar
          </p>
        </div>
      )}
    </div>
  )
}
