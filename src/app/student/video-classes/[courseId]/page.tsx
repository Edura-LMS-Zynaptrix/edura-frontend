'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { getErrorMessage } from '@/lib/utils'
import * as studentApi from '@/lib/api/student'
import { VideoLesson, VideoModule } from '@/lib/api/student'
import { motion, AnimatePresence } from 'framer-motion'
import CheckpointOverlay from '@/components/CheckpointOverlay'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Monitor, 
  ChevronLeft,
  CheckCircle2,
  Download,
  Info,
  ChevronDown,
  Clock
} from 'lucide-react'

// Constants
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
const REWIND_SECONDS = 10

function getYouTubeVideoId(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = parsed.hostname.replace('www.', '')
    
    if (host === 'youtu.be') {
      return parsed.pathname.slice(1).split(/[?#&]/)[0]
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') || ''
      }
      const prefixes = ['/embed/', '/v/', '/shorts/', '/live/']
      for (const prefix of prefixes) {
        if (parsed.pathname.startsWith(prefix)) {
          return parsed.pathname.slice(prefix.length).split(/[?#&]/)[0]
        }
      }
    }
  } catch (e) {
    // If URL parsing fails, maybe it's just a raw ID that's not 11 chars (though rare)
    return trimmed
  }
  return trimmed
}

export default function VideoClassPlayerPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params?.courseId as string
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  
  const { user, isAuthenticated, isInitialized, isLoading: authLoading, needsProfileCompletion } = useAppSelector((state) => state.auth)
  
  if (needsProfileCompletion) return null
  
  // Data State
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentVideo, setCurrentVideo] = useState<VideoLesson | null>(null)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  // Player UI State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [isControlsVisible, setIsControlsVisible] = useState(true)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [activeCheckpoint, setActiveCheckpoint] = useState<any | null>(null)
  const activeCheckpointRef = useRef<any>(null)
  const [completedCheckpoints, setCompletedCheckpoints] = useState<Set<string>>(new Set())
  const completedCheckpointsRef = useRef<Set<string>>(new Set())

  // Refs
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastInitializedVideoIdRef = useRef<string | null>(null)

  // 0. Redirect if not authenticated (Wait for initialization to avoid race conditions)
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
    }
  }, [isInitialized, isAuthenticated, router, pathname, searchParams])

  // Use refs for values needed inside callbacks to avoid dependency loops
  const currentVideoRef = useRef<VideoLesson | null>(null)
  const volumeRef = useRef(volume)
  const playbackRateRef = useRef(playbackRate)
  useEffect(() => { currentVideoRef.current = currentVideo }, [currentVideo])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => { playbackRateRef.current = playbackRate }, [playbackRate])

  const initPlayer = useCallback((rawVideoId: string) => {
    // @ts-ignore
    if (!window.YT || !window.YT.Player) return
    
    const videoId = getYouTubeVideoId(rawVideoId)
    if (!videoId) return

    // Check if existing player is still valid (iframe exists in DOM)
    if (playerRef.current) {
      const iframe = document.querySelector('#youtube-player-element iframe, iframe#youtube-player-element')
      if (iframe && typeof playerRef.current.loadVideoById === 'function') {
        // Player is alive — just switch video
        if (lastInitializedVideoIdRef.current !== videoId) {
          playerRef.current.loadVideoById(videoId)
          lastInitializedVideoIdRef.current = videoId
        }
        return
      }
      // Player ref is stale — destroy it
      try { playerRef.current.destroy() } catch (_) {}
      playerRef.current = null
    }

    // Ensure the target div exists in the DOM (YT.Player replaces it with an iframe)
    let targetEl = document.getElementById('youtube-player-element')
    if (!targetEl) return

    // If the element is an iframe (from a previous player), replace it with a fresh div
    if (targetEl.tagName === 'IFRAME') {
      const newDiv = document.createElement('div')
      newDiv.id = 'youtube-player-element'
      newDiv.className = targetEl.className
      targetEl.parentNode?.replaceChild(newDiv, targetEl)
    }

    lastInitializedVideoIdRef.current = videoId
    // @ts-ignore
    playerRef.current = new window.YT.Player('youtube-player-element', {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        fs: 0,
        disablekb: 1,
        ecver: 2,
        playsinline: 1
      },
      events: {
        onReady: (event: any) => {
          setDuration(event.target.getDuration())
          event.target.setVolume(volumeRef.current)
          event.target.setPlaybackRate(playbackRateRef.current)
          // Ensure playback starts
          event.target.playVideo()
        },
        onStateChange: (event: any) => {
          // @ts-ignore
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true)
            setIsBuffering(false)
          } else {
            setIsPlaying(false)
          }
          // @ts-ignore
          if (event.data === window.YT.PlayerState.BUFFERING) {
            setIsBuffering(true)
          }
          // @ts-ignore
          if (event.data === window.YT.PlayerState.ENDED) {
            const cv = currentVideoRef.current
            if (cv) markAsCompleted(cv)
          }
        },
        onError: (event: any) => {
          console.error('YouTube Player Error:', event.data)
        }
      }
    })
  }, []) // No deps — uses refs for mutable values

  // 1. YouTube API Initialization — only runs once to load the script
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }
    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
      const cv = currentVideoRef.current
      if (cv) initPlayer(cv.yt_video_id)
    }
    return () => {
      // @ts-ignore
      window.onYouTubeIframeAPIReady = null
    }
  }, [initPlayer])

  // 2. When currentVideo changes, init the player (if YT API is ready)
  useEffect(() => {
    if (!currentVideo) return
    if ((window as any).YT && (window as any).YT.Player) {
      // Small delay to ensure DOM element is rendered
      const t = setTimeout(() => initPlayer(currentVideo.yt_video_id), 50)
      return () => clearTimeout(t)
    }
  }, [currentVideo, initPlayer])


  // NEW: Dedicated Quiz & Progress Monitor
  useEffect(() => {
    if (progressUpdateIntervalRef.current) clearInterval(progressUpdateIntervalRef.current)

    progressUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && currentVideo) {
        const rawTime = playerRef.current.getCurrentTime()
        const liveDuration = playerRef.current.getDuration ? playerRef.current.getDuration() : 0
        const targetDuration = currentVideo.duration_seconds || liveDuration || 0
        
        if (targetDuration > 0) {
          setDuration(targetDuration)
          const time = rawTime > targetDuration ? targetDuration : rawTime
          setCurrentTime(time)

          // --- Gated Checkpoint Triggering ---
          if ((currentVideo?.checkpoints?.length ?? 0) > 0 && !activeCheckpointRef.current) {
            const missedCheckpoints = (currentVideo?.checkpoints ?? [])
              .filter((cp: any) => !completedCheckpointsRef.current.has(cp.id))
              .filter((cp: any) => time >= cp.timestamp_seconds)
              .sort((a: any, b: any) => a.timestamp_seconds - b.timestamp_seconds)

            if (missedCheckpoints.length > 0) {
              const earliestMissed = missedCheckpoints[0]
              activeCheckpointRef.current = earliestMissed
              setActiveCheckpoint(earliestMissed)
              
              if (playerRef.current) {
                if (typeof playerRef.current.pauseVideo === 'function') playerRef.current.pauseVideo()
                if (typeof playerRef.current.seekTo === 'function') playerRef.current.seekTo(earliestMissed.timestamp_seconds, true)
              }
            }
          }
        } else {
          setCurrentTime(rawTime)
        }
      }
    }, 250)

    return () => {
      if (progressUpdateIntervalRef.current) clearInterval(progressUpdateIntervalRef.current)
    }
  }, [currentVideo])

  // Reset checkpoint state when switching videos
  useEffect(() => {
    setActiveCheckpoint(null)
    activeCheckpointRef.current = null
    setCompletedCheckpoints(new Set())
    completedCheckpointsRef.current = new Set()
  }, [currentVideo])

  // 2. Hydrate session & Data Loading
  useEffect(() => {
    if (isAuthenticated && !user && !authLoading) {
      dispatch(fetchCurrentUser())
    }
    if (courseId) loadCourseData()
  }, [isAuthenticated, user, authLoading, courseId, dispatch])

  const loadCourseData = async () => {
    try {
      setLoading(true)
      const data = await studentApi.getVideoClassDetails(courseId)
      setCourse(data)
      if (!currentVideo && data.modules && data.modules.length > 0) {
        const firstMod = data.modules[0]
        if (firstMod.videos && firstMod.videos.length > 0) {
          setCurrentVideo(firstMod.videos[0])
          setExpandedModules({ [firstMod.id]: true })
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Failed to load course')
    } finally {
      setLoading(false)
    }
  }

  // 3. Player Actions
  const togglePlay = () => {
    if (activeCheckpoint) return // Prevent playing while quiz is active
    if (!playerRef.current || typeof playerRef.current.pauseVideo !== 'function') return
    if (isPlaying) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    playerRef.current?.seekTo(time, true)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value)
    setVolume(vol)
    playerRef.current?.setVolume(vol)
    if (vol > 0) setIsMuted(false)
  }

  const toggleMute = () => {
    if (isMuted) {
      playerRef.current?.unMute()
      setIsMuted(false)
      playerRef.current?.setVolume(volume)
    } else {
      playerRef.current?.mute()
      setIsMuted(true)
    }
  }

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate)
    playerRef.current?.setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }

  const handleRewind = () => {
    const newTime = Math.max(0, currentTime - REWIND_SECONDS)
    playerRef.current?.seekTo(newTime, true)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    const el = containerRef.current
    const newState = !isFullscreen
    setIsFullscreen(newState)
    
    if (newState) {
      // Apply inline styles to escape any CSS containment from parent transforms
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.width = '100vw'
      el.style.height = '100vh'
      el.style.zIndex = '9999'
      el.style.borderRadius = '0'
      el.style.margin = '0'
      document.body.style.overflow = 'hidden'
    } else {
      // Remove all inline styles to restore normal layout
      el.style.position = ''
      el.style.top = ''
      el.style.left = ''
      el.style.width = ''
      el.style.height = ''
      el.style.zIndex = ''
      el.style.borderRadius = ''
      el.style.margin = ''
      document.body.style.overflow = ''
    }
  }

  const handleMouseMove = () => {
    setIsControlsVisible(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu) setIsControlsVisible(false)
    }, 3000)
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleVideoSelect = (video: VideoLesson, moduleId: string) => {
    setCurrentVideo(video)
    setExpandedModules(prev => ({ ...prev, [moduleId]: true }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  const markAsCompleted = async (video: VideoLesson) => {
    if (video.is_completed) return
    try {
      await studentApi.updateVideoProgress({
        video_id: video.id,
        is_completed: true,
        watched_percentage: 100
      })
      setCourse((prev: any) => ({
        ...prev,
        modules: prev.modules.map((m: any) => ({
          ...m,
          videos: m.videos.map((v: any) => v.id === video.id ? { ...v, is_completed: true } : v)
        }))
      }))
    } catch (err) { console.error('Failed completion', err) }
  }

  const handleCheckpointSuccess = () => {
    if (!activeCheckpointRef.current) return
    completedCheckpointsRef.current.add(activeCheckpointRef.current.id)
    setCompletedCheckpoints(new Set(completedCheckpointsRef.current))
    activeCheckpointRef.current = null
    setActiveCheckpoint(null)
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo()
    }
  }

  const totalSeconds = currentVideo?.duration_seconds || duration || 0
  const displayTime = currentTime > totalSeconds ? totalSeconds : currentTime

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center font-outfit">
      <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-outfit selection:bg-teal-500/30">
      
      {/* Top Header / Navigation Bar */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-[100] backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-6">
             <Link href={`/student/courses/${courseId}`} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg">
                <ChevronLeft size={24} />
             </Link>
             <div className="hidden sm:block">
                <h1 className="text-sm font-black text-white tracking-widest uppercase truncate max-w-[300px] lg:max-w-none">{course.title}</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Science • Grade {course.grade}</p>
             </div>
           </div>
           <div className="flex items-center gap-3">
              <span className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-4">Course Tracking</span>
              <div className="px-4 py-1.5 bg-teal-500 text-white rounded-full text-[10px] font-black shadow-lg shadow-teal-500/10">
                {Math.round(course.modules.reduce((acc:any, m:any) => acc + (m.videos?.filter((v:any) => v.is_completed).length || 0), 0) / Math.max(1, course.modules.reduce((acc:any, m:any) => acc + (m.videos?.length || 0), 0)) * 100)}% COMPLETE
              </div>
           </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className={`max-w-[1800px] mx-auto transition-all duration-700 ${isTheaterMode ? 'p-0' : 'p-4 lg:p-8'}`}>
        <div className={`grid grid-cols-1 ${isTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-8`}>
          
          {/* Left Column: Player & Metadata */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Professional Video Player */}
            <div 
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => isPlaying && setIsControlsVisible(false)}
              className={`relative bg-black transition-all duration-300 overflow-hidden group shadow-2xl shadow-black/80 ${
                isTheaterMode 
                  ? 'aspect-[2.4/1] rounded-none' 
                  : 'aspect-video rounded-xl lg:rounded-2xl'
              }`}
            >
              {/* Added loading placeholder for faster perceived performance */}
              <div className="absolute inset-0 bg-slate-900 animate-pulse" />
              <div id="youtube-player-element" className="w-full h-full pointer-events-none relative z-[1]" />
              
              {/* Overlay for Checkpoint */}
              <AnimatePresence>
                {activeCheckpoint && (
                  <CheckpointOverlay 
                    checkpoint={activeCheckpoint} 
                    onSuccess={handleCheckpointSuccess}
                  />
                )}
              </AnimatePresence>

              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                  <div className="w-12 h-12 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                </div>
              )}

              <button onClick={togglePlay} className="absolute inset-0 z-20 cursor-default" />

              {/* Controls */}
              <div className={`absolute inset-0 z-30 pointer-events-none transition-all duration-500 flex flex-col justify-end ${isControlsVisible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
                <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="relative p-4 lg:p-8 w-full space-y-4 pointer-events-auto">
                    {/* Progress Bar */}
                    <div className="group/progress relative flex flex-col pt-4">
                      {hoverTime !== null && (
                        <div className="absolute bottom-full mb-3 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg font-black border border-slate-700 shadow-2xl pointer-events-none whitespace-nowrap" style={{ left: `${(hoverTime / (totalSeconds || 1)) * 100}%` }}>
                          {formatTime(hoverTime)}
                        </div>
                      )}
                      <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden mb-1 scale-y-75 group-hover/progress:scale-y-125 transition-transform origin-bottom duration-300">
                          <div className="absolute left-0 top-0 h-full bg-teal-500 z-10" style={{ width: `${Math.min(100, ((currentTime || 0) / (totalSeconds || 1)) * 100)}%` }} />
                      </div>
                      <input type="range" min="0" max={totalSeconds} step="0.1" value={currentTime || 0} onChange={handleSeek} onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoverTime(((e.clientX - rect.left) / rect.width) * totalSeconds); }} onMouseLeave={() => setHoverTime(null)} className="absolute inset-x-0 bottom-0 top-0 w-full h-full opacity-0 cursor-pointer z-20" />
                    </div>

                    {/* Buttons Row */}
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-6 lg:gap-8">
                          <button onClick={togglePlay} className="text-white hover:text-teal-400 transition-all active:scale-90">{isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</button>
                          <button onClick={handleRewind} className="text-white hover:text-teal-400 transition-colors"><RotateCcw size={22} /></button>
                          <div className="text-xs font-black text-white/90 font-mono tracking-widest tabular-nums">{formatTime(displayTime)} <span className="mx-2 opacity-30">/</span> {formatTime(totalSeconds)}</div>
                          <div className="flex items-center gap-3 group/volume">
                            <button onClick={toggleMute} className="text-white hover:text-teal-400 transition-colors">{isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
                            <input type="range" min="0" max="100" value={isMuted ? 0 : (volume || 0)} onChange={handleVolumeChange} className="w-0 group-hover/volume:w-24 transition-all duration-500 h-1 accent-teal-500 cursor-pointer" />
                          </div>
                       </div>
                       <div className="flex items-center gap-6 lg:gap-8">
                          {/* Speed popover */}
                          <div className="relative">
                            <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">{playbackRate}x <ChevronDown size={14} /></button>
                            {showSpeedMenu && (
                              <div className="absolute bottom-full right-0 mb-4 w-32 bg-slate-900/95 backdrop-blur-2xl border border-slate-700 p-2 rounded-2xl shadow-2xl space-y-1 animate-in fade-in slide-in-from-bottom-2">
                                {PLAYBACK_SPEEDS.map(rate => (
                                  <button key={rate} onClick={() => changePlaybackRate(rate)} className={`w-full px-4 py-2 text-left text-[11px] font-black rounded-xl transition-all ${playbackRate === rate ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{rate}x</button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={() => setIsTheaterMode(!isTheaterMode)} className={`hidden lg:block transition-colors ${isTheaterMode ? 'text-teal-400' : 'text-white hover:text-teal-400'}`}><Monitor size={22} /></button>
                          <button onClick={toggleFullscreen} className="text-white hover:text-teal-400 transition-colors">{isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}</button>
                       </div>
                    </div>
                </div>
              </div>
            </div>

            {/* Natural Metadata Section (Always Visible) */}
            {currentVideo && (
              <div className={`space-y-8 animate-in fade-in slide-in-from-top-4 duration-1000 ${isTheaterMode ? 'max-w-[1200px] mx-auto px-4 py-12' : ''}`}>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-2 border-slate-800">
                    <div className="space-y-2">
                       <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-teal-500/10 text-teal-400 text-[9px] font-black rounded-lg border border-teal-500/20 uppercase tracking-widest">Active Session</span>
                          <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter">Lesson {currentVideo.order_number}</span>
                       </div>
                       <h2 className="text-2xl lg:text-4xl font-black text-white tracking-tight leading-tight">{currentVideo.title}</h2>
                    </div>
                    <div className="shrink-0 flex items-center gap-4">
                       <div className="flex flex-col items-end mr-4 hidden md:flex">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Duration</p>
                          <p className="text-white font-black text-xs font-mono">{formatTime(currentVideo.duration_seconds)}</p>
                       </div>
                       {!currentVideo.is_completed ? (
                         <button onClick={() => markAsCompleted(currentVideo)} className="px-8 py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black text-xs transition-all shadow-[0_0_30px_rgba(20,184,166,0.2)] flex items-center gap-2 group active:scale-95">
                           <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" /> MARK AS COMPLETE
                         </button>
                       ) : (
                         <div className="px-8 py-3.5 bg-slate-800 text-teal-400 rounded-2xl font-black text-xs border border-teal-500/20 flex items-center gap-2">
                           <CheckCircle2 size={18} /> COMPLETED
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                    <div className="md:col-span-8 space-y-6">
                       <h3 className="text-lg font-black text-white flex items-center gap-3"><Info size={20} className="text-teal-500" /> Lesson Description</h3>
                       <div className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/30 p-6 lg:p-8 rounded-3xl border border-slate-800/50">
                         {currentVideo.description || "In this session, we investigate key principles and their practical implementations in real-world scenarios. Focus on the core methodology presented in the second half of the video."}
                       </div>
                    </div>
                    <div className="md:col-span-4 space-y-6">
                       <h3 className="text-lg font-black text-white flex items-center gap-3"><Download size={20} className="text-teal-500" /> Resources</h3>
                       <div className="space-y-3">
                         {currentVideo.materials?.length ? currentVideo.materials.map((mat: any) => (
                           <a key={mat.id} href={mat.file_url} target="_blank" className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-800 rounded-2xl transition-all group">
                             <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 text-teal-500 rounded-xl group-hover:scale-110 transition-all"><Download size={18} /></div>
                             <div className="overflow-hidden"><p className="text-[12px] font-black text-slate-200 line-clamp-1 group-hover:text-teal-400 transition-colors uppercase tracking-tight">{mat.title}</p><p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Reference Material</p></div>
                           </a>
                         )) : (
                           <div className="p-10 bg-slate-900/20 rounded-3xl text-center border border-dashed border-slate-800"><p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">No Materials Available</p></div>
                         )}
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Right Column: Dynamic Sidebar (Course Content) */}
          {!isTheaterMode && (
            <aside className="space-y-6 lg:sticky lg:top-24 lg:h-[calc(100vh-120px)] flex flex-col">
              <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-1">Course Curriculum</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Total lessons: {course.modules.reduce((acc:any, m:any) => acc + (m.videos?.length || 0), 0)}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-sidebar-scrollbar pr-2 space-y-3">
                {course.modules.sort((a:any, b:any) => a.order_number - b.order_number).map((mod: any) => (
                  <div key={mod.id} className="space-y-2">
                    <button onClick={() => toggleModule(mod.id)} className={`w-full p-5 flex items-center justify-between rounded-3xl transition-all ${expandedModules[mod.id] ? 'bg-slate-800 shadow-xl' : 'bg-slate-900/50 border border-slate-800/40 hover:bg-slate-900'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-black/40 flex items-center justify-center text-[10px] font-black text-teal-400 border border-teal-500/20">{mod.order_number}</div>
                        <div className="text-left"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Chapter</p><h4 className="text-xs font-black text-white line-clamp-1">{mod.title}</h4></div>
                      </div>
                      <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedModules[mod.id] ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedModules[mod.id] && (
                      <div className="space-y-1.5 pl-4">
                        {mod.videos?.sort((a:any, b:any) => a.order_number - b.order_number).map((video: any) => (
                          <button key={video.id} onClick={() => handleVideoSelect(video, mod.id)} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all group ${currentVideo?.id === video.id ? 'bg-teal-500/10 shadow-[inset_0_0_20px_rgba(20,184,166,0.05)]' : 'hover:bg-slate-900/40'}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${video.is_completed ? 'bg-teal-500 border-transparent text-white' : 'bg-slate-900 border-slate-800 text-slate-600 group-hover:border-slate-700'}`}>
                              {video.is_completed ? <CheckCircle2 size={16} /> : <span className="text-[10px] font-black">{video.order_number}</span>}
                            </div>
                            <div className="flex-1 text-left overflow-hidden">
                              <p className={`text-[12px] font-bold line-clamp-1 group-hover:text-white transition-colors ${currentVideo?.id === video.id ? 'text-teal-400' : 'text-slate-400'}`}>{video.title}</p>
                              <div className="flex items-center gap-2 mt-1"><span className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase"><Clock size={10} /> {Math.floor(video.duration_seconds / 60)}m {video.duration_seconds % 60}s</span></div>
                              
                              {/* Sidebar Materials Quick Access */}
                              {video.materials && video.materials.length > 0 && (
                                <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-800/40 ml-1">
                                  {video.materials.map((mat: any) => (
                                    <a 
                                      key={mat.id} 
                                      href={mat.file_url} 
                                      target="_blank" 
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-teal-500 py-0.5 transition-colors group/mat"
                                    >
                                      <Download size={10} className="group-hover/mat:scale-110 transition-transform" />
                                      <span className="truncate max-w-[150px] font-medium tracking-tight">{mat.title}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-sidebar-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        
        input[type='range']::-webkit-slider-runnable-track { background: transparent; }
        input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 0; height: 0; }
        
        /* Modern scroll behavior */
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  )
}
