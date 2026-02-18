import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronLeft, Loader2, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function LecturePlayer({ topic, topicIndex, totalTopics, lecture, isLoadingLecture, onBack, onQuizPrompt }) {
  const { isDark } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(-1);
  const [audioLoading, setAudioLoading] = useState(false);
  const utteranceRef = useRef(null);
  const sentencesRef = useRef([]);
  const contentRef = useRef(null);

  // Split lecture into sentences for highlighting
  useEffect(() => {
    if (!lecture) return;
    // Strip markdown for sentence parsing
    const clean = lecture
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/---+/g, '');

    const sentences = clean.match(/[^.!?]+[.!?]+[\s]*/g) || [clean];
    sentencesRef.current = sentences.map(s => s.trim()).filter(s => s.length > 0);
  }, [lecture]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentSentenceIdx(-1);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const playSpeech = useCallback(() => {
    if (!sentencesRef.current.length) return;

    setIsPlaying(true);
    const startIdx = currentSentenceIdx >= 0 ? currentSentenceIdx : 0;

    const speakSentence = (idx) => {
      if (idx >= sentencesRef.current.length) {
        setIsPlaying(false);
        setCurrentSentenceIdx(-1);
        return;
      }

      setCurrentSentenceIdx(idx);
      const utt = new SpeechSynthesisUtterance(sentencesRef.current[idx]);
      utt.rate = 1.0;
      utt.pitch = 1.0;
      utt.onend = () => speakSentence(idx + 1);
      utt.onerror = () => {
        setIsPlaying(false);
        setCurrentSentenceIdx(-1);
      };
      utteranceRef.current = utt;
      window.speechSynthesis.speak(utt);
    };

    speakSentence(startIdx);
  }, [currentSentenceIdx]);

  const togglePlay = () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      playSpeech();
    }
  };

  if (isLoadingLecture) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Volume2 className="w-8 h-8 text-white" />
        </div>
        <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Writing Your Lecture</h3>
        <p className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Generating a detailed explanation of "{topic?.title}"...
        </p>
        <Loader2 className="w-5 h-5 animate-spin text-purple-500 mt-4" />
      </div>
    );
  }

  if (!lecture) return null;

  return (
    <div className={`w-full max-w-2xl mx-auto pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b px-3 py-2.5 ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <button onClick={() => { stopSpeech(); onBack(); }} className={`flex items-center gap-1 text-xs font-medium ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
            <ChevronLeft className="w-4 h-4" />
            All Topics
          </button>
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Topic {topicIndex + 1} of {totalTopics}
          </span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="px-4 py-3">
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-purple-600/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
          <Button
            onClick={togglePlay}
            disabled={audioLoading}
            className={`w-12 h-12 rounded-full flex-shrink-0 ${
              isPlaying
                ? 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                : 'bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
            }`}
          >
            {audioLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {topic?.title}
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isPlaying ? `Reading sentence ${currentSentenceIdx + 1} of ${sentencesRef.current.length}` : 'Tap play to listen'}
            </p>
          </div>
          {isPlaying && (
            <div className="flex gap-0.5 items-end h-6">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  className="w-1 bg-purple-500 rounded-full"
                  animate={{ height: [4, 16, 8, 20, 4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lecture Content */}
      <div ref={contentRef} className="px-4">
        <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
          <ReactMarkdown
            components={{
              h2: ({ children }) => <h2 className={`text-xl font-bold mt-6 mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{children}</h2>,
              h3: ({ children }) => <h3 className={`text-base font-bold mt-5 mb-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{children}</h3>,
              p: ({ children }) => {
                const text = typeof children === 'string' ? children : '';
                // Check if any sentence in this paragraph is the current one
                const isHighlighted = currentSentenceIdx >= 0 && sentencesRef.current[currentSentenceIdx] && text.includes(sentencesRef.current[currentSentenceIdx]);
                return (
                  <p className={`text-sm leading-relaxed mb-3 transition-colors duration-300 ${
                    isHighlighted
                      ? (isDark ? 'text-white bg-purple-500/20 -mx-2 px-2 py-1 rounded-lg' : 'text-slate-900 bg-purple-100 -mx-2 px-2 py-1 rounded-lg')
                      : (isDark ? 'text-slate-300' : 'text-slate-700')
                  }`}>
                    {children}
                  </p>
                );
              },
              strong: ({ children }) => <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{children}</strong>,
              em: ({ children }) => <em className={isDark ? 'text-purple-300' : 'text-purple-700'}>{children}</em>,
            }}
          >
            {lecture}
          </ReactMarkdown>
        </div>
      </div>

      {/* End-of-topic Quiz Prompt */}
      <div className="px-4 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`rounded-2xl border-2 p-5 text-center ${isDark ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/40' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300'}`}
        >
          <div className="text-3xl mb-2">🎯</div>
          <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Ready to test yourself?
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Take a quick 5-question quiz on "{topic?.title}"
          </p>
          <Button
            onClick={() => { stopSpeech(); onQuizPrompt(); }}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl px-6 py-2.5"
          >
            Start Quiz →
          </Button>
        </motion.div>
      </div>
    </div>
  );
}