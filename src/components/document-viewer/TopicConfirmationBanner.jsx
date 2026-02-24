import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Sparkles, ArrowRight, FolderOpen, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function TopicConfirmationBanner({ lesson, onGoToDiagnostic, diagnosticReady, diagnosticCompleted }) {
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1);
  const [liveReady, setLiveReady] = useState(diagnosticReady);
  const [deselected, setDeselected] = useState(new Set());

  const topics = lesson?.topics || [];
  const dismissKey = `topic_flow_dismissed_${lesson?.id}`;
  const topLevelTopics = topics.filter(t => t.title);

  useEffect(() => {
    if (lesson?.id && localStorage.getItem(dismissKey)) setDismissed(true);
  }, [lesson?.id]);

  useEffect(() => {
    if (diagnosticReady) setLiveReady(true);
  }, [diagnosticReady]);

  useEffect(() => {
    if (liveReady || !lesson?.id) return;
    const unsubscribe = base44.entities.Exam.subscribe((event) => {
      if (event.data?.lesson_id === lesson.id && event.data?.exam_number === 1 && event.data?.exam_type !== 'practice' && event.data?.questions?.length > 0) {
        setLiveReady(true);
      }
    });
    return () => unsubscribe();
  }, [lesson?.id, liveReady]);

  // Load saved deselections
  useEffect(() => {
    if (!lesson?.id || topLevelTopics.length === 0) return;
    const saved = lesson?.selected_topics;
    if (saved?.length > 0 && saved.length < topLevelTopics.length) {
      const allTitles = topLevelTopics.map(t => t.title);
      const removed = new Set(allTitles.filter(t => !saved.includes(t)));
      setDeselected(removed);
    }
  }, [lesson?.id]);

  if (topLevelTopics.length === 0 || dismissed || diagnosticCompleted) return null;

  const toggleTopic = (title) => {
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleDeselectAll = () => {
    if (deselected.size === topLevelTopics.length) {
      setDeselected(new Set());
    } else {
      setDeselected(new Set(topLevelTopics.map(t => t.title)));
    }
  };

  const selectedTopics = topLevelTopics.filter(t => !deselected.has(t.title));

  const handleConfirmTopics = async () => {
    const allTitles = [];
    selectedTopics.forEach(t => {
      allTitles.push(t.title);
      t.subtopics?.forEach(st => allTitles.push(st.title));
    });
    await base44.entities.Lesson.update(lesson.id, { selected_topics: allTitles });
    window.dispatchEvent(new Event('reloadLesson'));
    setStep(2);
  };

  const handleStartDiagnostic = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
    onGoToDiagnostic();
  };

  const handleSkipDiagnostic = () => {
    localStorage.setItem(dismissKey, 'true');
    localStorage.setItem(`diagnostic_skipped_${lesson?.id}`, 'true');
    setDismissed(true);
    window.dispatchEvent(new CustomEvent('diagnosticSkipped', { detail: { lessonId: lesson.id } }));
  };

  const allDeselected = deselected.size === topLevelTopics.length;

  return (
    <Dialog open={!dismissed} onOpenChange={() => {}}>
      <DialogContent
        className={`sm:max-w-[420px] max-w-[calc(100vw-32px)] p-0 gap-0 overflow-hidden rounded-2xl border-0 ${isDark ? 'bg-[#14141e]' : 'bg-white'} [&>button]:hidden`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{step === 1 ? 'Topics Found' : 'Start Diagnostic'}</DialogTitle>
        <DialogDescription className="sr-only">{step === 1 ? 'Review topics' : 'Take diagnostic'}</DialogDescription>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-1">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/20'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/20'}`} />
        </div>

        {step === 1 ? (
          <Step1Topics
            isDark={isDark}
            lesson={lesson}
            topLevelTopics={topLevelTopics}
            deselected={deselected}
            toggleTopic={toggleTopic}
            handleDeselectAll={handleDeselectAll}
            allDeselected={allDeselected}
            selectedCount={selectedTopics.length}
            onConfirm={handleConfirmTopics}
          />
        ) : (
          <Step2Diagnostic
            isDark={isDark}
            liveReady={liveReady}
            onStart={handleStartDiagnostic}
            onSkip={handleSkipDiagnostic}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Step1Topics({ isDark, lesson, topLevelTopics, deselected, toggleTopic, handleDeselectAll, allDeselected, selectedCount, onConfirm }) {
  return (
    <div className="px-5 sm:px-6 pb-5 pt-2">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className={`text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>Document Analyzed</span>
        </div>
        <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          We read your <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lesson?.course_name || 'document'}</span> and found{' '}
          <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{topLevelTopics.length} key topics</span> to help you study.
        </p>
      </div>

      {/* Divider */}
      <div className={`h-px mb-3 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

      {/* Topic list - tap to toggle */}
      <div className="space-y-1 mb-3 max-h-[35vh] overflow-y-auto">
        {topLevelTopics.map((topic, idx) => {
          const isSelected = !deselected.has(topic.title);
          return (
            <button
              key={idx}
              onClick={() => toggleTopic(topic.title)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                isSelected
                  ? isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
                  : isDark ? 'bg-white/[0.02] opacity-40' : 'bg-slate-50/50 opacity-40'
              }`}
            >
              <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? (isDark ? 'text-amber-400' : 'text-amber-500') : (isDark ? 'text-slate-600' : 'text-slate-400')}`} />
              <span className={`text-[13px] font-medium flex-1 truncate ${
                isSelected
                  ? isDark ? 'text-slate-200' : 'text-slate-700'
                  : isDark ? 'text-slate-500 line-through' : 'text-slate-400 line-through'
              }`}>
                {topic.title}
              </span>
              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Instruction + Deselect */}
      <p className={`text-[12px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Look good? Tap any to remove.
      </p>

      {/* CTA */}
      <Button
        onClick={onConfirm}
        disabled={selectedCount === 0}
        className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20"
      >
        Perfect, Let's Start <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>

      {/* Deselect all */}
      <button
        onClick={handleDeselectAll}
        className={`w-full text-center text-[11px] mt-2.5 py-1 font-semibold ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
      >
        {allDeselected ? 'Select All' : 'Deselect All'}
      </button>
    </div>
  );
}

function Step2Diagnostic({ isDark, liveReady, onStart, onSkip }) {
  return (
    <div className="px-5 sm:px-6 pb-5 pt-2 text-center">
      {/* Blurred grade pill */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center mb-4 sm:mb-5"
      >
        <div className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${isDark ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
          {/* Blur overlay */}
          <div className="absolute inset-0 rounded-xl backdrop-blur-[6px] bg-white/5 z-10" />
          <span className="text-2xl font-black text-emerald-400 select-none" aria-hidden>A</span>
          <span className={`text-sm font-bold select-none ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} aria-hidden>??%</span>
          <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
            Unlock <ArrowRight className="w-3 h-3 inline -mt-px" />
          </div>
        </div>
      </motion.div>

      {/* Desktop copy */}
      <div className="hidden sm:block">
        <motion.h2
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          Unlock Your Predicted Grade
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        >
          Answer 5 questions to see:
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-2 mb-4 max-w-[260px] mx-auto text-left"
        >
          {[
            'Your predicted exam grade',
            'Exactly what topics to study',
            'AI study plan to get you to an A'
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{text}</span>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`text-xs mb-5 flex items-center justify-center gap-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        >
          <Clock className="w-3.5 h-3.5" /> Takes 3 minutes • Unlocks full app
        </motion.p>
      </div>

      {/* Mobile copy - shorter */}
      <div className="block sm:hidden">
        <motion.h2
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`text-lg font-black mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          Unlock Your Grade
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-1.5 mb-3 max-w-[200px] mx-auto text-left"
        >
          {[
            '5 questions',
            '3 minutes',
            'Full predictions'
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* CTA */}
      <Button
        onClick={onStart}
        disabled={!liveReady}
        className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20"
      >
        {liveReady ? (
          <>Start 5-Question Quiz <ArrowRight className="w-4 h-4 ml-1.5" /></>
        ) : (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Quiz...</>
        )}
      </Button>

      <button
        onClick={onSkip}
        className={`w-full text-center text-[11px] mt-2.5 py-1 font-medium ${isDark ? 'text-slate-600 hover:text-slate-500' : 'text-slate-400 hover:text-slate-500'}`}
      >
        <span className="hidden sm:inline">Skip (flashcards only, no predictions)</span>
        <span className="sm:hidden">Skip (basic only)</span>
      </button>
    </div>
  );
}