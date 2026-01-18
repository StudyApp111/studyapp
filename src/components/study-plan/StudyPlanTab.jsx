import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Play, ArrowRight, ChevronRight, Loader2, Sparkles, Layers, FileText
} from "lucide-react";
import { motion } from "framer-motion";
import GradeImprovementAnimation from "./GradeImprovementAnimation";

const TASK_CONFIG = {
  flashcards: { 
    icon: Layers, 
    gradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    label: "Flashcards",
    action: "Master",
    unit: "cards"
  },
  teach_it: { 
    icon: Brain, 
    gradient: "from-violet-500 to-purple-600",
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    label: "Teach It",
    action: "Explain",
    unit: "concepts"
  },
  review_notes: { 
    icon: FileText, 
    gradient: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    label: "Review Notes",
    action: "Read",
    unit: "sections"
  },
  practice_exam: { 
    icon: Zap, 
    gradient: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    label: "Practice Quiz",
    action: "Complete",
    unit: "quizzes"
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
  const [showGradeBoost, setShowGradeBoost] = useState(false);
  const [previousCompleted, setPreviousCompleted] = useState(0);
  const ctaRef = useRef(null);

  const scrollToCTA = () => {
    ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
        const newPlan = plans[0];
        const newCompletedCount = newPlan.tasks?.filter(t => t.completed).length || 0;
        
        // Check if task was just completed (show animation)
        if (studyPlan && newCompletedCount > previousCompleted) {
          setShowGradeBoost(true);
        }
        
        setPreviousCompleted(newCompletedCount);
        setStudyPlan(newPlan);
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
      
      // Get only completed practice exams for score calculation
      const completedPracticeExams = practiceExams.filter(e => e.completed);
      const latestPracticeExam = completedPracticeExams.sort((a, b) => 
        new Date(b.updated_date) - new Date(a.updated_date)
      )[0];
      
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
          completed: completedPracticeExams.length,
          // Use latest completed exam for score display
          totalQuestions: latestPracticeExam?.questions?.length || 0,
          correctAnswers: latestPracticeExam?.correct_count || 0
        }
      });
    } catch (error) {
      console.error("Error loading live progress:", error);
    }
  };

  const handleTaskClick = async (task) => {
    const isComplete = task.completed || (task.target_count > 0 && (task.completed_count || 0) >= task.target_count);
    
    switch (task.task_type) {
      case 'flashcards':
        // Pass task info to flashcards tab for targeted generation or review
        window.dispatchEvent(new CustomEvent('generateFromStudyTask', { 
          detail: { taskType: 'flashcards', task }
        }));
        onNavigate('flashcards');
        break;
      case 'teach_it':
        // Pass task info to teach it tab for targeted generation or review
        window.dispatchEvent(new CustomEvent('generateFromStudyTask', { 
          detail: { taskType: 'teach_it', task }
        }));
        onNavigate('teachit');
        break;
      case 'review_notes':
        onNavigate('notes');
        break;
      case 'practice_exam':
        if (isComplete) {
          // If complete, just navigate to exam tab to view results
          onNavigate('exam');
        } else {
          // Generate and start practice exam
          window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', { 
            detail: { 
              task,
              focus_topics: task.focus_topics || [],
              target_competency: task.target_competency || '',
              misconception_addressed: task.misconception_addressed || ''
            }
          }));
          onNavigate('exam');
        }
        break;
      default:
        onNavigate('flashcards');
        break;
    }
  };

  // Get latest predicted grade from exams - check both exam_type field and absence of it
  const latestOfficialExam = (exams || [])
    .filter(e => e.completed && e.predicted_grade && e.exam_type !== 'practice')
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

  const currentGrade = latestOfficialExam?.predicted_grade || studyPlan?.initial_predicted_grade || '—';
  const currentScore = latestOfficialExam?.total_score || studyPlan?.initial_score;

  // Calculate overall task progress
  const completedTasks = studyPlan?.tasks?.filter(t => t.completed).length || 0;
  const totalTasks = studyPlan?.tasks?.length || 0;
  const allComplete = completedTasks === totalTasks && totalTasks > 0;

  // No study plan yet - prompt to take official exam
  if (!loading && !studyPlan) {
    return (
      <div className="px-3 pb-8 w-full max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Hero Section - Emotional Hook */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-6 shadow-2xl">
            {/* Animated background elements */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
            
            <div className="relative">
              {/* Emoji hook */}
              <div className="text-center mb-4">
                <span className="text-5xl">😰</span>
              </div>
              
              <h2 className="text-2xl font-black text-white text-center mb-3 leading-tight">
                "I don't know where<br/>to start studying..."
              </h2>
              
              <p className="text-purple-200 text-sm text-center max-w-xs mx-auto leading-relaxed">
                Sound familiar? You're not alone. Most students waste hours studying the wrong things.
              </p>
            </div>
          </div>

          {/* The Problem → Solution */}
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex flex-col items-center text-center">
                <span className="text-2xl mb-2">❌</span>
                <h3 className="font-bold text-red-800 text-sm mb-1">The Old Way</h3>
                <p className="text-red-700 text-xs leading-relaxed max-w-xs">
                  Re-reading everything. Highlighting randomly. Studying what you already know. Panicking before exams.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <ArrowRight className="w-4 h-4 text-white rotate-90" />
              </div>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex flex-col items-center text-center">
                <span className="text-2xl mb-2">✨</span>
                <h3 className="font-bold text-emerald-800 text-sm mb-1">The StudyApp Way</h3>
                <p className="text-emerald-700 text-xs leading-relaxed max-w-xs">
                  AI finds your weak spots in 5 minutes. Then gives you a personalized plan that targets exactly what you need.
                </p>
              </div>
            </div>
          </div>

          {/* Social Proof / Stats */}
          <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-4 border border-purple-200">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-black text-purple-700">73%</p>
                <p className="text-[10px] text-purple-600 font-medium">study the wrong topics</p>
              </div>
              <div>
                <p className="text-2xl font-black text-purple-700">2.5h</p>
                <p className="text-[10px] text-purple-600 font-medium">saved per session</p>
              </div>
              <div>
                <p className="text-2xl font-black text-purple-700">+15%</p>
                <p className="text-[10px] text-purple-600 font-medium">avg grade boost</p>
              </div>
            </div>
          </div>

          {/* How it works - Visual Timeline */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Your journey to better grades</p>
            
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-purple-400 via-indigo-400 to-emerald-400" />
              
              <div className="space-y-3">
                {[
                  { emoji: "🎯", title: "5-Min Diagnostic", desc: "AI discovers your knowledge gaps", time: "Now", active: true, clickable: true },
                  { emoji: "📋", title: "Personal Study Plan", desc: "Tasks designed for YOUR weaknesses", time: "+2 min" },
                  { emoji: "🧠", title: "Focused Practice", desc: "Flashcards, quizzes, and more", time: "+15 min" },
                  { emoji: "🏆", title: "Grade Improvement", desc: "Watch your predicted grade climb", time: "Ongoing" }
                ].map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.1 }}
                    className="relative"
                    onClick={step.clickable ? scrollToCTA : undefined}
                    style={step.clickable ? { cursor: 'pointer' } : undefined}
                  >
                    {/* Timeline dot */}
                    <div className={`absolute -left-6 top-3 w-4 h-4 rounded-full border-2 ${
                      step.active 
                        ? 'bg-purple-500 border-purple-300 animate-pulse' 
                        : 'bg-white border-slate-300'
                    }`} />
                    
                    <div className={`p-3 rounded-xl border ${
                      step.active 
                        ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-300 shadow-md' 
                        : 'bg-white border-slate-200'
                    } ${step.clickable ? 'hover:shadow-lg transition-shadow' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{step.emoji}</span>
                        <h4 className="font-bold text-slate-900 text-sm flex-1">{step.title}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          step.active ? 'bg-purple-200 text-purple-700' : 'bg-slate-100 text-slate-500'
                        }`}>{step.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug pl-7">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Testimonial / Trust */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                JM
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-700 italic leading-relaxed mb-2">
                  "I went from a C+ to an A- in just 3 weeks. The diagnostic showed me I was wasting time on stuff I already knew."
                </p>
                <p className="text-[10px] text-slate-500 font-medium">— Jordan M., Biology 12</p>
              </div>
            </div>
          </motion.div>

          {/* Final CTA - Must scroll to see */}
          <motion.div
            ref={ctaRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-4"
          >
            <Button 
              onClick={() => onNavigate('exam')}
              className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold py-5 text-base rounded-2xl shadow-xl shadow-purple-500/30 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Play className="w-5 h-5 mr-2" />
              Start 5-Minute Diagnostic
            </Button>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Free • No credit card • Results in 5 minutes
            </p>
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
    <>
      <GradeImprovementAnimation 
        show={showGradeBoost}
        improvement={2.5}
        onComplete={() => setShowGradeBoost(false)}
      />
      
      <div className="px-3 pt-1 w-full max-w-lg mx-auto space-y-3 pb-8">
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
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-1">StudyApp Predicted Grade</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black text-white">{currentGrade}</span>
                {currentScore && <span className="text-white/80 text-sm font-medium">{Math.round(currentScore)}%</span>}
              </div>
            </div>
            
            {/* Practice tasks disclaimer */}
            {!latestOfficialExam && studyPlan?.initial_predicted_grade && (
              <p className="text-white/60 text-[10px] text-center mb-3 italic">
                Based on diagnostic • Complete tasks to improve
              </p>
            )}
            
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
            let practiceScore = null;
            
            // Calculate actual progress from live data
            if (task.task_type === 'flashcards') {
              if (live.mastered !== undefined) {
                actualCount = Math.max(actualCount, live.mastered);
              }
              displayText = `${actualCount} / ${task.target_count || 10} mastered`;
            } else if (task.task_type === 'teach_it') {
              if (live.mastered !== undefined) {
                actualCount = Math.max(actualCount, live.mastered);
              }
              displayText = `${actualCount} / ${task.target_count || 3} mastered`;
            } else if (task.task_type === 'practice_exam') {
              if (live.completed !== undefined) {
                actualCount = Math.max(actualCount, live.completed);
              }
              // Show score if completed
              if (live.completed > 0 && live.totalQuestions > 0) {
                practiceScore = `${live.correctAnswers}/${live.totalQuestions}`;
                displayText = `Score: ${practiceScore}`;
              } else {
                displayText = `${actualCount} / ${task.target_count || 1} completed`;
              }
            } else if (task.task_type === 'review_notes') {
              displayText = task.completed ? 'Completed' : 'Not started';
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
                  onClick={() => handleTaskClick(task)}
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
                          <config.icon className="w-5 h-5 text-white" />
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

                      {/* Arrow for incomplete */}
                      {!isComplete && (
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
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
    </>
  );
}