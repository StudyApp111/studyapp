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
    <div className="px-3 py-4 space-y-3 pb-24 max-w-sm mx-auto md:max-w-lg">
      {/* Grade Header - Compact inline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${getGradeColor(currentGrade)} flex items-center justify-center`}>
              <span className="text-xl md:text-2xl font-black text-white">{currentGrade}</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Current Grade</p>
              {currentScore && <p className="text-xs text-slate-600">{currentScore}%</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Progress</p>
            <p className="text-sm font-bold text-slate-900">{completedTasks}/{totalTasks}</p>
            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Priority Focus - Compact */}
      {studyPlan?.priority_focus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="bg-purple-50 rounded-xl p-2.5 md:p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-snug">{studyPlan.priority_focus}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Next Action CTA - Sleek */}
      {nextTask && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button onClick={() => handleTaskClick(nextTask)} className="w-full">
            <div className="bg-white rounded-2xl border-2 border-purple-200 hover:border-purple-400 hover:shadow-md transition-all p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl ${TASK_CONFIG[nextTask.task_type]?.bg || 'bg-purple-500'} flex items-center justify-center`}>
                  <span className="text-lg md:text-xl">{TASK_CONFIG[nextTask.task_type]?.emoji || '📚'}</span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-purple-600 text-[10px] font-bold uppercase">Up Next</p>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {TASK_CONFIG[nextTask.task_type]?.action} {nextTask.target_count} {TASK_CONFIG[nextTask.task_type]?.unit}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* All tasks complete */}
      {studyPlan?.all_tasks_completed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button onClick={() => onNavigate('exam')} className="w-full">
            <div className="bg-white rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-emerald-600 text-[10px] font-bold uppercase">Ready!</p>
                  <h3 className="text-sm font-semibold text-slate-900">Take Next Exam</h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
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
                className="w-full text-left"
              >
                <div className={`p-2.5 md:p-3 rounded-xl border transition-all ${
                  isComplete 
                    ? 'bg-emerald-50/50 border-emerald-200' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {/* Icon */}
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isComplete ? 'bg-emerald-100' : config.bgLight
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
                      ) : (
                        <span className="text-base md:text-lg">{config.emoji}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase ${isComplete ? 'text-emerald-600' : config.text}`}>
                          {config.label}
                        </span>
                        {!isComplete && task.completed_count > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {task.completed_count}/{task.target_count}
                          </span>
                        )}
                      </div>
                      <h4 className={`font-medium text-xs ${isComplete ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {task.title || `${config.action} ${task.target_count} ${config.unit}`}
                      </h4>
                      
                      {/* Progress bar */}
                      {!isComplete && task.completed_count > 0 && (
                        <div className="h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${config.bg} rounded-full`} style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {!isComplete && (
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
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