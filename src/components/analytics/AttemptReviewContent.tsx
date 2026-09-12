import { CheckCircle2, XCircle, Clock, BarChart3, HelpCircle, PlayCircle } from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function optionLabel(order: number): string {
  return String.fromCharCode(64 + order)
}

function getYouTubeEmbedUrl(url: string | null | undefined): string {
  if (!url) return ''
  let videoId = ''
  
  if (url.includes('youtube.com/watch?v=')) {
    const parts = url.split('v=')
    if (parts.length > 1) {
      videoId = parts[1].split('&')[0]
    }
  } else if (url.includes('youtu.be/')) {
    const parts = url.split('youtu.be/')
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0]
    }
  } else if (url.includes('youtube.com/embed/')) {
    const parts = url.split('embed/')
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0]
    }
  }
  
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

interface AttemptReviewContentProps {
  result: any;
  isCapturing?: boolean;
}

export default function AttemptReviewContent({ result, isCapturing = false }: AttemptReviewContentProps) {
  const scorePct = Math.round((result.marks_obtained / result.total_questions) * 100)
  const isPass = scorePct >= 85

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Performance Header Card */}
      <div data-pdf-section className="bg-white border border-gray-200 rounded-[2.5rem] p-8 mb-8 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full -mr-32 -mt-32 opacity-50 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="flex-shrink-0 relative">
            <div className={`w-36 h-36 rounded-full border-8 ${isPass ? 'border-emerald-500' : 'border-red-500'} flex items-center justify-center shadow-inner`}>
              <div className="text-center">
                <span className="text-4xl font-black text-gray-900 leading-none">{scorePct}</span>
                <span className="text-sm font-black text-gray-400 block">%</span>
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg border border-gray-100">
              {isPass ? <CheckCircle2 className="text-emerald-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
            </div>
          </div>

          <div className="flex-grow grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <BarChart3 size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">Marks</span>
              </div>
              <p className="text-lg font-black text-gray-900">{result.marks_obtained} / {result.total_questions}</p>
              <p className="text-[10px] text-gray-400 font-bold">Accuracy</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">Time</span>
              </div>
              <p className="text-lg font-black text-gray-900">{formatTime(result.time_taken_seconds)}</p>
              <p className="text-[10px] text-gray-400 font-bold">Duration</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <HelpCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">Subject Rank</span>
              </div>
              <p className="text-lg font-black text-gray-900">#{result.ranking.overall_rank || '-'}</p>
              <p className="text-[10px] text-gray-400 font-bold">Out of all students</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <PlayCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">District Rank</span>
              </div>
              <p className="text-lg font-black text-gray-900">#{result.ranking.district_rank || '-'}</p>
              <p className="text-[10px] text-gray-400 font-bold">Current region</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Submission Review */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">PAPER SUBMISSION REVIEW</h2>
          <div className="text-xs text-gray-400 font-bold uppercase">Submitted on {new Date(result.submitted_at).toLocaleDateString()}</div>
        </div>

        <div className="space-y-6">
          {result.review.map((item: any, idx: number) => (
            <div
              data-pdf-section
              key={item.question_id}
              className={`group bg-white border-2 rounded-[2rem] overflow-hidden transition-all ${
                item.is_correct ? 'border-emerald-100' : 'border-red-100'
              }`}
            >
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center font-black ${
                      item.is_correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-gray-900 leading-snug">{item.question_text}</p>
                    </div>
                  </div>
                  {item.is_correct ? (
                    <span className="flex-shrink-0 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">Correct</span>
                  ) : (
                    <span className="flex-shrink-0 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">Incorrect</span>
                  )}
                </div>

                {item.question_image_url && (
                  <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100">
                    <img src={item.question_image_url} alt="Question" className="max-w-full h-auto mx-auto" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item.options.map((option: any) => {
                    const isSelected = item.selected_option_id === option.id
                    const isCorrect = item.correct_option_id === option.id
                    
                    let variant = 'default'
                    if (isCorrect) variant = 'correct'
                    else if (isSelected && !isCorrect) variant = 'incorrect'

                    return (
                      <div 
                        key={option.id}
                        className={`relative p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                          variant === 'correct' ? 'border-emerald-500 bg-emerald-50 shadow-sm' :
                          variant === 'incorrect' ? 'border-red-500 bg-red-50 shadow-sm' :
                          'border-gray-50 bg-gray-50/50 grayscale opacity-60'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          variant === 'correct' ? 'bg-emerald-500 text-white' :
                          variant === 'incorrect' ? 'bg-red-500 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {optionLabel(option.order_number)}
                        </div>
                        <span className={`text-sm font-bold ${
                          variant === 'correct' ? 'text-emerald-900' :
                          variant === 'incorrect' ? 'text-red-900' :
                          'text-gray-600'
                        }`}>
                          {option.option_text}
                        </span>
                        
                        {variant === 'correct' && (
                          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                            <CheckCircle2 size={12} />
                          </div>
                        )}
                        {variant === 'incorrect' && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                            <XCircle size={12} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {(item.explanation || item.video_url) && (
                  <div className={`mt-8 pt-8 border-t ${item.is_correct ? 'border-emerald-50' : 'border-red-50'}`}>
                    {item.explanation && (
                      <div className="mb-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Explanatory Note</p>
                        <p className="text-sm font-bold text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-2xl inline-block w-full">{item.explanation}</p>
                      </div>
                    )}
                    {item.video_url && (
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Video Mastery Solution</p>
                        {isCapturing ? (
                          <p className="text-sm text-gray-700">Watch: <span className="text-teal-700">{item.video_url}</span></p>
                        ) : (
                          <div className="aspect-video w-full max-w-2xl rounded-[1.5rem] overflow-hidden shadow-sm border border-gray-100 bg-black">
                            <iframe
                              width="100%"
                              height="100%"
                              src={getYouTubeEmbedUrl(item.video_url)}
                              title="Explanation Video"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
