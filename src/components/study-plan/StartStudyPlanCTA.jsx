import React, { useMemo } from "react";
import { Play, ArrowRight, CheckCircle2, Copy, Brain, FileText, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const TASK_TYPE_TO_TAB = {
  review_notes: "notes",
  flashcards: "flashcards",
  practice_exam: "exam",
  teach_it: "teachit"
};

const TASK_TYPE_ICONS = {
  review_notes: FileText,
  flashcards: Copy,
  practice_exam: Zap,
  teach_it: Brain
};

const TASK_TYPE_LABELS = {
  review_notes: "Review Notes",
  flashcards: "Flashcards",
  practice_exam: "Practice Quiz",
  teach_it: "Feynman"
};

export default function StartStudyPlanCTA({ studyPlan, topicSuggestions, onNavigate }) {
  const { isDark } = useTheme();

  // Use study plan tasks directly — they are the source of truth
  const planTasks = studyPlan?.tasks || [];
  const completedCount = planTasks.filter(t => t.completed).length;
  const nextTask = planTasks.find(t => !t.completed);
  const hasStarted = completedCount > 0;
  const allComplete = planTasks.length > 0 && completedCount === planTasks.length;

  if (planTasks.length === 0 || allComplete) return null;

  const Icon = nextTask ? (TASK_TYPE_ICONS[nextTask.task_type] || Play) : Play;
  const formatLabel = TASK_TYPE_LABELS[nextTask?.task_type] || 'Tasks';

  const handleClick = () => {
    if (!nextTask) return;
    
    const tab = TASK_TYPE_TO_TAB[nextTask.task_type] || "notes";
    
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
      window.dispatchEvent(new CustomEvent('navigateToStudyTask', {
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
      // Dispatch study task event so NotesTab knows which task_id to associate
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
    
    onNavigate(tab);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-3 md:px-4 w-full"
    >
      <button
        onClick={handleClick}
        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all active:scale-[0.99] p-4 text-left"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm md:text-base leading-tight">
              {hasStarted 
                ? `Continue Study Plan: ${formatLabel}` 
                : 'Start Study Plan'
              }
            </p>
            <p className="text-white/70 text-xs mt-0.5 truncate">
              {hasStarted
                ? `${nextTask.title || nextTask.target_competency}`
                : `Begin with ${formatLabel}: "${nextTask.title || nextTask.target_competency}"`
              }
            </p>
            {hasStarted && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 bg-white/20 rounded-full max-w-[120px]">
                  <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${Math.round((completedCount / planTasks.length) * 100)}%` }} />
                </div>
                <span className="text-white/60 text-[10px] font-medium">{completedCount}/{planTasks.length}</span>
              </div>
            )}
          </div>
          <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>
      </button>
    </motion.div>
  );
}