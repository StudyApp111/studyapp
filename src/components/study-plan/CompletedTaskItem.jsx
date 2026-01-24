import React from "react";
import { CheckCircle2, Layers, Brain, FileText, Zap } from "lucide-react";
import { motion } from "framer-motion";

const TASK_ICONS = {
  flashcards: Layers,
  teach_it: Brain,
  review_notes: FileText,
  practice_exam: Zap
};

const TASK_LABELS = {
  flashcards: 'Flashcards',
  teach_it: 'Teach It',
  review_notes: 'Notes',
  practice_exam: 'Quiz'
};

export default function CompletedTaskItem({ task, onClick }) {
  const Icon = TASK_ICONS[task.task_type] || Layers;
  const label = TASK_LABELS[task.task_type] || 'Task';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors group w-full text-left"
    >
      <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase">{label}</span>
        </div>
        <p className="text-xs text-emerald-700 line-through truncate">
          {task.title || task.focus_topics?.[0] || 'Completed'}
        </p>
      </div>
    </motion.button>
  );
}