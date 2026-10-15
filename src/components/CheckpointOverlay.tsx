'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Play } from 'lucide-react'
import confetti from 'canvas-confetti'

interface Question {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c?: string
  option_d?: string
  option_e?: string
  correct_option: string
  explanation?: string
}

interface CheckpointOverlayProps {
  checkpoint: {
    id: string
    questions: Question[]
  }
  onSuccess: () => void
}

const CheckpointOverlay: React.FC<CheckpointOverlayProps> = ({ checkpoint, onSuccess }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const currentQuestion = checkpoint.questions[currentQuestionIndex]
  const options = [
    { label: 'a', text: currentQuestion.option_a },
    { label: 'b', text: currentQuestion.option_b },
    { label: 'c', text: currentQuestion.option_c },
    { label: 'd', text: currentQuestion.option_d },
    { label: 'e', text: currentQuestion.option_e },
  ].filter(opt => opt.text)

  const handleCheck = () => {
    if (!selectedOption) return
    
    const correct = selectedOption === currentQuestion.correct_option
    setIsCorrect(correct)
    setShowFeedback(true)

    if (correct) {
      if (currentQuestionIndex === checkpoint.questions.length - 1) {
        // Last question correct!
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2dd4bf', '#14b8a6', '#0f766e']
        })
      }
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < checkpoint.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setSelectedOption(null)
      setShowFeedback(false)
    } else {
      onSuccess()
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-2xl w-full max-h-[95%] sm:max-h-[90%] bg-slate-900 border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header - Fixed */}
        <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-white/5 bg-gradient-to-r from-teal-500/10 to-transparent flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <AlertCircle className="text-teal-400" size={14} />
            </div>
            <div>
              <h3 className="text-white font-bold text-xs sm:text-sm">Knowledge Check</h3>
              <p className="text-white/40 text-[9px] sm:text-[10px] font-medium uppercase tracking-wider">Question {currentQuestionIndex + 1} of {checkpoint.questions.length}</p>
            </div>
          </div>
          <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/5 border border-white/10 rounded-full text-[8px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest">
            PAUSED
          </div>
        </div>

        {/* Question Body - Scrollable */}
        <div className="p-3 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <h2 className="text-sm sm:text-lg font-bold text-white leading-tight">
                {currentQuestion.question_text}
              </h2>

              <div className="grid gap-1.5 sm:gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.label}
                    disabled={showFeedback}
                    onClick={() => setSelectedOption(opt.label)}
                    className={`group relative flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all text-left active:scale-[0.98] ${
                      selectedOption === opt.label
                        ? showFeedback
                          ? isCorrect
                            ? 'bg-teal-500/20 border-teal-500 text-teal-400'
                            : 'bg-rose-500/20 border-rose-500 text-rose-400'
                          : 'bg-teal-500/10 border-teal-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase flex-shrink-0 ${
                      selectedOption === opt.label ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/40'
                    }`}>
                      {opt.label}
                    </div>
                    <span className="text-xs sm:text-sm font-medium flex-1">{opt.text}</span>
                    
                    {showFeedback && selectedOption === opt.label && (
                      <div className="ml-auto flex-shrink-0">
                        {isCorrect ? <CheckCircle2 size={18} className="text-teal-400" /> : <XCircle size={18} className="text-rose-400" />}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {showFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl text-xs border ${isCorrect ? 'bg-teal-500/5 border-teal-500/20 text-teal-300' : 'bg-rose-500/5 border-rose-500/20 text-rose-300'}`}
                  >
                    <div className="font-bold mb-1 flex items-center gap-2">
                      {isCorrect ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </div>
                    <p className="opacity-80 leading-relaxed italic">
                      "{currentQuestion.explanation || (isCorrect ? 'Well done!' : 'That was not quite right. Try again or check the hint.')}"
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-slate-900 flex items-center justify-between flex-shrink-0">
          <span className="text-white/10 text-[8px] sm:text-[10px] font-black uppercase tracking-widest hidden sm:block">
            Powered by Edura
          </span>

          {!showFeedback ? (
            <button
              disabled={!selectedOption}
              onClick={handleCheck}
              className="px-4 py-2 sm:px-6 sm:py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black rounded-lg sm:rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm ml-auto"
            >
              SUBMIT ANSWER
            </button>
          ) : isCorrect ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 sm:px-6 sm:py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-lg sm:rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm ml-auto"
            >
              {currentQuestionIndex < checkpoint.questions.length - 1 ? 'NEXT' : 'CONTINUE'}
              {currentQuestionIndex < checkpoint.questions.length - 1 ? <ArrowRight size={14} /> : <Play size={14} fill="currentColor" />}
            </button>
          ) : (
            <button
              onClick={() => { setShowFeedback(false); setSelectedOption(null); }}
              className="px-4 py-2 sm:px-6 sm:py-2 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-lg sm:rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm ml-auto"
            >
              TRY AGAIN
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default CheckpointOverlay
