import React, { useState, useEffect, useMemo } from "react";
import { Play, ArrowRight, CheckCircle2, Copy, Brain, FileText, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const FORMAT_TO_TAB = {
  "Review Notes": "notes",
  "Flashcards": "flashcards",
  "Practice Test": "exam",
  "Feynman Technique": "teachit"
};

const FORMAT_ICONS = {
  "Review Notes": FileText,
  "Flashcards": Copy,
  "Practice Test": Zap,
  "Feynman Technique": Brain
};

const TASK_TYPE_TO_FORMAT = {
  review_notes: "Review Notes",
  flashcards: "Flashcards",
  practice_exam: "Practice Test",
  teach_it: "Feynman Technique"
};

export default function StartStudyPlanCTA({ studyPlan, topicSuggestions, onNavigate, onStartTask }) {
  const { isDark } = useTheme();

  // Build ordered flat list of all tasks from topic suggestions (sections → topics)
  const allTasks = useMemo(() => {
    if (!topicSuggestions || topicSuggestions.length === 0) return [];
    const tasks = [];
    for (const section of topicSuggestions) {
      for (const topic of (section.suggested_topics || [])) {
        tasks.push({
          sectionTitle: section.section_title,
          topicTitle: topic.topic_title,
          format: topic.format,
          tab: FORMAT_TO_TAB[topic.format] || "flashcards"
        });
      }
    }
    return tasks;
  }, [topicSuggestions]);

  // Build set of completed task keys from study plan
  const completedKeys = useMemo(() => {
    const keys = new Set();
    const planTasks = studyPlan?.tasks || [];
    for (const task of planTasks) {
      if (task.completed) {
        const format = TASK_TYPE_TO_FORMAT[task.task_type] || '';
        for (const ft of (task.focus_topics || [])) {
          keys.add(`${ft}::${format}`);
        }
        // Section-level completion
        if (task.section_title) {
          keys.add(`section::${task.section_title}::${format}`);
        }
      }
    }
    return keys;
  }, [studyPlan?.tasks]);

  const isTaskCompleted = (task) => {
    return completedKeys.has(`${task.topicTitle}::${task.format}`) || 
           completedKeys.has(`section::${task.sectionTitle}::${task.format}`);
  };

  // Find the first incomplete task
  const nextTask = allTasks.find(t => !isTaskCompleted(t));
  const completedCount = allTasks.filter(t => isTaskCompleted(t)).length;
  const hasStarted = completedCount > 0;
  const allComplete = allTasks.length > 0 && completedCount === allTasks.length;

  if (allTasks.length === 0 || allComplete) return null;

  const Icon = nextTask ? (FORMAT_ICONS[nextTask.format] || Play) : Play;
  const formatLabel = nextTask?.format || 'Tasks';

  const handleClick = () => {
    if (!nextTask) return;
    
    const tab = FORMAT_TO_TAB[nextTask.format] || "flashcards";
    
    // Dispatch generation event for the specific task type so it starts immediately
    if (tab === "exam") {
      window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
        detail: {
          task: {
            task_id: `cta_${nextTask.sectionTitle}_${nextTask.topicTitle}`,
            focus_topics: [nextTask.topicTitle],
            target_competency: nextTask.topicTitle,
            title: `${nextTask.sectionTitle}: ${nextTask.topicTitle}`,
            section_title: nextTask.sectionTitle,
            target_count: 1
          },
          focus_topics: [nextTask.topicTitle],
          target_competency: nextTask.topicTitle
        }
      }));
    } else if (tab === "flashcards" || tab === "teachit") {
      const taskType = tab === "teachit" ? "teach_it" : "flashcards";
      window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
        detail: {
          taskType,
          task: {
            focus_topics: [nextTask.topicTitle],
            target_competency: nextTask.topicTitle,
            title: `${nextTask.sectionTitle}: ${nextTask.topicTitle}`,
            section_title: nextTask.sectionTitle,
            target_count: tab === "flashcards" ? 10 : 3
          }
        }
      }));
    }
    // For notes, just navigate — notes tab has its own generate CTA
    
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
                ? `${nextTask.topicTitle} · ${nextTask.sectionTitle}`
                : `Begin with ${formatLabel} on "${nextTask.topicTitle}"`
              }
            </p>
            {hasStarted && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 bg-white/20 rounded-full max-w-[120px]">
                  <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${Math.round((completedCount / allTasks.length) * 100)}%` }} />
                </div>
                <span className="text-white/60 text-[10px] font-medium">{completedCount}/{allTasks.length}</span>
              </div>
            )}
          </div>
          <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>
      </button>
    </motion.div>
  );
}