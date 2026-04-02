import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Target, FileText, Zap, Brain, BookOpen, Sparkles, Trophy } from "lucide-react";

const TASK_ICONS = {
  flashcards: Zap,
  teach_it: Brain,
  review_notes: BookOpen,
  practice_exam: Zap,
  practice_questions: Zap // Legacy fallback
};

const TASK_TYPE_TO_TAB = {
  review_notes: "notes",
  flashcards: "flashcards",
  practice_exam: "exam",
  teach_it: "teachit"
};

export default function NextStepBanner({ lessonId, onNavigateToStudyPlan, onNavigateToTab }) {
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
    window.addEventListener('studyActivityCompleted', handleReload);
    return () => {
      window.removeEventListener('reloadLesson', handleReload);
      window.removeEventListener('studyPlanGenerating', handlePlanDone);
      window.removeEventListener('studyActivityCompleted', handleReload);
    };
  }, [loadNextStep]);

  // Subscribe to study plan updates for real-time task completion detection
  useEffect(() => {
    if (!lessonId) return;
    const unsubscribe = base44.entities.StudyPlan.subscribe((event) => {
      if (event.data?.lesson_id === lessonId) {
        loadNextStep();
      }
    });
    return () => unsubscribe();
  }, [lessonId, loadNextStep]);

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

  // Navigate directly to the task's tab and dispatch generation events
  const handleTaskClick = () => {
    if (!nextTask || !onNavigateToTab) {
      onNavigateToStudyPlan();
      return;
    }
    
    const tab = TASK_TYPE_TO_TAB[nextTask.task_type] || "studyplan";
    
    // Dispatch generation event so the tab starts the task immediately
    if (tab === "exam") {
      window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
        detail: {
          task: {
            task_id: nextTask.task_id,
            focus_topics: nextTask.focus_topics || [],
            target_competency: nextTask.target_competency || '',
            title: nextTask.title || '',
            section_title: nextTask.section_title || '',
            target_count: nextTask.target_count || 1
          },
          focus_topics: nextTask.focus_topics || [],
          target_competency: nextTask.target_competency || ''
        }
      }));
    } else if (tab === "flashcards" || tab === "teachit") {
      const taskType = tab === "teachit" ? "teach_it" : "flashcards";
      window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
        detail: {
          taskType,
          task: {
            task_id: nextTask.task_id,
            focus_topics: nextTask.focus_topics || [],
            target_competency: nextTask.target_competency || '',
            title: nextTask.title || '',
            section_title: nextTask.section_title || '',
            target_count: nextTask.target_count || 10
          }
        }
      }));
    } else if (tab === "notes") {
      window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
        detail: {
          taskType: 'review_notes',
          task: {
            task_id: nextTask.task_id,
            task_type: 'review_notes',
            focus_topics: nextTask.focus_topics || [],
            target_competency: nextTask.target_competency || '',
            title: nextTask.title || '',
          }
        }
      }));
    }
    
    onNavigateToTab(tab);
  };

  // Show next task
  if (nextTask) {
    const Icon = TASK_ICONS[nextTask.task_type] || Target;
    const taskLabels = {
      flashcards: 'Flashcards',
      teach_it: 'Feynman',
      review_notes: 'Notes',
      practice_exam: 'Practice Quiz'
    };

    return (
      <button
        onClick={handleTaskClick}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1.5 transition-colors group"
      >
        <Icon className="w-3.5 h-3.5 text-yellow-300" />
        <span className="text-xs text-white font-medium truncate max-w-[140px]">
          Next: {taskLabels[nextTask.task_type] || nextTask.title}
        </span>
        <ChevronRight className="w-3 h-3 text-white/60 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return null;
}