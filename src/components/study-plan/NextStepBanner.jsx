import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Target, FileText, Zap, Brain, BookOpen, Sparkles, Trophy } from "lucide-react";

const TASK_ICONS = {
  flashcards: Zap,
  teach_it: Brain,
  review_notes: BookOpen,
  practice_questions: Zap // Legacy fallback
};

export default function NextStepBanner({ lessonId, onNavigateToStudyPlan }) {
  const [nextTask, setNextTask] = useState(null);
  const [allComplete, setAllComplete] = useState(false);
  const [noStudyPlan, setNoStudyPlan] = useState(false);

  const loadNextStep = useCallback(async () => {
    if (!lessonId) return;
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lessonId,
        status: 'active'
      });

      if (plans.length === 0) {
        setNoStudyPlan(true);
        setNextTask(null);
        setAllComplete(false);
        return;
      }

      setNoStudyPlan(false);
      const plan = plans[0];
      
      if (plan.all_tasks_completed) {
        setAllComplete(true);
        setNextTask(null);
        return;
      }

      setAllComplete(false);
      const incomplete = plan.tasks?.find(t => !t.completed);
      if (incomplete) {
        setNextTask(incomplete);
      }
    } catch (error) {
      console.error("Error loading next step:", error);
    }
  }, [lessonId]);

  useEffect(() => {
    loadNextStep();
  }, [loadNextStep]);

  // Re-check when study plan finishes generating or lesson reloads
  useEffect(() => {
    const handleReload = () => loadNextStep();
    const handlePlanDone = (e) => {
      if (!e.detail?.generating) loadNextStep();
    };
    window.addEventListener('reloadLesson', handleReload);
    window.addEventListener('studyPlanGenerating', handlePlanDone);
    return () => {
      window.removeEventListener('reloadLesson', handleReload);
      window.removeEventListener('studyPlanGenerating', handlePlanDone);
    };
  }, [loadNextStep]);

  // No study plan yet
  if (noStudyPlan) {
    return (
      <button
        onClick={onNavigateToStudyPlan}
        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 transition-colors"
      >
        <Target className="w-3.5 h-3.5 text-white/80" />
        <span className="text-xs text-white font-medium">Get Study Plan</span>
        <ChevronRight className="w-3 h-3 text-white/60" />
      </button>
    );
  }

  // All tasks complete - ready for official exam
  if (allComplete) {
    return (
      <button
        onClick={onNavigateToStudyPlan}
        className="flex items-center gap-2 bg-gradient-to-r from-emerald-400/30 to-teal-400/30 hover:from-emerald-400/40 hover:to-teal-400/40 border border-emerald-400/30 rounded-full px-3 py-1.5 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
        <span className="text-xs text-white font-semibold">Ready for Exam!</span>
        <ChevronRight className="w-3 h-3 text-white/60" />
      </button>
    );
  }

  // Show next task
  if (nextTask) {
    const Icon = TASK_ICONS[nextTask.task_type] || Target;
    const remaining = nextTask.target_count - (nextTask.completed_count || 0);

    return (
      <button
        onClick={onNavigateToStudyPlan}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1.5 transition-colors group"
      >
        <Icon className="w-3.5 h-3.5 text-yellow-300" />
        <span className="text-xs text-white font-medium truncate max-w-[140px]">
          {remaining} {nextTask.task_type === 'flashcards' || nextTask.task_type === 'practice_questions' ? 'cards' : 
                       nextTask.task_type === 'teach_it' ? 'concepts' : 'sections'} left
        </span>
        <ChevronRight className="w-3 h-3 text-white/60 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return null;
}