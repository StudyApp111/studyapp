import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Sparkles, ArrowRight, FolderOpen, Clock, Loader2, ChevronDown } from "lucide-react";
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
        className="w-[calc(100vw-32px)] sm:w-[420px] max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-[#14141e] [&>button]:hidden"
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
            liveReady={liveReady}
            onStart={handleStartDiagnostic}
            onSkip={handleSkipDiagnostic}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExpandableText({ text, className }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, [text]);

  if (!isTruncated && !expanded) {
    return <span ref={textRef} className={`${className} truncate block`}>{text}</span>;
  }

  return (
    <div className="flex-1 min-w-0">
      <span
        ref={textRef}
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className={`${className} block cursor-pointer ${expanded ? 'whitespace-normal break-words' : 'truncate'}`}
      >
        {text}
      </span>
    </div>
  );
}

function Step1Topics({ lesson, topLevelTopics, deselected, toggleTopic, handleDeselectAll, allDeselected, selectedCount, onConfirm }) {
  // Build section -> subtopic hierarchy
  const sections = topLevelTopics.map(topic => ({
    title: topic.title,
    subtopics: topic.subtopics || [],
    isSelected: !deselected.has(topic.title)
  }));

  return (
    <div className="px-4 sm:px-6 pb-5 pt-2">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold tracking-wide text-white">Document Analyzed</span>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-400">
          We read your <span className="font-semibold text-slate-200">{lesson?.course_name || 'document'}</span> and found{' '}
          <span className="font-semibold text-slate-200">{topLevelTopics.length} key topics</span> to help you study.
        </p>
      </div>

      <div className="h-px mb-3 bg-white/10" />

      {/* Section/topic list */}
      <div className="space-y-0.5 mb-3 max-h-[40vh] overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx}>
            {/* Section row */}
            <button
              onClick={() => toggleTopic(section.title)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                section.isSelected ? 'bg-white/[0.04]' : 'bg-white/[0.02] opacity-40'
              }`}
            >
              <FolderOpen className={`w-4 h-4 flex-shrink-0 ${section.isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
              <ExpandableText
                text={section.title}
                className={`text-[13px] font-semibold ${
                  section.isSelected ? 'text-slate-200' : 'text-slate-500 line-through'
                }`}
              />
              {section.isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
            </button>

            {/* Subtopics indented under section */}
            {section.isSelected && section.subtopics.length > 0 && (
              <div className="ml-7 space-y-0.5 mt-0.5">
                {section.subtopics.map((st, stIdx) => (
                  <div
                    key={stIdx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md"
                  >
                    <ExpandableText
                      text={st.title}
                      className="text-[12px] text-slate-400"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[12px] mb-3 text-slate-500">
        Look good? Tap any to remove.
      </p>

      <Button
        onClick={onConfirm}
        disabled={selectedCount === 0}
        className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20"
      >
        Perfect, Let's Start <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>

      <button
        onClick={handleDeselectAll}
        className="w-full text-center text-[11px] mt-2.5 py-1 font-semibold text-purple-400 hover:text-purple-300"
      >
        {allDeselected ? 'Select All' : 'Deselect All'}
      </button>
    </div>
  );
}

function Step2Diagnostic({ liveReady, onStart, onSkip }) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef(null);

  const handlePointerDown = () => {
    setRevealed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handlePointerUp = () => {
    timerRef.current = setTimeout(() => setRevealed(false), 2000);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="px-4 sm:px-6 pb-5 pt-2 text-center">
      {/* Blurred grade pill - hold to reveal */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center mb-4 sm:mb-5"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-emerald-900/30 border-emerald-500/30 cursor-pointer select-none touch-none"
        >
          {/* Blur overlay */}
          <div
            className="absolute inset-0 rounded-xl z-10 transition-all duration-300"
            style={{
              backdropFilter: revealed ? 'blur(0px)' : 'blur(4px)',
              WebkitBackdropFilter: revealed ? 'blur(0px)' : 'blur(4px)',
              background: revealed ? 'transparent' : 'rgba(255,255,255,0.03)',
            }}
          />
          <span className="text-2xl font-black text-emerald-400 select-none" aria-hidden>A</span>
          <span className="text-sm font-bold select-none text-emerald-300" aria-hidden>??%</span>
          <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
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
          className="text-xl font-black mb-2 text-white"
        >
          Unlock Your Predicted Grade
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm mb-4 text-slate-400"
        >
          Answer 5 questions to see:
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-2 mb-4 max-w-[280px] mx-auto text-left"
        >
          {[
            'Your predicted exam grade',
            'Exactly what topics to study',
            'Custom study plan to get you to an A+'
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-200">{text}</span>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs mb-5 flex items-center justify-center gap-1.5 text-slate-500"
        >
          <Clock className="w-3.5 h-3.5" /> Takes 3 minutes • Unlocks full app
        </motion.p>
      </div>

      {/* Mobile copy */}
      <div className="block sm:hidden">
        <motion.h2
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-lg font-black mb-3 text-white"
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
              <span className="text-sm font-medium text-slate-200">{text}</span>
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
        className="w-full text-center text-[11px] mt-2.5 py-1 font-medium text-slate-600 hover:text-slate-500"
      >
        <span className="hidden sm:inline">Skip for now (you'll miss out on your study plan)</span>
        <span className="sm:hidden">Skip (basic only)</span>
      </button>
    </div>
  );
}