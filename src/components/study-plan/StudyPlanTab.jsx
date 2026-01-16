import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Play, ArrowRight, ChevronRight, Loader2
} from "lucide-react";
import { motion } from "framer-motion";

const TASK_CONFIG = {
  flashcards: { 
    icon: Zap, 
    gradient: "from-amber-500 to-orange-500",
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
    gradient: "from-purple-500 to-indigo-500",
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
    gradient: "from-emerald-500 to-teal-500",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    label: "Review Notes",
    action: "Read",
    unit: "sections",
    emoji: "📖"
  },
  practice_exam: { 
    icon: Trophy, 
    gradient: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    label: "Practice Quiz",
    action: "Complete",
    unit: "questions",
    emoji: "🎯"
  }
};

const getGradeColor = (grade) => {
  if (!grade || grade === '—') return 'from-slate-500 to-slate-600';
  if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
  if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
  if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
  return 'from-red-500 to-rose-600';
};

export default function StudyPlanTab({ lesson, exams, onNavigate }) {
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveProgress, setLiveProgress] = useState({});

  useEffect(() => {
    if (lesson?.id) {
      loadStudyPlan();
      loadLiveProgress();
    }
  }, [lesson?.id]);

  // Refresh live progress when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lesson?.id) {
        loadLiveProgress();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Load live progress from actual entities (flashcards, teachit cards, practice exams)
  const loadLiveProgress = async () => {
    try {
      const [flashcards, teachItCards, practiceExams] = await Promise.all([
        base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
        base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
        base44.entities.Exam.filter({ lesson_id: lesson.id, exam_type: 'practice' })
      ]);
      
      setLiveProgress({
        flashcards: {
          total: flashcards.length,
          mastered: flashcards.filter(f => f.mastered).length,
          reviewed: flashcards.filter(f => f.review_count > 0).length
        },
        teach_it: {
          total: teachItCards.length,
          completed: teachItCards.filter(t => t.completed).length,
          mastered: teachItCards.filter(t => t.mastered).length
        },
        practice_exam: {
          total: practiceExams.length,
          completed: practiceExams.filter(e => e.completed).length,
          totalQuestions: practiceExams.reduce((sum, e) => sum + (e.questions?.length || 0), 0),
          correctAnswers: practiceExams.reduce((sum, e) => sum + (e.correct_count || 0), 0)
        }
      });
    } catch (error) {
      console.error("Error loading live progress:", error);
    }
  };

  const [generatingPractice, setGeneratingPractice] = useState(null);

  const handleTaskClick = async (task) => {
    switch (task.task_type) {
      case 'flashcards':
        onNavigate('flashcards');
        break;
      case 'teach_it':
        onNavigate('teachit');
        break;
      case 'review_notes':
        onNavigate('notes');
        break;
      case 'practice_exam':
        // Generate practice exam and start it directly
        setGeneratingPractice(task.task_id);
        try {
          const { data } = await base44.functions.invoke('generatePracticeExam', {
            lesson_id: lesson.id,
            focus_topics: task.focus_topics || [],
            target_competency: task.target_competency || '',
            misconception_addressed: task.misconception_addressed || ''
          });
          
          if (data?.success && data.exam_id) {
            // Navigate to exam tab with the specific practice exam ID to auto-start it
            window.dispatchEvent(new CustomEvent('startPracticeExam', { 
              detail: { examId: data.exam_id } 
            }));
            onNavigate('exam');
          }
        } catch (error) {
          console.error("Error generating practice exam:", error);
        } finally {
          setGeneratingPractice(null);
        }
        break;
      default:
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
  const allComplete = completedTasks === totalTasks && totalTasks > 0;

  // No study plan yet - prompt to take official exam
  if (!loading && !studyPlan) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto md:max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Hero Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-6 shadow-2xl mb-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />
            
            <div className="relative text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-yellow-300" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2">
                Stop Guessing What to Study
              </h2>
              <p className="text-purple-200 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                A 5-minute quiz tells us exactly where you need help. We'll build your perfect study plan — so you study smarter, not harder.
              </p>
              
              <Button 
                onClick={() => onNavigate('exam')}
                className="w-full bg-white hover:bg-purple-50 text-purple-700 font-bold py-4 text-base rounded-xl shadow-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Take Quick Diagnostic
              </Button>
              <p className="text-purple-300/80 text-[11px] mt-3">Only 5 questions • Takes ~5 minutes</p>
            </div>
          </div>

          {/* Value Props */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-3">What you'll get</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { emoji: "🎯", text: "Know exactly what to study" },
                { emoji: "⏱️", text: "Save hours of study time" },
                { emoji: "😌", text: "Less stress, more confidence" },
                { emoji: "📈", text: "Better grades, guaranteed" }
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  className="flex items-center gap-2 p-3 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100"
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-xs font-semibold text-slate-700">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* How it works - Numbered Steps */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">How it works</p>
            {[
              { num: "1", title: "Quick Diagnostic", desc: "5 smart questions find your strengths & gaps", highlight: true },
              { num: "2", title: "Get Your Personalized Plan", desc: "AI creates tasks targeting YOUR weak spots" },
              { num: "3", title: "Study with Direction", desc: "Follow the plan, skip what you already know" },
              { num: "4", title: "See Your Grade Improve", desc: "Retake exam to unlock your next level" }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + idx * 0.08 }}
                className={`flex items-center gap-3 p-3.5 rounded-xl border shadow-sm ${
                  step.highlight 
                    ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' 
                    : 'bg-white border-slate-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-black ${
                  step.highlight 
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {step.num}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 text-sm">{step.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug">{step.desc}</p>
                </div>
                {step.highlight && (
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-purple-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <Button 
              onClick={() => onNavigate('exam')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 text-base rounded-xl shadow-lg"
            >
              <Target className="w-5 h-5 mr-2" />
              Start My Study Plan
            </Button>
          </motion.div>
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
    <div className="px-4 py-5 max-w-lg mx-auto md:max-w-2xl space-y-4 pb-32">
      {/* Grade + Target Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(currentGrade)} p-5 shadow-xl`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative">
            {/* Current Grade */}
            <div className="text-center mb-4">
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">Current Grade</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black text-white">{currentGrade}</span>
                {currentScore && <span className="text-white/80 text-sm font-medium">{Math.round(currentScore)}%</span>}
              </div>
            </div>
            
            {/* Arrow + Target */}
            <div className="flex items-center justify-center gap-3 pt-3 border-t border-white/20">
              <span className="text-white/60 text-xs font-medium">Complete tasks to reach</span>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5">
                <ArrowRight className="w-4 h-4 text-yellow-300" />
                <span className="text-2xl font-black text-yellow-300">A+</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vertical Timeline of Tasks */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 via-purple-200 to-emerald-300" />
        
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center gap-3 pl-1">
            <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center z-10 shadow-lg">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Your Study Tasks</h3>
              <p className="text-[11px] text-slate-500">{completedTasks} of {totalTasks} complete</p>
            </div>
          </div>

          {/* Tasks */}
          {studyPlan?.tasks?.map((task, idx) => {
            const config = TASK_CONFIG[task.task_type] || TASK_CONFIG.flashcards;
            
            // Get live progress for this task type
            const live = liveProgress[task.task_type] || {};
            let actualCount = task.completed_count || 0;
            let displayText = '';
            
            // Calculate actual progress from live data
            if (task.task_type === 'flashcards' && live.mastered !== undefined) {
              actualCount = Math.max(actualCount, live.mastered);
              displayText = `${live.mastered} mastered (${live.reviewed} reviewed)`;
            } else if (task.task_type === 'teach_it' && live.mastered !== undefined) {
              actualCount = Math.max(actualCount, live.mastered);
              displayText = `${live.mastered} mastered (${live.completed} completed)`;
            } else if (task.task_type === 'practice_exam' && live.completed !== undefined) {
              actualCount = Math.max(actualCount, live.completed);
              displayText = live.totalQuestions > 0 
                ? `${live.correctAnswers}/${live.totalQuestions} correct`
                : `${live.completed} completed`;
            }
            
            const isComplete = task.completed || (task.target_count > 0 && actualCount >= task.target_count);
            const progress = task.target_count > 0 ? (actualCount / task.target_count) * 100 : 0;

            return (
              <motion.div
                key={task.task_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + idx * 0.05 }}
                className="relative pl-1"
              >
                {/* Timeline dot */}
                <div className={`absolute left-[14px] top-4 w-3 h-3 rounded-full z-10 ${
                  isComplete ? 'bg-emerald-500' : 'bg-white border-2 border-purple-300'
                }`} />
                
                <button
                  onClick={() => !isComplete && !generatingPractice && handleTaskClick(task)}
                  disabled={isComplete || generatingPractice === task.task_id}
                  className="w-full text-left ml-8 group pr-1"
                >
                  <div className={`relative overflow-hidden rounded-xl transition-all ${
                    isComplete 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md'
                  } p-3`}>
                    <div className="flex items-center gap-3">
                      {/* Task Number/Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isComplete 
                          ? 'bg-emerald-500' 
                          : `bg-gradient-to-br ${config.gradient}`
                      } shadow-md group-hover:scale-105 transition-transform`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-xl">{config.emoji}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${
                            isComplete ? 'text-emerald-600' : config.text
                          }`}>
                            {config.label}
                          </span>
                        </div>
                        <p className={`font-semibold text-sm leading-tight ${
                          isComplete ? 'text-emerald-700 line-through' : 'text-slate-900'
                        }`}>
                          {task.title || `${config.action} ${task.target_count} ${config.unit}`}
                        </p>
                        
                        {/* Always show progress bar for tasks with target_count */}
                        {task.target_count > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-500 font-medium">
                                {displayText || `${actualCount} / ${task.target_count} ${config.unit}`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {Math.min(100, Math.round(progress))}%
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full bg-gradient-to-r ${isComplete ? 'from-emerald-500 to-teal-500' : config.gradient} rounded-full transition-all`} 
                                style={{ width: `${Math.min(100, progress)}%` }} 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Arrow or loader for incomplete */}
                      {!isComplete && (
                        generatingPractice === task.task_id ? (
                          <Loader2 className="w-5 h-5 text-purple-600 flex-shrink-0 animate-spin" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                        )
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}

          {/* Official Exam CTA at Bottom */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + (totalTasks * 0.05) }}
            className="relative pl-1 pt-2"
          >
            {/* Timeline end dot */}
            <div className={`absolute left-[11px] top-6 w-5 h-5 rounded-full z-10 flex items-center justify-center ${
              allComplete ? 'bg-emerald-500' : 'bg-slate-200'
            }`}>
              <Trophy className={`w-3 h-3 ${allComplete ? 'text-white' : 'text-slate-400'}`} />
            </div>
            
            <button
              onClick={() => onNavigate('exam')}
              className="w-full ml-8 group pr-1"
            >
              <div className={`relative overflow-hidden rounded-xl p-4 transition-all ${
                allComplete 
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg hover:shadow-xl' 
                  : 'bg-slate-100 border border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                    allComplete ? 'bg-white/20' : 'bg-white'
                  } group-hover:scale-105 transition-transform`}>
                    <Trophy className={`w-6 h-6 ${allComplete ? 'text-yellow-300' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${
                      allComplete ? 'text-emerald-100' : 'text-slate-400'
                    }`}>
                      {allComplete ? 'Ready!' : 'Complete tasks first'}
                    </p>
                    <p className={`font-bold text-base ${
                      allComplete ? 'text-white' : 'text-slate-500'
                    }`}>
                      Take Official Exam
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    allComplete ? 'bg-white/20' : 'bg-slate-200'
                  } group-hover:translate-x-1 transition-transform`}>
                    <ArrowRight className={`w-5 h-5 ${allComplete ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                </div>
                
                {allComplete && (
                  <p className="text-emerald-100 text-[11px] mt-2 pl-15">
                    Retaking the exam will generate a new study plan
                  </p>
                )}
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Rationale - Collapsible at bottom */}
      {studyPlan?.plan_rationale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Why this plan</p>
            <p className="text-xs text-slate-600 leading-relaxed">{studyPlan.plan_rationale}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}