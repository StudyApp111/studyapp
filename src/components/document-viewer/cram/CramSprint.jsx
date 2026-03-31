import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock3, Sparkles, HelpCircle, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MathText from "@/components/math/MathText";
import { Textarea } from "@/components/ui/textarea";

const FORMAT_LABELS = { flashcards: 'Flashcard', teach_it: 'Feynman', practice_exam: 'Practice Question' };

export default function CramSprint({ lesson, settings, topicOptions, weakTopics, isDark, onFinish, onExit }) {
  const [secondsLeft, setSecondsLeft] = useState(settings.durationMinutes * 60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [completed, setCompleted] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const queue = useMemo(() => {
    const fmts = settings.formats.length ? settings.formats : ['flashcards'];
    return Array.from({ length: settings.itemCount }, (_, i) => ({ format: fmts[i % fmts.length], order: i + 1 }));
  }, [settings]);

  const activeTopics = settings.topics.length ? settings.topics : topicOptions;

  useEffect(() => {
    const timer = setInterval(() => { setSecondsLeft((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; }); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const finished = secondsLeft === 0 || currentIndex >= queue.length;
  useEffect(() => { if (finished) onFinish(completed); }, [finished]);

  if (finished) return null;

  const item = queue[currentIndex];
  const topic = activeTopics[currentIndex % Math.max(activeTopics.length, 1)] || lesson?.course_name || 'General';

  const handleNext = () => { 
    setCompleted((c) => c + 1); 
    setResponse(""); 
    setIsFlipped(false);
    setCurrentIndex((i) => i + 1); 
  };

  const handleFlip = () => setIsFlipped(!isFlipped);

  // Dynamic Prompt generation based on format
  const getPromptContent = () => {
    if (item.format === 'flashcards') return { title: `Flashcard`, body: `State the core idea behind ${topic}.`, hint: `Focus on the definition or mechanism.` };
    if (item.format === 'teach_it') return { title: `Feynman Method`, body: `Explain ${topic} as if teaching a beginner.`, hint: null };
    return { title: `Practice`, body: `What matters most about ${topic}, and how would you use it on a test?`, hint: `Connect it to an exam-style use case.` };
  };

  const prompt = getPromptContent();
  const isWeakTopic = weakTopics?.includes(topic);

  // Progress Bar calculation
  const progress = (currentIndex / queue.length) * 100;

  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-lg mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box' }}>
      
      {/* Top Header / Timer */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit} className={`text-xs h-8 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          Exit Sprint
        </Button>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm ${isDark ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'bg-white text-purple-700 border border-purple-200'}`}>
          <Clock3 className="w-4 h-4" />
          <span className="text-sm font-bold tabular-nums">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Sprint Progress</span>
          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{currentIndex} / {queue.length}</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <motion.div 
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Interactive Area */}
      {item.format === 'flashcards' ? (
        <div 
          onClick={handleFlip}
          className="cursor-pointer select-none w-full max-w-full relative mt-6"
          style={{ boxSizing: 'border-box', perspective: '1000px' }}
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative min-h-[300px]"
          >
            {/* Question Side */}
            <Card 
              className={`absolute inset-0 border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-purple-900 to-indigo-900' : 'bg-gradient-to-br from-purple-50 to-indigo-50'}`}
              style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
            >
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="font-semibold text-sm text-white">{prompt.title}</span>
                </div>
                <Badge className={`text-[10px] ${isDark ? 'bg-white/20 text-white border-white/10' : 'bg-white/20 text-white border-transparent shadow-sm'}`}>
                  {topic}
                </Badge>
              </div>
              <div className="p-6 flex flex-col items-center justify-center min-h-[240px]">
                <MathText className={`text-lg font-medium leading-relaxed text-center mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {prompt.body}
                </MathText>
                <div className="text-center space-y-2 mt-auto">
                  <p className={`text-xs mb-1 italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hint: {prompt.hint}</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>Tap to reveal answer →</p>
                </div>
              </div>
            </Card>

            {/* Answer Side */}
            <Card 
              className={`absolute inset-0 border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-emerald-900 to-teal-900' : 'bg-gradient-to-br from-emerald-50 to-teal-50'}`}
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', transformStyle: 'preserve-3d' }}
            >
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 flex items-center justify-between">
                <span className="font-semibold text-sm text-white">Mental Check</span>
                <Badge className="text-[10px] bg-white/20 text-white border-transparent">
                  {topic}
                </Badge>
              </div>
              <div className="p-6 flex flex-col items-center justify-center min-h-[240px] text-center">
                <MathText className={`text-base font-medium leading-relaxed mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Did you remember the core concepts of {topic}?
                </MathText>
                
                <div className="mt-auto w-full">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); handleNext(); }} 
                    className="w-full h-12 bg-white text-emerald-700 hover:bg-emerald-50 font-bold shadow-lg"
                  >
                    Got it, Next
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      ) : (
        <motion.div
          key={currentIndex} // forces unmount/remount for animation
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-6"
        >
          <Card className={`backdrop-blur-xl border shadow-xl overflow-hidden w-full max-w-full ${isDark ? 'bg-[#12121a]/95 border-purple-500/30' : 'bg-white border-purple-200/50'}`}>
            <div className={`px-4 py-5 w-full ${isDark ? 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40' : 'bg-gradient-to-br from-purple-50 to-indigo-50'}`}>
              <div className="flex items-center justify-between mb-4">
                <Badge className={isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}>
                  {FORMAT_LABELS[item.format]}
                </Badge>
                <div className="flex items-center gap-1.5">
                  {isWeakTopic && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Weak Topic"></span>}
                  <Badge className={isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-200 text-slate-700'}>
                    {topic}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-center text-center px-2">
                <MathText className={`text-lg font-bold leading-relaxed break-words ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {prompt.body}
                </MathText>
              </div>
            </div>

            <div className="p-4 md:p-5 w-full">
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder={item.format === 'teach_it' ? 'Explain it simply in your own words...' : 'Write your answer here...'}
                className={`w-full min-h-[160px] mb-4 text-sm md:text-base border-2 rounded-xl p-3 resize-none focus:border-purple-400 focus:outline-none ${isDark ? 'bg-[#0a0a12] border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-purple-100 text-slate-900 placeholder:text-slate-400'}`}
              />

              <Button 
                onClick={handleNext} 
                disabled={!response.trim()}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg"
              >
                {currentIndex === queue.length - 1 ? 'Finish Sprint' : 'Submit & Next'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}