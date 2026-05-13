import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { BookMarked, Zap, Brain, CheckCircle2, ChevronRight, Sparkles, Loader2, Lock } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Pillar 1: Practice Hub — the new default first experience.
 * Shows 3 auto-generated practice activities in sequential order:
 *   1. Flashcards (Active recall)
 *   2. Practice Quiz (Test yourself)
 *   3. Teach It (Feynman technique)
 *
 * Auto-generation happens server-side via autoGeneratePracticeSession.
 * This component polls for the assets and hands off to existing tabs.
 */
export default function PracticeHubTab({ lesson, exams, onNavigateToTab }) {
  const { isDark } = useTheme();
  const [flashcardCount, setFlashcardCount] = useState(null);
  const [teachItCount, setTeachItCount] = useState(null);
  const [autoExam, setAutoExam] = useState(null);
  const [polling, setPolling] = useState(true);
  const [pollAttempts, setPollAttempts] = useState(0);

  // Poll for auto-generated assets — they arrive at different times
  useEffect(() => {
    if (!lesson?.id) return;
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 30; // ~60s total

    const checkAssets = async () => {
      if (cancelled) return;
      try {
        const [fc, ti] = await Promise.all([
          base44.entities.Flashcard.filter({ lesson_id: lesson.id, study_plan_task_id: 'auto_practice_v1' }),
          base44.entities.TeachItCard.filter({ lesson_id: lesson.id, study_plan_task_id: 'auto_practice_v1' }),
        ]);
        if (cancelled) return;
        setFlashcardCount(fc.length);
        setTeachItCount(ti.length);

        // Find the auto-generated practice exam (title === 'Practice Test: Quick Practice')
        const quickPractice = (exams || []).find(e =>
          e.exam_type === 'practice' && (e.title?.includes('Quick Practice') || e.focus_competency === 'General understanding')
        );
        setAutoExam(quickPractice || null);

        const allReady = fc.length > 0 && ti.length > 0 && quickPractice?.questions?.length > 0;
        if (allReady) {
          setPolling(false);
          return;
        }

        pollCount++;
        setPollAttempts(pollCount);
        if (pollCount >= maxPolls) {
          setPolling(false); // give up gracefully
          return;
        }
        setTimeout(checkAssets, 2000);
      } catch (err) {
        console.warn('PracticeHub poll error:', err.message);
        pollCount++;
        if (pollCount < maxPolls && !cancelled) setTimeout(checkAssets, 3000);
      }
    };
    checkAssets();
    return () => { cancelled = true; };
  }, [lesson?.id, exams]);

  // Track completion state from existing entities
  const flashcardsReady = (flashcardCount ?? 0) > 0;
  const examReady = !!(autoExam?.questions?.length > 0);
  const teachItReady = (teachItCount ?? 0) > 0;

  // "Done" detection — pull from same auto_practice_v1 batch
  const [flashcardsDone, setFlashcardsDone] = useState(false);
  const [teachItDone, setTeachItDone] = useState(false);
  const examDone = !!autoExam?.completed;

  useEffect(() => {
    if (!lesson?.id) return;
    let cancelled = false;
    const checkDone = async () => {
      try {
        const [fc, ti] = await Promise.all([
          base44.entities.Flashcard.filter({ lesson_id: lesson.id, study_plan_task_id: 'auto_practice_v1' }),
          base44.entities.TeachItCard.filter({ lesson_id: lesson.id, study_plan_task_id: 'auto_practice_v1' }),
        ]);
        if (cancelled) return;
        // Flashcards "done" = all reviewed at least once
        setFlashcardsDone(fc.length > 0 && fc.every(c => (c.review_count || 0) >= 1));
        setTeachItDone(ti.length > 0 && ti.every(c => c.completed));
      } catch {}
    };
    checkDone();
    // Re-check whenever user comes back to this tab (window focus)
    const onFocus = () => checkDone();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, [lesson?.id, exams]);

  const steps = [
    {
      id: 'flashcards',
      title: 'Quick Flashcards',
      description: 'Master key concepts with active recall',
      icon: BookMarked,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-500/20 to-pink-500/20',
      ready: flashcardsReady,
      done: flashcardsDone,
      onStart: () => onNavigateToTab('flashcards'),
      count: flashcardCount,
      label: flashcardCount ? `${flashcardCount} cards` : 'Preparing...',
    },
    {
      id: 'quiz',
      title: 'Practice Quiz',
      description: 'Test what you just learned',
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/20 to-cyan-500/20',
      ready: examReady,
      done: examDone,
      onStart: () => {
        if (autoExam) {
          // Open the auto-generated exam directly in ExamTab
          if (autoExam.completed) {
            window.dispatchEvent(new CustomEvent('viewExamResults', { detail: { examId: autoExam.id } }));
          }
          onNavigateToTab('exam');
        }
      },
      count: autoExam?.questions?.length,
      label: autoExam?.questions?.length ? `${autoExam.questions.length} questions` : 'Preparing...',
    },
    {
      id: 'teachit',
      title: 'Teach It Back',
      description: 'Explain it in your own words',
      icon: Brain,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-500/20 to-orange-500/20',
      ready: teachItReady,
      done: teachItDone,
      onStart: () => onNavigateToTab('teachit'),
      count: teachItCount,
      label: teachItCount ? `${teachItCount} concept${teachItCount > 1 ? 's' : ''}` : 'Preparing...',
    },
  ];

  // Determine current step — first step that's ready but not done
  const currentStepIdx = steps.findIndex(s => s.ready && !s.done);
  const allDone = steps.every(s => s.done);
  const completedCount = steps.filter(s => s.done).length;

  return (
    <div className={`w-full min-h-[70vh] ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <div className="max-w-2xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-5 md:mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className={`text-xs font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Auto-generated from your notes</span>
          </div>
          <h1 className={`text-2xl md:text-3xl font-black mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {allDone ? '🎉 Practice Complete!' : 'Your Practice Session'}
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {allDone
              ? 'Great work — explore more practice in other tabs.'
              : 'Complete 3 quick activities to lock in your learning'}
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="mb-5 md:mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Progress
            </span>
            <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {completedCount}/{steps.length}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / steps.length) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500"
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = idx === currentStepIdx;
            const isLocked = !step.ready;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card
                  className={`overflow-hidden border-2 transition-all ${
                    step.done
                      ? isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'
                      : isCurrent
                        ? isDark ? 'bg-[#12121a] border-purple-500/50 shadow-lg shadow-purple-500/10' : 'bg-white border-purple-300 shadow-lg shadow-purple-200/40'
                        : isDark ? 'bg-[#12121a]/60 border-white/10' : 'bg-white/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3 md:p-4">
                    {/* Step number / status icon */}
                    <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${
                      step.done
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        : isLocked
                          ? isDark ? 'bg-slate-700' : 'bg-slate-200'
                          : `bg-gradient-to-br ${step.gradient}`
                    }`}>
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      ) : isLocked ? (
                        <Loader2 className={`w-4 h-4 md:w-5 md:h-5 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      ) : (
                        <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      )}
                    </div>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${
                          step.done ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                            : isCurrent ? (isDark ? 'text-purple-400' : 'text-purple-600')
                            : (isDark ? 'text-slate-500' : 'text-slate-400')
                        }`}>
                          Step {idx + 1}
                        </span>
                        {step.done && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                          }`}>Done</span>
                        )}
                        {isCurrent && !step.done && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full animate-pulse ${
                            isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                          }`}>Up next</span>
                        )}
                      </div>
                      <h3 className={`text-sm md:text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {step.title}
                      </h3>
                      <p className={`text-xs md:text-[13px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {step.description}
                      </p>
                      <p className={`text-[11px] mt-0.5 font-medium ${
                        isLocked ? (isDark ? 'text-slate-500' : 'text-slate-400')
                          : (isDark ? 'text-slate-300' : 'text-slate-600')
                      }`}>
                        {step.label}
                      </p>
                    </div>

                    {/* CTA */}
                    <div className="flex-shrink-0">
                      {isLocked ? (
                        <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <Button
                          onClick={step.onStart}
                          size="sm"
                          className={`h-9 md:h-10 px-3 md:px-4 font-bold text-xs md:text-sm rounded-xl ${
                            step.done
                              ? isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : `bg-gradient-to-r ${step.gradient} hover:opacity-90 text-white shadow-md`
                          }`}
                        >
                          {step.done ? 'Review' : 'Start'}
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Polling status footer */}
        {polling && pollAttempts > 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-4 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
            Preparing your practice materials...
          </motion.div>
        )}

        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            <Card className={`p-4 md:p-5 border-2 ${isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
              <div className="text-center">
                <div className="text-3xl mb-2">🚀</div>
                <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Keep the momentum going
                </h3>
                <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Generate more flashcards, quizzes, or use Feynman cards to deepen mastery.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => onNavigateToTab('flashcards')} className="text-xs">
                    <BookMarked className="w-3.5 h-3.5 mr-1.5" /> More Flashcards
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigateToTab('exam')} className="text-xs">
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> More Quizzes
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}