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
    const hasCompletedOfficialExam = (exams || []).some(e => e.exam_type !== 'practice' && e.completed);

    return (
      <div className="p-3 md:p-4 space-y-4 max-w-2xl mx-auto">
        {/* Hero Card - First Exam */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-yellow-300" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Get Your Predicted Grade</h2>
              <p className="text-purple-200 text-sm max-w-sm mx-auto mb-6">
                Take a quick 5-question diagnostic to see where you stand and get a personalized study plan.
              </p>
              
              <Button 
                onClick={() => onNavigate('exam')}
                size="lg"
                className="bg-white text-purple-700 hover:bg-purple-50 font-bold px-8 py-6 text-lg rounded-xl shadow-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Diagnostic Exam
              </Button>
            </div>
            
            <div className="bg-white p-4">
              <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span>5 questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  <span>~10 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>AI graded</span>
                </div>
              </div>
            </div>
          </Card>
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
    <div className="px-2 py-3 space-y-3 pb-24 max-w-lg mx-auto">
      {/* Compact Grade Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className={`bg-gradient-to-r ${getGradeColor(currentGrade)} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-[10px] font-medium uppercase tracking-wide">
                  Predicted Grade
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white">{currentGrade}</span>
                  {currentScore && (
                    <span className="text-white/70 text-sm font-semibold">{currentScore}%</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                  <span className="text-white/70 text-[10px]">Target</span>
                </div>
                <span className="text-2xl font-bold text-yellow-300">A+</span>
              </div>
            </div>
            
            {/* Progress inline */}
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex items-center justify-between text-[10px] text-white/70 mb-1">
                <span>Progress</span>
                <span className="font-semibold text-white">{completedTasks}/{totalTasks}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Priority Focus Banner */}
      {studyPlan?.priority_focus && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-0.5">Focus Area</p>
                <p className="text-xs text-slate-700 leading-snug">{studyPlan.priority_focus}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Next Action CTA */}
      {nextTask && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button onClick={() => handleTaskClick(nextTask)} className="w-full">
            <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-lg transition-all p-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${TASK_CONFIG[nextTask.task_type]?.bg || 'bg-purple-500'} flex items-center justify-center shadow-md`}>
                  <span className="text-xl">{TASK_CONFIG[nextTask.task_type]?.emoji || '📚'}</span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-purple-600 text-[10px] font-bold uppercase tracking-wide">Up Next</p>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {TASK_CONFIG[nextTask.task_type]?.action} {nextTask.target_count} {TASK_CONFIG[nextTask.task_type]?.unit}
                  </h3>
                  {nextTask.target_competency && (
                    <p className="text-[11px] text-slate-500 truncate">{nextTask.target_competency}</p>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
              
              {/* Focus topics preview */}
              {nextTask.focus_topics?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-200/50">
                  <p className="text-[10px] text-purple-600 font-medium mb-1">Topics to cover:</p>
                  <div className="flex flex-wrap gap-1">
                    {nextTask.focus_topics.slice(0, 3).map((topic, i) => (
                      <span key={i} className="text-[10px] bg-white/80 text-slate-600 px-2 py-0.5 rounded-full border border-purple-100">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
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
            <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 hover:shadow-lg transition-all p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-emerald-600 text-[10px] font-bold uppercase">Ready!</p>
                  <h3 className="text-sm font-bold text-slate-900">Take Next Exam</h3>
                  <p className="text-[11px] text-slate-500">See your improvement</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </Card>
          </button>
        </motion.div>
      )}

      {/* Tasks List - Compact */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-600 px-1 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-purple-600" />
          Study Tasks
        </h3>
        
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
                <Card className={`p-2.5 transition-all ${
                  isComplete 
                    ? 'bg-emerald-50/80 border-emerald-200' 
                    : `${config.bgLight} ${config.border} hover:shadow-md`
                }`}>
                  <div className="flex items-center gap-2.5">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isComplete ? 'bg-emerald-500' : config.bg
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-lg">{config.emoji}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase ${isComplete ? 'text-emerald-600' : config.text}`}>
                          {config.label}
                        </span>
                        {!isComplete && task.completed_count > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {task.completed_count}/{task.target_count}
                          </span>
                        )}
                      </div>
                      <h4 className={`font-semibold text-xs ${isComplete ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {task.title || `${config.action} ${task.target_count} ${config.unit}`}
                      </h4>
                      {task.target_competency && !isComplete && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{task.target_competency}</p>
                      )}
                      
                      {/* Progress bar for incomplete tasks */}
                      {!isComplete && task.completed_count > 0 && (
                        <div className="h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${config.bg} rounded-full`} style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {!isComplete && (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </Card>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Plan Rationale */}
      {studyPlan?.plan_rationale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Why this plan?</p>
            <p className="text-xs text-slate-600 leading-relaxed">{studyPlan.plan_rationale}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}