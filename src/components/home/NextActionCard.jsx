import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { 
  Play, CheckCircle2, Target, Layers, Brain, Zap, 
  FileText, ArrowRight, TrendingUp, Clock, Sparkles 
} from "lucide-react";

const TASK_CONFIG = {
  flashcards: { 
    icon: Layers, 
    gradient: "from-amber-500 to-orange-600",
    label: "Flashcards",
    action: "Master"
  },
  teach_it: { 
    icon: Brain, 
    gradient: "from-violet-500 to-purple-600",
    label: "Teach It",
    action: "Explain"
  },
  review_notes: { 
    icon: FileText, 
    gradient: "from-emerald-500 to-teal-600",
    label: "Review Notes",
    action: "Read"
  },
  practice_exam: { 
    icon: Zap, 
    gradient: "from-blue-500 to-indigo-600",
    label: "Practice Quiz",
    action: "Complete"
  }
};

export default function NextActionCard({ lesson, studyPlan, onNavigate }) {
  const navigate = useNavigate();
  
  if (!lesson) return null;
  
  // Determine next action based on lesson state
  const hasStudyPlan = !!studyPlan;
  const tasks = studyPlan?.tasks || [];
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  
  // Find the next task to do (prioritize focus factors)
  const nextTask = incompleteTasks.find(t => t.is_focus_factor) || incompleteTasks[0];
  const taskConfig = nextTask ? TASK_CONFIG[nextTask.task_type] : null;
  
  const handleClick = () => {
    navigate(createPageUrl("DocumentViewer") + `?id=${lesson.id}`);
  };
  
  // No study plan yet - prompt to take diagnostic
  if (!hasStudyPlan) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleClick}
        className="w-full text-left group"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 p-4 shadow-xl hover:shadow-2xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
          
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <Target className="w-7 h-7 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wide mb-0.5">Next Step</p>
              <h3 className="text-white font-bold text-base truncate">{lesson.course_name}</h3>
              <p className="text-white/80 text-xs">Take your diagnostic exam to get a study plan</p>
            </div>
            
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 group-hover:translate-x-1 transition-transform">
              <Play className="w-5 h-5 text-slate-900" />
            </div>
          </div>
        </div>
      </motion.button>
    );
  }
  
  // All tasks completed
  if (incompleteTasks.length === 0 && completedTasks.length > 0) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleClick}
        className="w-full text-left group"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 shadow-xl hover:shadow-2xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
          
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wide mb-0.5">All Done!</p>
              <h3 className="text-white font-bold text-base truncate">{lesson.course_name}</h3>
              <p className="text-white/80 text-xs">Great work! Review your progress →</p>
            </div>
            
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-white">{studyPlan?.current_predicted_grade || 'A'}</p>
              <p className="text-white/70 text-[10px]">{progress}% complete</p>
            </div>
          </div>
        </div>
      </motion.button>
    );
  }
  
  // Has tasks to complete
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className="w-full text-left group"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${nextTask?.is_focus_factor ? 'from-amber-500 to-orange-600' : taskConfig?.gradient || 'from-purple-600 to-indigo-600'} p-4 shadow-xl hover:shadow-2xl transition-all`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
        
        {nextTask?.is_focus_factor && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-bold text-white uppercase">
            ⚡ Grade Booster
          </div>
        )}
        
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            {taskConfig?.icon ? <taskConfig.icon className="w-7 h-7 text-white" /> : <Target className="w-7 h-7 text-white" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wide">Continue</p>
              <span className="text-white/50 text-[10px]">•</span>
              <p className="text-white/70 text-[10px]">{completedTasks.length}/{tasks.length} tasks</p>
            </div>
            <h3 className="text-white font-bold text-base truncate">{lesson.course_name}</h3>
            <p className="text-white/80 text-xs truncate">
              {nextTask?.title || `${taskConfig?.action} ${taskConfig?.label}`}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <p className="text-xl font-black text-white">{studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || '—'}</p>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white/60 rounded-full transition-all" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
    </motion.button>
  );
}