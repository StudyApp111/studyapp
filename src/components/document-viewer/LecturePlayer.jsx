import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronLeft, Loader2, Volume2, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAITutor } from "@/components/ai-tutor/AITutorContext";
import { base44 } from "@/api/base44Client";

export default function LecturePlayer({ topic, topicIndex, totalTopics, lecture, isLoadingLecture, onBack, onQuizPrompt, lesson }) {
  const { isDark } = useTheme();
  const { openWithContext } = useAITutor();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(-1);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const sentencesRef = useRef([]);
  const contentRef = useRef(null);
  
  // Text selection state
  const [selectedText, setSelectedText] = useState("");
  const [showAskAI, setShowAskAI] = useState(false);
  const [askAIPos, setAskAIPos] = useState({ x: 0, y: 0 });
  const askAIRef = useRef(null);

  // Split lecture into sentences for highlighting
  useEffect(() => {
    if (!lecture) return;
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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentSentenceIdx(-1);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Generate TTS audio from backend
  const playGeminiTTS = useCallback(async () => {
    if (!lecture) return;
    
    // If we already have a loaded audio element, just resume it
    if (audioRef.current && audioSrc) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }
    
    setAudioLoading(true);
    setIsPlaying(true);
    
    try {
      const { data } = await base44.functions.invoke('generateLectureSpeech', { text: lecture });
      
      if (data?.audio_base64) {
        const mimeType = data.mime_type || 'audio/wav';
        const src = `data:${mimeType};base64,${data.audio_base64}`;
        setAudioSrc(src);
        
        // Play audio
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          setCurrentSentenceIdx(-1);
        };
        audio.onerror = () => {
          console.error("Audio playback error, falling back to browser TTS");
          playBrowserTTS();
        };
        await audio.play();
      } else {
        // Fallback to browser TTS
        playBrowserTTS();
      }
    } catch (err) {
      console.error("Gemini TTS error:", err);
      playBrowserTTS();
    } finally {
      setAudioLoading(false);
    }
  }, [lecture, audioSrc]);

  const playBrowserTTS = useCallback(() => {
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
      // Pause without resetting position
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      playGeminiTTS();
    }
  };

  // Handle text selection for Ask AI
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 5) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setAskAIPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setShowAskAI(true);
    } else {
      setShowAskAI(false);
      setSelectedText("");
    }
  };

  const handleAskAI = () => {
    const isMobile = window.innerWidth < 768;
    
    const contextData = {
      type: "document",
      selectedText,
      lesson: lesson ? {
        id: lesson.id,
        course_name: lesson.course_name,
        extracted_content: lesson.extracted_content?.substring(0, 8000)
      } : null,
      initialPrompt: `Explain this section from my lecture on "${topic?.title}":\n\n"${selectedText}"\n\nBreak it down in simple terms.`
    };

    if (isMobile) {
      openWithContext(contextData);
    } else {
      window.dispatchEvent(new CustomEvent('askAIFromContext', { detail: contextData }));
    }
    
    setShowAskAI(false);
    setSelectedText("");
    window.getSelection().removeAllRanges();
  };

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (askAIRef.current && !askAIRef.current.contains(e.target)) {
        setShowAskAI(false);
        setSelectedText("");
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
              {audioLoading ? 'Generating audio...' : isPlaying ? 'Playing...' : 'Tap play to listen'}
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
      <div ref={contentRef} className="px-4" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
        <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
          <ReactMarkdown
            components={{
              h2: ({ children }) => <h2 className={`text-xl font-bold mt-6 mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{children}</h2>,
              h3: ({ children }) => <h3 className={`text-base font-bold mt-5 mb-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{children}</h3>,
              p: ({ children }) => {
                const text = typeof children === 'string' ? children : '';
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

      {/* Floating Ask AI Button */}
      <AnimatePresence>
        {showAskAI && selectedText && (
          <motion.div
            ref={askAIRef}
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50"
            style={{
              left: `${Math.min(Math.max(askAIPos.x, 80), window.innerWidth - 80)}px`,
              top: `${askAIPos.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <button
              onClick={handleAskAI}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs rounded-full shadow-xl hover:shadow-2xl transition-all active:scale-95"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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