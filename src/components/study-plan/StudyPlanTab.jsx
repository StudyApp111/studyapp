import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Sparkles, ArrowRight, ChevronRight,
  Play, Star, Lightbulb
} from "lucide-react";
import { motion } from "framer-motion";

const TASK_CONFIG = {
  flashcards: { 
    icon: Zap, 
    bg: "bg-amber-500", 
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    label: "Flashcards",
    action: "Master",
    unit: "cards",
    emoji: "⚡"
  },
  teach_it: { 
    icon: Brain, 
    bg: "bg-purple-500", 
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    label: "Teach It",
    action: "Explain",
    unit: "concepts",
    emoji: "🧠"
  },
  review_notes: { 
    icon: BookOpen, 
    bg: "bg-emerald-500", 
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    label: "Review",
    action: "Read",
    unit: "sections",
    emoji: "📖"
  }
};

const getGradeColor = (grade) => {
  if (!grade || grade === '—') return 'from-slate-400 to-slate-500';
  if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
  if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
  if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
  return 'from-red-500 to-pink-600';
};

export default function StudyPlanTab({ lesson, exams, onNavigate }) {
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lesson?.id) {
      loadStudyPlan();
    }
  }, [lesson?.id]);

  const loadStudyPlan = async () => {
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lesson.id,
        status: 'active'
      });
      
      if (plans.length > 0) {
        setStudyPlan(plans[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading study plan:", error);
      setLoading(false);
    }
  };

  const handleTaskClick = (task) => {
    switch (task.task_type) {
      case 'flashcards':
        onNavigate('flashcards');
        break;
      case 'teach_it':
        onNavigate('teachit');
        break;
      case 'review_notes':
        onNavigate('doc');
        break;
      default:
        // Fallback for any legacy practice_questions tasks
        onNavigate('flashcards');
        break;
    }
  };

  // Get latest predicted grade from exams
  const latestOfficialExam = (exams || [])
    .filter(e => e.exam_type !== 'practice' && e.completed && e.predicted_grade)
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

  const currentGrade = latestOfficialExam?.predicted_grade || '—';
  const currentScore = latestOfficialExam?.total_score;

  // Calculate overall task progress
  const completedTasks = studyPlan?.tasks?.filter(t => t.completed).length || 0;
  const totalTasks = studyPlan?.tasks?.length || 0;

  // Find next incomplete task
  const nextTask = studyPlan?.tasks?.find(t => !t.completed);

  // No study plan yet - prompt to take official exam
  if (!loading && !studyPlan) {
    return (
      <div className="px-3 py-4 max-w-sm mx-auto md:max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-7 h-7 text-purple-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">No Study Plan Yet</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
              Complete the diagnostic exam to get your personalized study plan.
            </p>
            
            <Button 
              onClick={() => onNavigate('exam')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 text-sm rounded-xl"
            >
              <Play className="w-4 h-4 mr-2" />
              Take Diagnostic
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-3 py-4 space-y-3 pb-24 max-w-sm mx-auto md:max-w-none md:px-6 lg:px-8">
      {/* Grade Header - Vibrant */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(currentGrade)} p-4 md:p-5 shadow-lg`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wide mb-1">Current Grade</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-black text-white">{currentGrade}</span>
                {currentScore && <span className="text-white/80 text-sm font-semibold">{currentScore}%</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-1">
                <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                <span className="text-white/70 text-[10px] font-medium">Target</span>
              </div>
              <span className="text-2xl md:text-3xl font-black text-yellow-300">A+</span>
            </div>
          </div>
          
          <div className="relative mt-3 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between text-[10px] text-white/70 mb-1.5">
              <span className="font-medium">Progress</span>
              <span className="font-bold text-white">{completedTasks}/{totalTasks} tasks</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <motion.div 
                className="h-full bg-white rounded-full shadow-sm"
                initial={{ width: 0 }}
                animate={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Priority Focus - Vibrant */}
      {studyPlan?.priority_focus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 shadow-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-yellow-300" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide mb-0.5">Focus Area</p>
                <p className="text-xs text-white font-medium leading-snug">{studyPlan.priority_focus}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Next Action CTA - Vibrant */}
      {nextTask && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <button onClick={() => handleTaskClick(nextTask)} className="w-full group">
            <div className="relative overflow-hidden bg-gradient-to-br from-white to-purple-50/50 rounded-2xl border-2 border-purple-300 hover:border-purple-500 shadow-md hover:shadow-xl transition-all p-3 md:p-4">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${TASK_CONFIG[nextTask.task_type]?.bg || 'bg-purple-500'} shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform`}>
                  <span className="text-xl md:text-2xl">{TASK_CONFIG[nextTask.task_type]?.emoji || '📚'}</span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-purple-600 text-[10px] font-bold uppercase tracking-wide mb-0.5">Up Next</p>
                  <h3 className="text-sm md:text-base font-bold text-slate-900 truncate">
                    {TASK_CONFIG[nextTask.task_type]?.action} {nextTask.target_count} {TASK_CONFIG[nextTask.task_type]?.unit}
                  </h3>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-md transform group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* All tasks complete - Vibrant */}
      {studyPlan?.all_tasks_completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <button onClick={() => onNavigate('exam')} className="w-full group">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl transition-all p-3 md:p-4">
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6 md:w-7 md:h-7 text-yellow-300" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wide">Ready!</p>
                  <h3 className="text-sm md:text-base font-bold text-white">Take Next Exam</h3>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md transform group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Tasks List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 px-1">Tasks</h3>
        
        {studyPlan?.tasks?.map((task, idx) => {
          const config = TASK_CONFIG[task.task_type] || TASK_CONFIG.flashcards;
          const isComplete = task.completed;
          const progress = task.target_count > 0 ? ((task.completed_count || 0) / task.target_count) * 100 : 0;

          return (
            <motion.div
              key={task.task_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.03 }}
            >
              <button
                onClick={() => !isComplete && handleTaskClick(task)}
                disabled={isComplete}
                className="w-full text-left group"
              >
                <div className={`relative overflow-hidden p-3 md:p-3.5 rounded-xl transition-all ${
                  isComplete 
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200' 
                    : `bg-gradient-to-br ${config.bgLight} border ${config.border} hover:shadow-md`
                }`}>
                  <div className="relative flex items-center gap-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isComplete ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : `bg-gradient-to-br ${config.bg}`
                    } group-hover:scale-105 transition-transform`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 md:w-5.5 md:h-5.5 text-white" />
                      ) : (
                        <span className="text-lg md:text-xl">{config.emoji}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${isComplete ? 'text-emerald-700' : config.text}`}>
                          {config.label}
                        </span>
                        {!isComplete && task.completed_count > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {task.completed_count}/{task.target_count}
                          </span>
                        )}
                      </div>
                      <h4 className={`font-semibold text-xs md:text-sm ${isComplete ? 'text-emerald-700 line-through' : 'text-slate-900'}`}>
                        {task.title || `${config.action} ${task.target_count} ${config.unit}`}
                      </h4>
                      
                      {/* Progress bar */}
                      {!isComplete && task.completed_count > 0 && (
                        <div className="h-1.5 bg-white/50 rounded-full mt-2 overflow-hidden shadow-inner">
                          <div className={`h-full bg-gradient-to-r ${config.bg} rounded-full shadow-sm`} style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {!isComplete && (
                      <ChevronRight className={`w-4 h-4 ${config.text} flex-shrink-0 group-hover:translate-x-1 transition-transform`} />
                    )}
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Plan Rationale - Minimal */}
      {studyPlan?.plan_rationale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Why this plan</p>
            <p className="text-xs text-slate-600 leading-relaxed">{studyPlan.plan_rationale}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}