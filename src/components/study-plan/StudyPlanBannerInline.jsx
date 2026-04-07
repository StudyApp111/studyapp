import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Target, ChevronRight, Sparkles, Zap, Brain, BookOpen } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

const TASK_ICONS = {
  flashcards: Zap,
  teach_it: Brain,
  review_notes: BookOpen,
  practice_exam: Zap
};

const TASK_LABELS = {
  flashcards: "Flashcards",
  teach_it: "Feynman",
  review_notes: "Review Notes",
  practice_exam: "Practice Quiz"
};

export default function StudyPlanBannerInline({ lessonId, onNavigateToStudyPlan, onNavigateToTab, currentTab }) {
  const { isDark } = useTheme();
  const [plan, setPlan] = useState(null);
  const [nextTask, setNextTask] = useState(null);

  const loadPlan = useCallback(async () => {
    if (!lessonId) return;
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lessonId,
        status: 'active'
      });
      if (plans.length === 0) {
        setPlan(null);
        setNextTask(null);
        return;
      }
      const p = plans[0];
      setPlan(p);
      
      if (!p.all_tasks_completed) {
        const incomplete = p.tasks?.find(t => !t.completed);
        setNextTask(incomplete || null);
      } else {
        setNextTask(null);
      }
    } catch (err) {
      console.error("Error loading study plan banner:", err);
    }
  }, [lessonId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    const handleReload = () => loadPlan();
    const handlePlanDone = (e) => {
      if (!e.detail?.generating) loadPlan();
    };
    window.addEventListener('reloadLesson', handleReload);
    window.addEventListener('studyPlanGenerating', handlePlanDone);
    window.addEventListener('studyTaskCompleted', handleReload);
    window.addEventListener('studyActivityCompleted', handleReload);
    return () => {
      window.removeEventListener('reloadLesson', handleReload);
      window.removeEventListener('studyPlanGenerating', handlePlanDone);
      window.removeEventListener('studyTaskCompleted', handleReload);
      window.removeEventListener('studyActivityCompleted', handleReload);
    };
  }, [loadPlan]);

  // Don't show on studyplan tab itself (it already has its own UI)
  if (currentTab === 'studyplan') return null;
  // Don't show if no plan exists
  if (!plan) return null;

  const grade = plan.current_predicted_grade || plan.initial_predicted_grade || '—';
  const score = plan.current_score || plan.initial_score;
  const totalTasks = plan.tasks?.length || 0;
  const completedTasks = plan.tasks?.filter(t => t.completed)?.length || 0;

  if (plan.all_tasks_completed) {
    return (
      <button
        onClick={onNavigateToStudyPlan}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors mb-2 ${
          isDark 
            ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' 
            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            All tasks complete! Ready for official exam
          </p>
          <p className={`text-[10px] ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>
            Predicted: {grade} ({score ? Math.round(score) : '—'}%)
          </p>
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`} />
      </button>
    );
  }

  if (!nextTask) return null;

  const Icon = TASK_ICONS[nextTask.task_type] || Target;
  const remaining = (nextTask.target_count || 0) - (nextTask.completed_count || 0);
  const label = TASK_LABELS[nextTask.task_type] || "Task";

  const TASK_TYPE_TO_TAB = {
    review_notes: "notes",
    flashcards: "flashcards",
    practice_exam: "exam",
    teach_it: "teachit"
  };

  const handleTaskClick = () => {
    const tab = TASK_TYPE_TO_TAB[nextTask.task_type];
    
    // If the user is already on the target tab, just go to study plan
    if (!tab || tab === currentTab || !onNavigateToTab) {
      onNavigateToStudyPlan();
      return;
    }
    
    // Dispatch the appropriate event so the tab auto-generates
    const taskPayload = {
      task_id: nextTask.task_id,
      task_type: nextTask.task_type,
      focus_topics: nextTask.focus_topics || [],
      target_competency: nextTask.target_competency || '',
      title: nextTask.title || '',
      section_title: nextTask.section_title || '',
      target_count: nextTask.target_count || 10
    };

    // Switch tab first, then dispatch event after a tick so the tab component is mounted
    onNavigateToTab(tab);
    
    setTimeout(() => {
      if (tab === "exam") {
        window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', { detail: { task: taskPayload, focus_topics: taskPayload.focus_topics, target_competency: taskPayload.target_competency } }));
      } else if (tab === "flashcards" || tab === "teachit") {
        window.dispatchEvent(new CustomEvent('navigateToStudyTask', { detail: { taskType: nextTask.task_type, task: taskPayload } }));
      } else if (tab === "notes") {
        window.dispatchEvent(new CustomEvent('generateFromStudyTask', { detail: { taskType: 'review_notes', task: taskPayload } }));
      }
    }, 100);
  };

  return (
    <button
      onClick={handleTaskClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors mb-2 ${
        isDark 
          ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' 
          : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-xs font-bold truncate ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
          Next: {label} — {remaining > 0 ? `${remaining} left` : 'Start'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className={`flex-1 h-1 rounded-full overflow-hidden max-w-[100px] ${isDark ? 'bg-white/10' : 'bg-amber-200'}`}>
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }} />
          </div>
          <span className={`text-[10px] ${isDark ? 'text-amber-400/70' : 'text-amber-700/70'}`}>
            {completedTasks}/{totalTasks} tasks • {grade}
          </span>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-amber-400/60' : 'text-amber-600/60'}`} />
    </button>
  );
}