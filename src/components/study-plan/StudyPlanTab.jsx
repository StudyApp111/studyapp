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
    <div className="p-3 md:p-4 space-y-4 max-w-2xl mx-auto pb-20">
      {/* Grade Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className={`bg-gradient-to-r ${getGradeColor(currentGrade)} p-5 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide mb-1">
                  Predicted Grade
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black">{currentGrade}</span>
                  {currentScore && (
                    <span className="text-white/80 text-lg font-semibold">{currentScore}%</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span className="text-white/80 text-xs">Target</span>
                </div>
                <span className="text-3xl font-bold text-yellow-300">A+</span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="bg-white px-5 py-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-600 font-medium">Study Progress</span>
              <span className="font-bold text-slate-900">{completedTasks} of {totalTasks} complete</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: totalTasks > 0 ? `${(completedTasks / totalTasks) * 100}%` : '0%' }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Next Action - Big CTA */}
      {nextTask && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => handleTaskClick(nextTask)}
            className="w-full"
          >
            <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-lg transition-all p-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${TASK_CONFIG[nextTask.task_type]?.bg || 'bg-purple-500'} flex items-center justify-center shadow-lg`}>
                  {React.createElement(TASK_CONFIG[nextTask.task_type]?.icon || Target, { 
                    className: "w-7 h-7 text-white" 
                  })}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-purple-600 text-xs font-bold uppercase tracking-wide mb-0.5">
                    Up Next
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mb-0.5">
                    {TASK_CONFIG[nextTask.task_type]?.action} {nextTask.target_count} {TASK_CONFIG[nextTask.task_type]?.unit}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {nextTask.target_competency || TASK_CONFIG[nextTask.task_type]?.label}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          </button>
        </motion.div>
      )}

      {/* All tasks complete - Retake Exam */}
      {studyPlan?.all_tasks_completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => onNavigate('exam')}
            className="w-full"
          >
            <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 hover:shadow-lg transition-all p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-emerald-600 text-xs font-bold uppercase tracking-wide mb-0.5">
                    Ready!
                  </p>
                  <h3 className="text-lg font-bold text-slate-900">
                    Take Next Official Exam
                  </h3>
                  <p className="text-sm text-slate-600">
                    See how much you've improved
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </Card>
          </button>
        </motion.div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 px-1 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          Your Study Tasks
        </h3>
        
        {studyPlan?.tasks?.map((task, idx) => {
          const config = TASK_CONFIG[task.task_type] || TASK_CONFIG.practice_questions;
          const Icon = config.icon;
          const isComplete = task.completed;

          return (
            <motion.div
              key={task.task_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
            >
              <button
                onClick={() => !isComplete && handleTaskClick(task)}
                disabled={isComplete}
                className="w-full text-left"
              >
                <Card className={`p-3 transition-all ${
                  isComplete 
                    ? 'bg-emerald-50 border-emerald-200 opacity-75' 
                    : 'bg-white hover:shadow-md hover:border-purple-300 cursor-pointer'
                }`}>
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isComplete ? 'bg-emerald-500' : config.bg
                    } shadow-sm`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <Icon className="w-6 h-6 text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge className={`text-[10px] px-2 py-0 ${
                          isComplete 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : `${config.bgLight} ${config.text}`
                        }`}>
                          {config.label}
                        </Badge>
                      </div>
                      <h4 className={`font-bold text-sm ${isComplete ? 'text-emerald-800 line-through' : 'text-slate-900'}`}>
                        {config.action} {task.target_count} {config.unit}
                      </h4>
                      {task.target_competency && (
                        <p className="text-xs text-slate-500 truncate">
                          Focus: {task.target_competency}
                        </p>
                      )}
                    </div>

                    {/* Arrow or Check */}
                    <div className="flex-shrink-0">
                      {isComplete ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </Card>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* AI Feedback Summary */}
      {latestOfficialExam?.ai_feedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 bg-slate-50 border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Latest Exam Feedback</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {latestOfficialExam.ai_feedback.overall_performance_summary_text}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}