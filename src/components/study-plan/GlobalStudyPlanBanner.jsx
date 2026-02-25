import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight, CheckCircle2, Play, FileText, Copy, Brain, Zap, Target } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

const TASK_TYPE_TO_FORMAT = {
  review_notes: "Review Notes",
  flashcards: "Flashcards",
  practice_exam: "Practice Quiz",
  teach_it: "Feynman"
};

const TASK_TYPE_TO_TAB = {
  review_notes: "notes",
  flashcards: "flashcards",
  practice_exam: "exam",
  teach_it: "teachit"
};

const TASK_ICONS = {
  review_notes: FileText,
  flashcards: Copy,
  practice_exam: Zap,
  teach_it: Brain,
};

const TASK_UNIT = {
  review_notes: "notes",
  flashcards: "cards",
  practice_exam: "quizzes",
  teach_it: "concepts"
};

export default function GlobalStudyPlanBanner({ lessonId, activeTab, onNavigate }) {
  const { isDark } = useTheme();
  const [studyPlan, setStudyPlan] = useState(null);

  useEffect(() => {
    if (!lessonId) return;
    loadPlan();
    
    const unsubscribe = base44.entities.StudyPlan.subscribe((event) => {
      if (event.data?.lesson_id === lessonId && event.data?.status === 'active') {
        setStudyPlan(event.data);
      }
    });
    return () => unsubscribe();
  }, [lessonId]);

  const loadPlan = async () => {
    const plans = await base44.entities.StudyPlan.filter({ lesson_id: lessonId, status: 'active' });
    if (plans.length > 0) setStudyPlan(plans[0]);
  };

  // Find the next incomplete task from the study plan's tasks array
  const nextTask = useMemo(() => {
    if (!studyPlan?.tasks) return null;
    return studyPlan.tasks.find(t => !t.completed);
  }, [studyPlan?.tasks]);

  const completedCount = studyPlan?.tasks?.filter(t => t.completed).length || 0;
  const totalCount = studyPlan?.tasks?.length || 0;
  const hasStarted = completedCount > 0;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  // Don't show if no plan, no tasks, or on the study plan tab itself
  if (!studyPlan || totalCount === 0 || activeTab === 'studyplan') return null;

  // All tasks complete
  if (allComplete) {
    return (
      <div className={`mx-2 mt-2 rounded-xl border px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
        <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <span className={`text-xs font-semibold flex-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
          Study Plan Complete! Ready for your official exam.
        </span>
        <button
          onClick={() => onNavigate('studyplan')}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30' : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'}`}
        >
          View
        </button>
      </div>
    );
  }

  if (!nextTask) return null;

  const nextTab = TASK_TYPE_TO_TAB[nextTask.task_type] || 'studyplan';
  const isOnCorrectTab = activeTab === nextTab;
  const formatLabel = TASK_TYPE_TO_FORMAT[nextTask.task_type] || 'Task';
  const Icon = TASK_ICONS[nextTask.task_type] || Target;
  const topicLabel = nextTask.focus_topics?.[0] || nextTask.title || formatLabel;

  // If user is already on the tab for this task, show greyed-out "current" state
  if (isOnCorrectTab) {
    return (
      <div className={`mx-2 mt-2 rounded-xl border px-3 py-2 flex items-center gap-2.5 ${isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50/70 border-emerald-200/70'}`}>
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
          <Icon className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-tight truncate ${isDark ? 'text-emerald-300/80' : 'text-emerald-700/80'}`}>
            Study Plan: {formatLabel}
          </p>
          <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {topicLabel} · {completedCount}/{totalCount} done
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400/70' : 'bg-emerald-100 text-emerald-600/70'}`}>
          Current
        </span>
      </div>
    );
  }

  // Active CTA to navigate to the next task's tab
  return (
    <button
      onClick={() => {
        // Dispatch generation event for the task
        const eventMap = {
          flashcards: "generateFromStudyTask",
          teachit: "generateFromStudyTask",
          exam: "generatePracticeExamFromTask"
        };
        const eventName = eventMap[nextTab];
        if (eventName) {
          window.dispatchEvent(new CustomEvent(eventName, {
            detail: {
              taskType: nextTask.task_type,
              task: nextTask
            }
          }));
        }
        onNavigate(nextTab);
      }}
      className={`mx-2 mt-2 w-[calc(100%-16px)] rounded-xl border px-3 py-2 flex items-center gap-2.5 transition-all active:scale-[0.99] ${
        isDark 
          ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40' 
          : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-300'
      }`}
    >
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
        <Icon className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-xs font-bold leading-tight truncate ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
          {hasStarted ? `Continue: ${formatLabel}` : `Start Study Plan: ${formatLabel}`}
        </p>
        <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {topicLabel} · {completedCount}/{totalCount} done
        </p>
      </div>
      <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
    </button>
  );
}