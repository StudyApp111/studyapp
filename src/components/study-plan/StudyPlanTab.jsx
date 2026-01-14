import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Target, CheckCircle2, Circle, BookOpen, Zap, Brain, FileText,
  ChevronDown, ChevronUp, Trophy, Sparkles, ArrowRight, Lock,
  TrendingUp, Clock, BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TASK_CONFIG = {
  practice_questions: { icon: FileText, color: "purple", bg: "bg-purple-100", text: "text-purple-600" },
  flashcards: { icon: Zap, color: "amber", bg: "bg-amber-100", text: "text-amber-600" },
  teach_it: { icon: Brain, color: "blue", bg: "bg-blue-100", text: "text-blue-600" },
  review_notes: { icon: BookOpen, color: "emerald", bg: "bg-emerald-100", text: "text-emerald-600" }
};

export default function StudyPlanTab({ lesson, exams, onNavigate }) {
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [flashcardStats, setFlashcardStats] = useState({ total: 0, mastered: 0 });
  const [teachItStats, setTeachItStats] = useState({ total: 0, mastered: 0 });

  useEffect(() => {
    if (lesson?.id) {
      loadStudyPlan();
      loadStats();
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

  const loadStats = async () => {
    try {
      const [flashcards, teachItCards] = await Promise.all([
        base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
        base44.entities.TeachItCard.filter({ lesson_id: lesson.id })
      ]);

      setFlashcardStats({
        total: flashcards.length,
        mastered: flashcards.filter(f => f.mastered).length
      });

      setTeachItStats({
        total: teachItCards.length,
        mastered: teachItCards.filter(t => t.mastered || t.score >= 70).length
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleTaskClick = (task) => {
    switch (task.task_type) {
      case 'practice_questions':
        onNavigate('exam', { practice: true, competency: task.target_competency });
        break;
      case 'flashcards':
        onNavigate('flashcards');
        break;
      case 'teach_it':
        onNavigate('teachit');
        break;
      case 'review_notes':
        onNavigate('notes');
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
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Find next incomplete task
  const nextTask = studyPlan?.tasks?.find(t => !t.completed);

  // No study plan yet - prompt to take official exam
  if (!loading && !studyPlan) {
    const hasCompletedOfficialExam = (exams || []).some(e => e.exam_type !== 'practice' && e.completed);

    return (
      <div className="p-4 space-y-4">
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Your Personalized Study Plan</h2>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              {hasCompletedOfficialExam 
                ? "Your study plan is being generated based on your exam results..."
                : "Complete your first Official Exam to unlock a personalized study plan tailored to your strengths and weaknesses."}
            </p>
            {!hasCompletedOfficialExam && (
              <Button 
                onClick={() => onNavigate('exam')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Take Official Exam
              </Button>
            )}
          </div>
        </Card>
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
    <div className="p-3 md:p-4 space-y-4 max-w-4xl mx-auto">
      {/* Header Card - Current Grade & Progress */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-xs font-medium uppercase tracking-wide">Current Predicted Grade</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black">{currentGrade}</span>
                {currentScore && (
                  <span className="text-purple-200 text-sm">({currentScore}%)</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-purple-200 text-xs font-medium">Target</p>
              <span className="text-2xl font-bold text-yellow-300">A+</span>
            </div>
          </div>
          
          {/* Task Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-purple-200">Study Plan Progress</span>
              <span className="text-white font-semibold">{completedTasks}/{totalTasks} tasks</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${taskProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Next Step Highlight */}
        {nextTask && (
          <div 
            className="p-3 bg-amber-50 border-t border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => handleTaskClick(nextTask)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${TASK_CONFIG[nextTask.task_type]?.bg || 'bg-purple-100'} flex items-center justify-center`}>
                {React.createElement(TASK_CONFIG[nextTask.task_type]?.icon || Target, { 
                  className: `w-5 h-5 ${TASK_CONFIG[nextTask.task_type]?.text || 'text-purple-600'}` 
                })}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Next Step</p>
                <p className="text-sm font-bold text-slate-900 truncate">{nextTask.title}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        )}

        {/* All tasks complete - Official Exam Ready */}
        {studyPlan?.all_tasks_completed && (
          <div 
            className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-200 cursor-pointer hover:from-emerald-100 hover:to-teal-100 transition-colors"
            onClick={() => onNavigate('exam', { official: true })}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-emerald-700 font-bold">Ready for Official Exam!</p>
                <p className="text-emerald-600 text-sm">You've completed all tasks. Time to test your progress.</p>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        )}
      </Card>

      {/* Tasks List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700 px-1">Study Tasks</h3>
        {studyPlan?.tasks?.map((task, idx) => {
          const config = TASK_CONFIG[task.task_type] || TASK_CONFIG.practice_questions;
          const Icon = config.icon;
          const progressPct = task.target_count > 0 
            ? Math.min((task.completed_count / task.target_count) * 100, 100) 
            : 0;

          return (
            <motion.div
              key={task.task_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card 
                className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                  task.completed 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-white hover:border-purple-300'
                }`}
                onClick={() => !task.completed && handleTaskClick(task)}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    task.completed 
                      ? 'bg-emerald-500' 
                      : config.bg
                  }`}>
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={`w-4 h-4 ${config.text}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${task.completed ? 'text-emerald-800 line-through' : 'text-slate-900'}`}>
                        {task.title}
                      </h4>
                      {task.target_competency && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {task.target_competency}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{task.description}</p>
                    
                    {/* Progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            task.completed ? 'bg-emerald-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {task.completed_count || 0}/{task.target_count}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Details (Collapsible) */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setProgressExpanded(!progressExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-sm text-slate-900">Detailed Progress</span>
          </div>
          {progressExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {progressExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100"
            >
              <div className="p-4 space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-amber-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-800">Flashcards</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {flashcardStats.mastered}/{flashcardStats.total}
                      <span className="text-xs font-normal text-slate-500 ml-1">mastered</span>
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800">Teach It</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {teachItStats.mastered}/{teachItStats.total}
                      <span className="text-xs font-normal text-slate-500 ml-1">mastered</span>
                    </p>
                  </div>
                </div>

                {/* Competency Progress */}
                {studyPlan?.competency_progress?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                      Competency Scores
                    </h4>
                    <div className="space-y-2">
                      {studyPlan.competency_progress.map((comp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-32 truncate">{comp.competency_name}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                comp.current_score >= 70 ? 'bg-emerald-500' : 
                                comp.current_score >= 50 ? 'bg-amber-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${comp.current_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-10 text-right">
                            {comp.current_score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grade History */}
                {studyPlan?.grade_history?.length > 1 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                      Grade History
                    </h4>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {studyPlan.grade_history.map((entry, idx) => (
                        <div 
                          key={idx}
                          className="flex-shrink-0 bg-slate-100 rounded-lg px-3 py-2 text-center"
                        >
                          <p className="text-lg font-bold text-slate-900">{entry.predicted_grade}</p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}