import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Sparkles, ArrowRight, FolderOpen, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useGuestSession } from "@/components/guest/GuestSessionContext";

export default function TopicConfirmationBanner({ lesson, onGoToDiagnostic, diagnosticReady, diagnosticCompleted }) {
  const { isGuest, guestData } = useGuestSession();
  const { isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1);
  const [deselectedSections, setDeselectedSections] = useState(new Set());
  const [deselectedSubtopics, setDeselectedSubtopics] = useState(new Set());

  const topics = lesson?.topics || [];
  const dismissKey = `topic_flow_dismissed_${lesson?.id}`;
  const topLevelTopics = topics.filter(t => t.title);

  useEffect(() => {
    if (lesson?.id && localStorage.getItem(dismissKey)) setDismissed(true);
  }, [lesson?.id]);

  useEffect(() => {
    if (!lesson?.id || topLevelTopics.length === 0) return;
    const saved = lesson?.selected_topics;
    if (saved?.length > 0 && saved.length < topLevelTopics.length) {
      const allTitles = topLevelTopics.map(t => t.title);
      const removed = new Set(allTitles.filter(t => !saved.includes(t)));
      setDeselectedSections(removed);
    }
  }, [lesson?.id]);

  if (topLevelTopics.length === 0 || dismissed || diagnosticCompleted) return null;

  const toggleSection = (title) => {
    setDeselectedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
        // Re-select all subtopics for this section
        const section = topLevelTopics.find(t => t.title === title);
        if (section?.subtopics) {
          setDeselectedSubtopics(prevSub => {
            const nextSub = new Set(prevSub);
            section.subtopics.forEach(st => nextSub.delete(`${title}::${st.title}`));
            return nextSub;
          });
        }
      } else {
        next.add(title);
        // Deselect all subtopics for this section too
        const section = topLevelTopics.find(t => t.title === title);
        if (section?.subtopics) {
          setDeselectedSubtopics(prevSub => {
            const nextSub = new Set(prevSub);
            section.subtopics.forEach(st => nextSub.add(`${title}::${st.title}`));
            return nextSub;
          });
        }
      }
      return next;
    });
  };

  const toggleSubtopic = (sectionTitle, subtopicTitle) => {
    const key = `${sectionTitle}::${subtopicTitle}`;
    setDeselectedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDeselectAll = () => {
    if (deselectedSections.size === topLevelTopics.length) {
      setDeselectedSections(new Set());
      setDeselectedSubtopics(new Set());
    } else {
      setDeselectedSections(new Set(topLevelTopics.map(t => t.title)));
      const allSubKeys = new Set();
      topLevelTopics.forEach(s => {
        s.subtopics?.forEach(st => allSubKeys.add(`${s.title}::${st.title}`));
      });
      setDeselectedSubtopics(allSubKeys);
    }
  };

  const selectedSections = topLevelTopics.filter(t => !deselectedSections.has(t.title));
  const selectedCount = selectedSections.length;

  const handleConfirmTopics = async () => {
    const allTitles = [];
    selectedSections.forEach(t => {
      allTitles.push(t.title);
      t.subtopics?.forEach(st => {
        const key = `${t.title}::${st.title}`;
        if (!deselectedSubtopics.has(key)) {
          allTitles.push(st.title);
        }
      });
    });
    
    // For guests, use backend function; for auth users, use direct entity update
    if (isGuest && guestData?.fingerprint) {
      try {
        await base44.functions.invoke('updateGuestLesson', {
          fingerprint: guestData.fingerprint,
          lesson_id: lesson.id,
          updates: { selected_topics: allTitles }
        });
      } catch (err) {
        console.error('Error updating guest lesson:', err);
      }
    } else {
      await base44.entities.Lesson.update(lesson.id, { selected_topics: allTitles });
    }
    
    window.dispatchEvent(new Event('reloadLesson'));
    setStep(2);
  };

  const closeDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  const handleStartDiagnostic = () => {
    closeDismiss();
    onGoToDiagnostic();
  };

  const handleSkipDiagnostic = () => {
    localStorage.setItem(`diagnostic_skipped_${lesson?.id}`, 'true');
    closeDismiss();
    window.dispatchEvent(new CustomEvent('diagnosticSkipped', { detail: { lessonId: lesson.id } }));
  };

  const allDeselected = deselectedSections.size === topLevelTopics.length;

  return (
    <Dialog open={!dismissed} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-40px)] sm:w-[440px] max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 bg-[#14141e] [&>button]:hidden"
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
            deselectedSections={deselectedSections}
            deselectedSubtopics={deselectedSubtopics}
            toggleSection={toggleSection}
            toggleSubtopic={toggleSubtopic}
            handleDeselectAll={handleDeselectAll}
            allDeselected={allDeselected}
            selectedCount={selectedCount}
            onConfirm={handleConfirmTopics}
          />
        ) : (
          <Step2Diagnostic
            onStart={handleStartDiagnostic}
            onSkip={handleSkipDiagnostic}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Step 1: Topic selection ─── */
function Step1Topics({ lesson, topLevelTopics, deselectedSections, deselectedSubtopics, toggleSection, toggleSubtopic, handleDeselectAll, allDeselected, selectedCount, onConfirm }) {
  return (
    <div className="px-5 pb-5 pt-2">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold tracking-wide text-white">Document Analyzed</span>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-400 px-2">
          We read your <span className="font-semibold text-slate-200">{lesson?.course_name || 'document'}</span> and found{' '}
          <span className="font-semibold text-slate-200">{topLevelTopics.length} key topics</span> to help you study.
        </p>
      </div>

      <div className="h-px mb-3 bg-white/10" />

      {/* Section/topic list — NO vertical scroll, text wraps */}
      <div className="space-y-0.5 mb-3 -mx-1 px-1">
        {topLevelTopics.map((section, idx) => {
          const isSectionSelected = !deselectedSections.has(section.title);
          const subtopics = section.subtopics || [];

          return (
            <div key={idx}>
              {/* Section row */}
              <button
                onClick={() => toggleSection(section.title)}
                className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                  isSectionSelected ? 'bg-white/[0.04]' : 'bg-white/[0.02] opacity-40'
                }`}
              >
                <FolderOpen className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSectionSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                <span
                  className={`text-[13px] font-semibold flex-1 break-words ${
                    isSectionSelected ? 'text-slate-200' : 'text-slate-500 line-through'
                  }`}
                >
                  {section.title}
                </span>
                {isSectionSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />}
              </button>

              {/* Subtopics — selectable */}
              {isSectionSelected && subtopics.length > 0 && (
                <div className="ml-8 mt-0.5 space-y-0.5">
                  {subtopics.map((st, stIdx) => {
                    const subKey = `${section.title}::${st.title}`;
                    const isSubSelected = !deselectedSubtopics.has(subKey);
                    return (
                      <button
                        key={stIdx}
                        onClick={() => toggleSubtopic(section.title, st.title)}
                        className={`w-full flex items-start gap-2 py-1 px-2 rounded text-left transition-all ${
                          isSubSelected ? '' : 'opacity-40'
                        }`}
                      >
                        <span className={`text-[12px] flex-1 break-words ${isSubSelected ? 'text-slate-400' : 'text-slate-600 line-through'}`}>
                          {st.title}
                        </span>
                        {isSubSelected && <CheckCircle2 className="w-3 h-3 text-emerald-500/60 flex-shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[12px] mb-3 text-slate-500">Look good? Tap any to remove.</p>

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

/* ─── Step 2: Diagnostic prompt ─── */
function Step2Diagnostic({ onStart, onSkip }) {
  const [revealed, setRevealed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const timerRef = useRef(null);

  const handlePointerDown = () => {
    setRevealed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  const handlePointerUp = () => {
    timerRef.current = setTimeout(() => setRevealed(false), 2000);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleStartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isStarting) return;
    setIsStarting(true);
    console.log('🎯 Start Quiz clicked');
    // Small delay to ensure UI feedback
    setTimeout(() => {
      onStart();
    }, 50);
  };

  return (
    <div className="px-5 pb-5 pt-2 text-center">
      {/* Blurred grade pill */}
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex justify-center mb-4 sm:mb-5">
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-emerald-900/30 border-emerald-500/30 cursor-pointer select-none touch-none"
        >
          <div
            className="absolute inset-0 rounded-xl z-10 transition-all duration-300"
            style={{
              backdropFilter: revealed ? 'blur(0px)' : 'blur(4px)',
              WebkitBackdropFilter: revealed ? 'blur(0px)' : 'blur(4px)',
              background: revealed ? 'transparent' : 'rgba(255,255,255,0.03)',
            }}
          />
          <span className="text-2xl font-black text-emerald-400 select-none">A</span>
          <span className="text-sm font-bold select-none text-emerald-300">??%</span>
          <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
            Unlock <ArrowRight className="w-3 h-3 inline -mt-px" />
          </div>
        </div>
      </motion.div>

      {/* Desktop copy */}
      <div className="hidden sm:block">
        <h2 className="text-xl font-black mb-2 text-white">Unlock Your Predicted Grade</h2>
        <p className="text-sm mb-4 text-slate-400">Answer 5 questions to see:</p>
        <div className="space-y-2 mb-4 max-w-[280px] mx-auto text-left">
          {['Your predicted exam grade', 'Exactly what topics to study', 'Custom study plan to get you to an A+'].map((t, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-200">{t}</span>
            </div>
          ))}
        </div>
        <p className="text-xs mb-5 flex items-center justify-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5" /> Takes 3 minutes • Unlocks full app
        </p>
      </div>

      {/* Mobile copy */}
      <div className="block sm:hidden">
        <h2 className="text-lg font-black mb-3 text-white">Unlock Your Grade</h2>
        <div className="space-y-1.5 mb-3 max-w-[200px] mx-auto text-left">
          {['5 questions', '3 minutes', 'Full predictions'].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-200">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA - use native button with explicit touch handling */}
      <button
        type="button"
        onClick={handleStartClick}
        onTouchEnd={handleStartClick}
        disabled={isStarting}
        className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:from-emerald-700 active:to-teal-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-70 touch-manipulation"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {isStarting ? 'Starting...' : 'Start 5-Question Quiz'} <ArrowRight className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip(); }}
        onTouchEnd={(e) => { e.preventDefault(); onSkip(); }}
        className="w-full text-center text-[11px] mt-2.5 py-2 font-medium text-slate-600 hover:text-slate-500 touch-manipulation"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <span className="hidden sm:inline">Skip for now (you'll miss out on your study plan)</span>
        <span className="sm:hidden">Skip (basic only)</span>
      </button>
    </div>
  );
}