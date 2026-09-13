'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { fetchCurrentUser } from '@/lib/redux/slices/authSlice'
import { fetchCourses } from '@/lib/redux/slices/coursesSlice'
import { getErrorMessage } from '@/lib/utils'
import * as adminApi from '@/lib/api/admin'

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
    return trimmed
  }
  return trimmed
}

export default function ModuleContentPage() {
  const params = useParams<{ courseId: string; moduleId: string }>()
  const { courseId, moduleId } = params
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  
  const { user, isAuthenticated, isInitialized, isLoading } = useAppSelector((state) => state.auth)
  const { courses } = useAppSelector((state) => state.courses)
  
  const [module, setModule] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [loadingContent, setLoadingContent] = useState(true)
  const [localError, setLocalError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Modals
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [editingVideo, setEditingVideo] = useState<any>(null)
  const [editingMaterial, setEditingMaterial] = useState<any>(null)
  const [materialTargetVideoId, setMaterialTargetVideoId] = useState<string>('')
  
  // Forms
  const [videoForm, setVideoForm] = useState({
    title: '',
    description: '',
    yt_video_id: '',
    duration_minutes: '0',
    duration_seconds: '0',
    order_number: '0',
    is_published: true
  })

  const [materialForm, setMaterialForm] = useState({
    title: '',
    order_number: '0',
    file_url: '',
    file_public_id: '',
    file_type: ''
  })
  const [materialFile, setMaterialFile] = useState<File | null>(null)

  const course = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const queryString = searchParams.toString()
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(fullPath)}`)
      return
    }

    if (isAuthenticated && !user && !isLoading) {
      dispatch(fetchCurrentUser())
      return
    }

    if (isAuthenticated && user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/')
      return
    }

    if (isAuthenticated && user) {
      if (courses.length === 0) {
        dispatch(fetchCourses())
      }
      if (moduleId) {
        loadData()
      }
    }
  }, [isInitialized, isAuthenticated, user, dispatch, router, moduleId, courses.length, pathname, searchParams, isLoading])

  const loadData = async () => {
    try {
      setLoadingContent(true)
      // getModule(id) has no backing endpoint — course_service only lists
      // modules per course, so find this one in that list instead.
      const [modulesData, videosData] = await Promise.all([
        adminApi.getModulesForCourse(courseId),
        adminApi.getVideosForModule(courseId, moduleId),
      ])
      const moduleData = modulesData.find((m: any) => String(m.id) === String(moduleId)) ?? null
      setModule(moduleData)

      // For each video, fetch its materials
      const videosWithMaterials = await Promise.all(
        videosData.map(async (video: any) => {
          try {
            const materials = await adminApi.getMaterialsForVideo(video.id)
            return { ...video, materials: materials || [] }
          } catch {
            return { ...video, materials: [] }
          }
        })
      )
      setVideos(videosWithMaterials)
      setLocalError('')
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to load content')
    } finally {
      setLoadingContent(false)
    }
  }

  // --- Video Handlers ---
  const openVideoModal = (video: any = null) => {
    setLocalError('')
    if (video) {
      setEditingVideo(video)
      const totalSeconds = video.duration_seconds || 0
      setVideoForm({
        title: video.title,
        description: video.description || '',
        yt_video_id: video.yt_video_id,
        duration_minutes: String(Math.floor(totalSeconds / 60)),
        duration_seconds: String(totalSeconds % 60),
        order_number: String(video.order_number),
        is_published: video.is_published
      })
    } else {
      setEditingVideo(null)
      setVideoForm({
        title: '',
        description: '',
        yt_video_id: '',
        duration_minutes: '0',
        duration_seconds: '0',
        order_number: String(videos.length + 1),
        is_published: true
      })
    }
    setShowVideoModal(true)
  }

  const handleVideoSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsProcessing(true)
      setLocalError('')
      
      const duration = (Number(videoForm.duration_minutes) || 0) * 60 + (Number(videoForm.duration_seconds) || 0)
      
      const data = {
        module_id: moduleId,
        title: videoForm.title,
        description: videoForm.description,
        yt_video_id: getYouTubeVideoId(videoForm.yt_video_id),
        duration_seconds: duration,
        order_number: Number(videoForm.order_number) || 0,
        is_published: videoForm.is_published
      }

      if (editingVideo) {
        await adminApi.updateVideoForModule(courseId, moduleId, editingVideo.id, data)
      } else {
        await adminApi.createVideoForModule(courseId, data)
      }

      setShowVideoModal(false)
      loadData()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to save video')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteVideo = async (video: any) => {
    if (!window.confirm(`Delete video "${video.title}"?`)) return
    try {
      await adminApi.deleteVideoForModule(courseId, moduleId, video.id)
      loadData()
    } catch (err: any) {
      alert(getErrorMessage(err) || 'Delete failed')
    }
  }

  // --- Material Handlers ---
  const openMaterialModal = (videoId: string, material: any = null) => {
    setLocalError('')
    setMaterialFile(null)
    setMaterialTargetVideoId(videoId)
    if (material) {
      setEditingMaterial(material)
      setMaterialForm({
        title: material.title,
        order_number: String(material.order_number),
        file_url: material.file_url,
        file_public_id: material.file_public_id || '',
        file_type: material.file_type || ''
      })
    } else {
      setEditingMaterial(null)
      setMaterialForm({
        title: '',
        order_number: '0',
        file_url: '',
        file_public_id: '',
        file_type: ''
      })
    }
    setShowMaterialModal(true)
  }

  const handleMaterialSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsProcessing(true)
      setLocalError('')

      let fileUrl = materialForm.file_url
      let filePublicId = materialForm.file_public_id
      let fileType = materialForm.file_type

      if (materialFile) {
        const uploadRes = await adminApi.uploadFile(materialFile)
        fileUrl = uploadRes.file_url
        filePublicId = uploadRes.file_public_id
        fileType = uploadRes.file_type
      }

      if (!fileUrl && !materialFile) {
        setLocalError('Please select a file')
        setIsProcessing(false)
        return
      }

      const data = {
        module_id: moduleId,
        video_id: materialTargetVideoId,
        title: materialForm.title,
        file_url: fileUrl,
        file_type: fileType,
        file_public_id: filePublicId,
        order_number: Number(materialForm.order_number) || 0
      }

      if (editingMaterial) {
        await adminApi.updateMaterial(editingMaterial.id, data)
      } else {
        await adminApi.createMaterial(data)
      }

      setShowMaterialModal(false)
      loadData()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to save material')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteMaterial = async (material: any) => {
    if (!window.confirm(`Delete material "${material.title}"?`)) return
    try {
      if (material.file_public_id) {
        await adminApi.deleteImage(material.file_public_id)
      }
      await adminApi.deleteMaterial(material.id)
      loadData()
    } catch (err: any) {
      alert(getErrorMessage(err) || 'Delete failed')
    }
  }

  const [showCheckpointModal, setShowCheckpointModal] = useState(false)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [checkpointFile, setCheckpointFile] = useState<File | null>(null)
  const [existingCheckpoints, setExistingCheckpoints] = useState<any[]>([])
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false)
  const [isEditingCheckpoint, setIsEditingCheckpoint] = useState(false)
  const [checkpointForm, setCheckpointForm] = useState({
    id: '',
    question_id: '',
    timestamp_mm: '0',
    timestamp_ss: '0',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_e: '',
    correct_option: 'a',
    explanation: ''
  })

  useEffect(() => {
    if (showCheckpointModal && selectedVideoId) {
      loadCheckpoints()
    }
    // Cleanup on close
    if (!showCheckpointModal) {
      setIsEditingCheckpoint(false)
    }
  }, [showCheckpointModal, selectedVideoId])

  const loadCheckpoints = async () => {
    if (!selectedVideoId) return
    try {
      setLoadingCheckpoints(true)
      const data = await adminApi.getVideoCheckpoints(selectedVideoId)
      setExistingCheckpoints(data)
    } catch (err) {
      console.error('Failed to load checkpoints', err)
    } finally {
      setLoadingCheckpoints(false)
    }
  }

  const openCheckpointEditor = (cp: any) => {
    const q = cp.questions?.[0] || {}
    setCheckpointForm({
      id: cp.id,
      question_id: q.id || '',
      timestamp_mm: String(Math.floor(cp.timestamp_seconds / 60)),
      timestamp_ss: String(cp.timestamp_seconds % 60),
      question_text: q.question_text || '',
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      option_e: q.option_e || '',
      correct_option: q.correct_option || 'a',
      explanation: q.explanation || ''
    })
    setIsEditingCheckpoint(true)
  }

  const handleCheckpointUpdateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsProcessing(true)
      setLocalError('')

      const totalSeconds = (Number(checkpointForm.timestamp_mm) || 0) * 60 + (Number(checkpointForm.timestamp_ss) || 0)
      
      // 1. Update Checkpoint timing
      await adminApi.updateVideoCheckpoint(checkpointForm.id, { timestamp_seconds: totalSeconds })

      // 2. Update Question content
      if (checkpointForm.question_id) {
        await adminApi.updateCheckpointQuestion(checkpointForm.question_id, {
          question_text: checkpointForm.question_text,
          option_a: checkpointForm.option_a,
          option_b: checkpointForm.option_b,
          option_c: checkpointForm.option_c,
          option_d: checkpointForm.option_d,
          option_e: checkpointForm.option_e,
          correct_option: checkpointForm.correct_option,
          explanation: checkpointForm.explanation
        })
      }

      setIsEditingCheckpoint(false)
      loadCheckpoints()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to update quiz')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCheckpointSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedVideoId || !checkpointFile) return
    try {
      setIsProcessing(true)
      setLocalError('')
      await adminApi.importVideoCheckpointsCSV(selectedVideoId, checkpointFile)
      setCheckpointFile(null)
      loadCheckpoints()
      loadData()
    } catch (err: any) {
      setLocalError(getErrorMessage(err) || 'Failed to import checkpoints')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteCheckpoint = async (cpId: string) => {
    if (!window.confirm('Delete this quiz checkpoint?')) return
    try {
      setIsProcessing(true)
      await adminApi.deleteVideoCheckpoint(cpId)
      loadCheckpoints()
      loadData()
    } catch (err: any) {
      alert(getErrorMessage(err) || 'Delete failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearAllCheckpoints = async () => {
    if (!selectedVideoId) return
    if (!window.confirm('Are you sure you want to delete ALL quizzes for this video? This cannot be undone.')) return
    try {
      setIsProcessing(true)
      await adminApi.clearVideoCheckpoints(selectedVideoId)
      loadCheckpoints()
      loadData()
    } catch (err: any) {
      alert(getErrorMessage(err) || 'Clear failed')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading || !user || loadingContent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-outfit">
        <div className="text-gray-600 text-lg font-semibold">Loading manager...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-outfit">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manage Lessons & Materials</h1>
            {module && (
              <p className="text-xs text-gray-500">Module: {module.title} • {course?.title}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => openVideoModal()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-sm font-medium text-sm">
              + Add Video
            </button>
            <Link href={`/admin/courses/${courseId}/video-modules`} className="px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg transition-colors font-medium">
              Back to Modules
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {localError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{localError}</div>}

        {videos.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl py-12 text-center text-gray-500">
            No videos added yet. Click "+ Add Video" to get started.
          </div>
        ) : (
          videos.sort((a,b) => a.order_number - b.order_number).map((video) => (
            <div key={video.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all">
              {/* Video header */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-32 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden">
                   <img src={`https://img.youtube.com/vi/${getYouTubeVideoId(video.yt_video_id)}/mqdefault.jpg`} className="w-full h-full object-cover" alt="Thumbnail" />
                   <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168l4.2 2.4a1 1 0 010 1.732l-4.2 2.4A1 1 0 018 12.832V7.168a1 1 0 011.555-.832z" /></svg>
                   </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{video.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{video.description}</p>
                    </div>
                    <div className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded">
                      ORDER: {video.order_number}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                     <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{Math.floor(video.duration_seconds / 60)}m {video.duration_seconds % 60}s</span>
                     <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{video.yt_video_id}</span>
                     <span className={video.is_published ? "text-green-600" : "text-amber-600"}>{video.is_published ? "Published" : "Draft" }</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedVideoId(video.id); setShowCheckpointModal(true); }} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors text-xs font-bold"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Manage Quiz
                  </button>
                  <button onClick={() => openVideoModal(video)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Edit Video">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDeleteVideo(video)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete Video">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {/* Materials under this video */}
              <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Materials ({video.materials?.length || 0})
                  </h4>
                  <button 
                    onClick={() => openMaterialModal(video.id)} 
                    className="text-[11px] px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-bold"
                  >
                    + Add Material
                  </button>
                </div>

                {video.materials && video.materials.length > 0 ? (
                  <div className="space-y-1.5">
                    {video.materials.sort((a: any, b: any) => a.order_number - b.order_number).map((mat: any) => (
                      <div key={mat.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-200">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{mat.title}</p>
                          <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline font-bold uppercase tracking-wider">Download</a>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openMaterialModal(video.id, mat)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteMaterial(mat)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No materials for this video yet</p>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="create-modal-container bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingVideo ? 'Edit Video Lesson' : 'Add New Video'}</h2>
              <button onClick={() => setShowVideoModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleVideoSubmit} className="p-6 space-y-4">
              {localError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{localError}</div>}
              
              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">Video Title</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="e.g. Lesson 01 - Basics of UI Design" value={videoForm.title} onChange={(e) => setVideoForm({...videoForm, title: e.target.value})} required />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">YouTube Video URL or ID</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="e.g. https://youtu.be/dQw4w9WgXcQ or dQw4w9WgXcQ" value={videoForm.yt_video_id} onChange={(e) => setVideoForm({...videoForm, yt_video_id: e.target.value})} required />
                <p className="text-[10px] text-gray-500">Paste the full YouTube URL or just the video ID</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="block text-sm font-bold text-gray-700">Duration (Minutes)</label>
                    <input type="number" min={0} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" value={videoForm.duration_minutes} onChange={(e) => setVideoForm({...videoForm, duration_minutes: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="block text-sm font-bold text-gray-700">Seconds</label>
                    <input type="number" min={0} max={59} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" value={videoForm.duration_seconds} onChange={(e) => setVideoForm({...videoForm, duration_seconds: e.target.value})} />
                 </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">Order Number</label>
                <input type="number" min={0} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" value={videoForm.order_number} onChange={(e) => setVideoForm({...videoForm, order_number: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">Description (Optional)</label>
                <textarea className="w-full border border-gray-300 rounded-xl px-4 py-2.5 h-24 resize-none" placeholder="Brief summary of the lesson..." value={videoForm.description} onChange={(e) => setVideoForm({...videoForm, description: e.target.value})} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={videoForm.is_published} onChange={(e) => setVideoForm({...videoForm, is_published: e.target.checked})} className="rounded-md text-purple-600 focus:ring-purple-500 w-5 h-5" />
                <span className="text-sm font-bold text-gray-700">Publish immediately</span>
              </label>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setShowVideoModal(false)} className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50">
                  {isProcessing ? 'Saving...' : (editingVideo ? 'Update Video' : 'Add Video')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingMaterial ? 'Edit Material' : 'Add New Material'}</h2>
              <button onClick={() => setShowMaterialModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleMaterialSubmit} className="p-6 space-y-4">
              {localError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{localError}</div>}
              
              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">Material Name</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="e.g. Lecture Notes - PDF" value={materialForm.title} onChange={(e) => setMaterialForm({...materialForm, title: e.target.value})} required />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">File Upload</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl">
                  <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => setMaterialFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOC, ZIP up to 20MB</p>
                    {materialFile && <p className="text-xs text-indigo-600 font-bold mt-2">Selected: {materialFile.name}</p>}
                    {editingMaterial && !materialFile && <p className="text-[10px] text-gray-400 mt-2">Keep empty to use existing file</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-bold text-gray-700">Order Number</label>
                <input type="number" min={0} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" value={materialForm.order_number} onChange={(e) => setMaterialForm({...materialForm, order_number: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50">
                  {isProcessing ? 'Uploading...' : (editingMaterial ? 'Update' : 'Add Material')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkpoint Management Modal */}
      {showCheckpointModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage Video Quizzes</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Define interactive assessments for your students</p>
              </div>
              <button 
                onClick={() => setShowCheckpointModal(false)} 
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isEditingCheckpoint ? (
                <form onSubmit={handleCheckpointUpdateSubmit} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  {/* Timestamp Edit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Minutes</label>
                      <input type="number" min={0} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" value={checkpointForm.timestamp_mm} onChange={(e) => setCheckpointForm({...checkpointForm, timestamp_mm: e.target.value})} required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Seconds</label>
                      <input type="number" min={0} max={59} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" value={checkpointForm.timestamp_ss} onChange={(e) => setCheckpointForm({...checkpointForm, timestamp_ss: e.target.value})} required />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Question Text</label>
                    <textarea className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm h-20 resize-none" value={checkpointForm.question_text} onChange={(e) => setCheckpointForm({...checkpointForm, question_text: e.target.value})} required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['a', 'b', 'c', 'd', 'e'].map((opt) => (
                      <div key={opt} className="space-y-1 relative">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Option {opt.toUpperCase()}</label>
                        <input className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none" value={(checkpointForm as any)[`option_${opt}`]} onChange={(e) => setCheckpointForm({...checkpointForm, [`option_${opt}`]: e.target.value})} required={['a', 'b'].includes(opt)} />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Correct Answer</label>
                      <select className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm bg-white" value={checkpointForm.correct_option} onChange={(e) => setCheckpointForm({...checkpointForm, correct_option: e.target.value})}>
                        {['a', 'b', 'c', 'd', 'e'].map(opt => <option key={opt} value={opt}>Option {opt.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Explanation (Optional)</label>
                    <textarea className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm h-16 resize-none" value={checkpointForm.explanation} onChange={(e) => setCheckpointForm({...checkpointForm, explanation: e.target.value})} />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsEditingCheckpoint(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50">Back to List</button>
                    <button type="submit" disabled={isProcessing} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 shadow-lg shadow-amber-200 disabled:opacity-50">
                      {isProcessing ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Existing Checkpoints List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Current Quizzes ({existingCheckpoints.length})
                  </h3>
                  {existingCheckpoints.length > 0 && (
                    <button 
                      onClick={handleClearAllCheckpoints}
                      disabled={isProcessing}
                      className="text-[10px] uppercase tracking-wider font-black text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {loadingCheckpoints ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl animate-pulse text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Updating list...
                  </div>
                ) : existingCheckpoints.length === 0 ? (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-8 text-center px-6">
                    <p className="text-sm text-gray-400 font-medium">No quizzes added to this video yet.</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tight">Use the CSV upload tool below to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {existingCheckpoints.map((cp) => (
                      <div key={cp.id} className="group bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between hover:border-amber-200 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 py-1 bg-amber-50 text-amber-700 font-black text-xs rounded-lg text-center shadow-inner border border-amber-100 flex-shrink-0">
                             {Math.floor(cp.timestamp_seconds / 60)}:{(cp.timestamp_seconds % 60).toString().padStart(2, '0')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate max-w-[240px]">
                              {cp.questions?.[0]?.question_text || 'Checkpoint'}
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                              {cp.questions?.length || 0} Question(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => openCheckpointEditor(cp)}
                            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteCheckpoint(cp.id)}
                            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100" />

              {/* CSV Upload tool */}
              <div className="space-y-4">
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 space-y-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-110">
                    <svg className="w-12 h-12 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>
                  </div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    CSV Bulk Import
                  </p>
                  <p className="text-[11px] text-amber-700/80 leading-relaxed font-medium pr-8">
                    Quickly add multiple quizzes by uploading a CSV. Timestamps can be in seconds or <b>min:sec</b> format.
                  </p>
                  <a 
                    href={adminApi.downloadCheckpointCSVTemplate()} 
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-800 hover:text-amber-900 underline transition-colors uppercase tracking-widest"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-10l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Get CSV Template
                  </a>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Upload CSV</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1 group">
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={(e) => setCheckpointFile(e.target.files?.[0] || null)}
                        disabled={isProcessing}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full border border-gray-300 group-hover:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-gray-600 bg-gray-50 transition-all flex items-center justify-between truncate">
                        <span className="truncate pr-4">{checkpointFile ? checkpointFile.name : 'Choose file...'}</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      </div>
                    </div>
                    {checkpointFile && (
                      <button 
                        onClick={handleCheckpointSubmit}
                        disabled={isProcessing}
                        className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-200/50 disabled:opacity-50"
                      >
                        {isProcessing ? '...' : (existingCheckpoints.length > 0 ? 'Overlay New CSV' : 'Import')}
                      </button>
                    )}
                  </div>
                  {checkpointFile && (
                    <p className="text-[10px] text-amber-600 font-bold ml-1 italic animate-pulse">
                      Note: This will ADD these questions to existing ones at those timestamps.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowCheckpointModal(false)} 
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all shadow-sm"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
