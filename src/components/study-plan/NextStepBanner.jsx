import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Target, FileText, Zap, Brain, BookOpen, Sparkles, Trophy } from "lucide-react";

const TASK_ICONS = {
  practice_questions: FileText,
  flashcards: Zap,
  teach_it: Brain,
  review_notes: BookOpen
};

export default function NextStepBanner({ lessonId, onNavigateToStudyPlan }) {
  const [nextTask, setNextTask] = useState(null);
  const [allComplete, setAllComplete] = useState(false);
  const [noStudyPlan, setNoStudyPlan] = useState(false);

  useEffect(() => {
    if (lessonId) {
      loadNextStep();
    }
  }, [lessonId]);

  const loadNextStep = async () => {
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lessonId,
        status: 'active'
      });

      if (plans.length === 0) {
        setNoStudyPlan(true);
        return;
      }

      const plan = plans[0];
      
      if (plan.all_tasks_completed) {
        setAllComplete(true);
        return;
      }

      const incomplete = plan.tasks?.find(t => !t.completed);
      if (incomplete) {
        setNextTask(incomplete);
      }
    } catch (error) {
      console.error("Error loading next step:", error);
    }
  };

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
          {remaining} {nextTask.task_type === 'flashcards' ? 'cards' : 
                       nextTask.task_type === 'practice_questions' ? 'questions' :
                       nextTask.task_type === 'teach_it' ? 'concepts' : 'mins'} remaining
        </span>
        <ChevronRight className="w-3 h-3 text-white/60 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return null;
}