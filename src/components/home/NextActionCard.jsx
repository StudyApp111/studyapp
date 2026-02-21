import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Zap, Layers, Brain, FileText, Target, Clock, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const TASK_ICONS = {
  flashcards: Layers,
  teach_it: Brain,
  review_notes: FileText,
  practice_exam: Zap
};

const TASK_LABELS = {
  flashcards: 'Flashcards',
  teach_it: 'Feynman',
  review_notes: 'Review Notes',
  practice_exam: 'Practice Quiz'
};

const TASK_COLORS = {
  flashcards: 'from-blue-500 to-cyan-500',
  teach_it: 'from-purple-500 to-pink-500',
  review_notes: 'from-amber-500 to-orange-500',
  practice_exam: 'from-emerald-500 to-teal-500'
};

export default function NextActionCard({ lesson, studyPlan, tasksRemaining }) {
  if (!lesson) return null;

  const currentGrade = studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || 'N/A';
  const nextTask = studyPlan?.tasks?.find(t => !t.completed);
  const TaskIcon = nextTask ? TASK_ICONS[nextTask.task_type] || Target : BookOpen;
  const taskColor = nextTask ? TASK_COLORS[nextTask.task_type] || 'from-purple-500 to-indigo-500' : 'from-purple-500 to-indigo-500';

  // Determine what action to show
  let actionText = "Start Diagnostic";
  let actionDescription = "Take your first exam to get a grade prediction";
  
  if (studyPlan && nextTask) {
    actionText = nextTask.title || `${nextTask.task_type} Task`;
    actionDescription = nextTask.description || "Continue your study plan";
  } else if (studyPlan && !nextTask) {
    actionText = "All Tasks Complete!";
    actionDescription = "Time for your next official exam";
  }

  return (
    <Link to={`${createPageUrl("DocumentViewer")}?id=${lesson.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${taskColor} p-4 md:p-5 shadow-xl cursor-pointer group`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <div className="relative flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <TaskIcon className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Course name */}
            <p className="text-white/70 text-xs font-medium truncate mb-0.5">{lesson.course_name}</p>
            
            {/* Action text */}
            <h3 className="text-white font-bold text-base md:text-lg mb-1 truncate">{actionText}</h3>
            <p className="text-white/80 text-xs line-clamp-1">{actionDescription}</p>
            
            {/* Stats row */}
            <div className="flex items-center gap-3 mt-2">
              {currentGrade !== 'N/A' && (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3 text-white/80" />
                  <span className="text-white text-xs font-bold">{currentGrade}</span>
                </div>
              )}
              {tasksRemaining > 0 && (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
                  <Target className="w-3 h-3 text-white/80" />
                  <span className="text-white text-xs font-medium">{tasksRemaining} tasks left</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Arrow */}
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}