import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Play, ArrowRight, ChevronRight, Loader2, Sparkles, FileText, TrendingUp, AlertCircle, Plus, TrendingDown, Minus, Lightbulb, Clock, Copy
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PracticeTopicsPanel from "./PracticeTopicsPanel";
import CompletedTaskItem from "./CompletedTaskItem";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

const TASK_CONFIG = {
  flashcards: { 
    icon: Copy, 
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
  if (grade.startsWith('D') || grade.startsWith('F')) return 'from-slate-600 to-blue-700';
  return 'from-red-500 to-rose-600';
};

const getVelocityConfig = (velocity) => {
  switch (velocity) {
    case 'Accelerating':
      return { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Accelerating' };
    case 'Declining':
      return { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100', label: 'Declining' };
    default:
      return { icon: Minus, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Stagnating' };
  }
};

export default function StudyPlanTab({ lesson, exams, onNavigate, isGeneratingPlan = false }) {
  const { isDark } = useTheme();
  const { canDoTask, triggerUpgradeModal } = useSubscription();
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if diagnostic exam is ready (has questions generated)
  const diagnosticExamFromExams = (exams || []).find(e => e.exam_number === 1 && e.exam_type !== 'practice');
  const isDiagnosticReady = diagnosticExamFromExams?.questions?.length > 0;

  const [liveProgress, setLiveProgress] = useState({});
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showPracticeTopics, setShowPracticeTopics] = useState(false);
  const [gradeJustUpdated, setGradeJustUpdated] = useState(false);
  const [previousGrade, setPreviousGrade] = useState(null);
  const [gradeChange, setGradeChange] = useState(null); // { from, to, scoreDiff }
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const ctaRef = useRef(null);
  const examPollRef = useRef(null);

  const scrollToCTA = () => {
    ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Poll for diagnostic exam readiness when it's generating
  useEffect(() => {
    if (examPollRef.current) {
      clearInterval(examPollRef.current);
      examPollRef.current = null;
    }

    // Only poll if we don't have a study plan yet AND diagnostic isn't ready
    if (!studyPlan && lesson?.id && !isDiagnosticReady) {
      examPollRef.current = setInterval(async () => {
        try {
          const freshExams = await base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 });
          const diag = freshExams.find(e => e.exam_type !== 'practice');
          if (diag?.questions?.length > 0) {
            // Exam is ready - trigger a re-render by reloading exams in parent
            window.dispatchEvent(new Event('reloadLesson'));
            if (examPollRef.current) {
              clearInterval(examPollRef.current);
              examPollRef.current = null;
            }
          }
        } catch (err) {
          console.warn('Exam poll error:', err);
        }
      }, 3000);
    }

    return () => {
      if (examPollRef.current) {
        clearInterval(examPollRef.current);
        examPollRef.current = null;
      }
    };
  }, [lesson?.id, studyPlan, isDiagnosticReady]);

  useEffect(() => {
    const checkAndLoadPlan = async () => {
      if (!lesson?.id) return;
      
      // If already generating from parent, don't do anything
      if (isGeneratingPlan) return;
      
      // Check if coming from onboarding with report data
      const urlParams = new URLSearchParams(window.location.search);
      const fromOnboarding = urlParams.get('fromOnboarding') === 'true';
      const reportDataStr = urlParams.get('reportData');
      
      if (fromOnboarding && reportDataStr) {
        try {
          // URLSearchParams.get() already returns decoded string - try parsing directly first
          let reportData;
          try {
            reportData = JSON.parse(reportDataStr);
          } catch {
            // If that fails, try decoding first (in case it was double-encoded)
            reportData = JSON.parse(decodeURIComponent(reportDataStr));
          }
          console.log('📊 Parsed report data for study plan:', reportData);
          
          // Show a placeholder with the predicted grade while generating
          setStudyPlan({
            initial_predicted_grade: reportData.predicted_grade,
            current_predicted_grade: reportData.predicted_grade,
            initial_score: reportData.predicted_percentage,
            current_score: reportData.predicted_percentage,
            initial_confidence: parseInt(reportData.confidence_level) || 45,
            current_confidence: parseInt(reportData.confidence_level) || 45,
            tasks: [],
            status: 'active'
          });
          setLoading(false);
          
          // Set generating state and trigger study plan generation
          setGeneratingProgress(0);
          window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: true } }));
          
          base44.functions.invoke('generateStudyPlan', {
            lesson_id: lesson.id,
            diagnosticData: {
              predicted_grade: reportData.predicted_grade,
              predicted_percentage: reportData.predicted_percentage,
              confidence_level: reportData.confidence_level,
              weak_areas_detailed: reportData.weak_areas_detailed
            }
          }).then(result => {
            window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
            if (result.data?.success) {
              console.log('✅ Study plan generated successfully');
              loadStudyPlan();
              // Clean URL
              window.history.replaceState({}, '', `${createPageUrl("DocumentViewer")}?id=${lesson.id}&tab=studyplan`);
            } else {
              console.error('Study plan generation returned error:', result.data?.error);
              loadStudyPlan();
            }
          }).catch(err => {
            window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
            console.error("Error generating study plan:", err);
            loadStudyPlan();
          });
        } catch (error) {
          console.error("Error parsing report data:", error);
          await loadStudyPlan();
        }
      } else {
        await loadStudyPlan();
      }
    };
    
    checkAndLoadPlan();
  }, [lesson?.id, isGeneratingPlan]);

  // Subscribe to study plan updates for real-time grade changes
  useEffect(() => {
    if (!lesson?.id) return;
    
    const unsubscribe = base44.entities.StudyPlan.subscribe((event) => {
      if (event.data?.lesson_id === lesson.id && event.data?.status === 'active') {
        // Grade was updated by Polly engine - check for meaningful change
        if (event.type === 'update' && studyPlan) {
          const oldScore = studyPlan.current_score || studyPlan.initial_score;
          const newScore = event.data.current_score || event.data.initial_score;
          const oldGrade = studyPlan.current_predicted_grade || studyPlan.initial_predicted_grade;
          const newGrade = event.data.current_predicted_grade || event.data.initial_predicted_grade;
          
          // Only show update if score or grade actually changed
          if (newScore !== oldScore || newGrade !== oldGrade) {
            setGradeChange({
              from: oldGrade,
              to: newGrade,
              scoreDiff: newScore && oldScore ? Math.round(newScore - oldScore) : null,
              newScore: newScore
            });
            setGradeJustUpdated(true);
            // Keep showing for 3 seconds
            setTimeout(() => setGradeJustUpdated(false), 3000);
          }
        }
        setStudyPlan(event.data);
        loadLiveProgress();
      }
    });
    
    return () => unsubscribe();
  }, [lesson?.id, studyPlan?.current_score, studyPlan?.current_predicted_grade]);

  // Also check for updates when tab is revisited (async scenario)
  useEffect(() => {
    if (!studyPlan?.last_polly_update) return;
    
    const lastSeen = localStorage.getItem(`polly_seen_${studyPlan.id}`);
    const lastUpdate = new Date(studyPlan.last_polly_update).getTime();
    
    if (!lastSeen || parseInt(lastSeen) < lastUpdate) {
      // There's a new update the user hasn't seen
      setGradeJustUpdated(true);
      setGradeChange({
        from: null,
        to: studyPlan.current_predicted_grade || studyPlan.initial_predicted_grade,
        scoreDiff: null,
        newScore: studyPlan.current_score || studyPlan.initial_score
      });
      localStorage.setItem(`polly_seen_${studyPlan.id}`, lastUpdate.toString());
      setTimeout(() => setGradeJustUpdated(false), 3000);
    }
  }, [studyPlan?.last_polly_update, studyPlan?.id]);

  // Refresh live progress when tab becomes visible or when studyPlan tasks change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lesson?.id && studyPlan) {
        loadLiveProgress();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lesson?.id, studyPlan]);

  // Also refresh when studyPlan tasks change (from subscription)
  useEffect(() => {
    if (studyPlan?.tasks) {
      loadLiveProgress();
    }
  }, [studyPlan?.tasks?.filter(t => t.completed).length]);

  const loadStudyPlan = async () => {
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lesson.id,
        status: 'active'
      });
      
      if (plans.length > 0) {
        setStudyPlan(plans[0]);
        loadLiveProgress();
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading study plan:", error);
      setLoading(false);
    }
  };

  const loadLiveProgress = async () => {
    try {
      const [flashcards, teachItCards, practiceExams] = await Promise.all([
        base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
        base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
        base44.entities.Exam.filter({ lesson_id: lesson.id, exam_type: 'practice' })
      ]);
      
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
    
    // PAYWALL CHECK FIRST - before ANY task action (except viewing completed)
    if (!isComplete) {
      const taskCheck = await canDoTask();
      if (!taskCheck.allowed) {
        triggerUpgradeModal('tasks');
        return;
      }
    }
    
    switch (task.task_type) {
      case 'flashcards':
        // For completed tasks, just navigate without regenerating
        if (isComplete) {
          onNavigate('flashcards');
        } else {
          window.dispatchEvent(new CustomEvent('generateFromStudyTask', { 
            detail: { taskType: 'flashcards', task, isComplete }
          }));
          onNavigate('flashcards');
        }
        break;
      case 'teach_it':
        // For completed tasks, just navigate without regenerating
        if (isComplete) {
          onNavigate('teachit');
        } else {
          window.dispatchEvent(new CustomEvent('generateFromStudyTask', { 
            detail: { taskType: 'teach_it', task, isComplete }
          }));
          onNavigate('teachit');
        }
        break;
      case 'review_notes':
        onNavigate('notes');
        break;
      case 'practice_exam':
        // For completed practice exams, just navigate to show the list
        if (isComplete) {
          onNavigate('exam');
        } else {
          window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', { 
            detail: { 
              task,
              focus_topics: task.focus_topics || [],
              target_competency: task.target_competency || '',
              misconception_addressed: task.misconception_addressed || ''
            }
          }));
          setTimeout(() => onNavigate('exam'), 50);
        }
        break;
      default:
        onNavigate('flashcards');
        break;
    }
  };

  const handleCreateTask = async ({ topic, taskType, target_count }) => {
    if (!studyPlan) return;
    
    const newTask = {
      task_id: `custom_${Date.now()}`,
      task_type: taskType,
      title: topic.topic_name,
      description: topic.topic_description || `Custom ${TASK_CONFIG[taskType]?.label} task`,
      target_count: target_count,
      completed_count: 0,
      focus_topics: [topic.topic_name],
      is_custom: true,
      is_focus_factor: false,
      completed: false
    };

    const updatedTasks = [...(studyPlan.tasks || []), newTask];
    
    try {
      await base44.entities.StudyPlan.update(studyPlan.id, {
        tasks: updatedTasks
      });
      
      // Update local state FIRST so task card appears immediately
      setStudyPlan(prev => ({ ...prev, tasks: updatedTasks }));
      setShowCreateTask(false);
      
      // Small delay to let the UI update and show the new task card
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Then navigate to the relevant tab and start generating
      handleTaskClick(newTask);
    } catch (error) {
      console.error("Error creating custom task:", error);
    }
  };

  // Get current grade - prefer Polly's live update, fallback to exam/initial
  const latestOfficialExam = (exams || [])
    .filter(e => e.completed && e.predicted_grade && e.exam_type !== 'practice')
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

  const currentGrade = studyPlan?.current_predicted_grade || latestOfficialExam?.predicted_grade || studyPlan?.initial_predicted_grade || '—';
  const currentScore = studyPlan?.current_score || studyPlan?.initial_score || null;
  const currentConfidence = studyPlan?.current_confidence || studyPlan?.initial_confidence || 45;
  const learningVelocity = studyPlan?.learning_velocity;
  const velocityConfig = getVelocityConfig(learningVelocity);
  const behavioralInsights = studyPlan?.behavioral_insights;

  // Separate completed and incomplete tasks
  const incompleteTasks = studyPlan?.tasks?.filter(t => !t.completed) || [];
  const completedTasks = studyPlan?.tasks?.filter(t => t.completed) || [];
  const totalTasks = studyPlan?.tasks?.length || 0;

  // Progress animation for generating state
  useEffect(() => {
    if (!isGeneratingPlan) {
      setGeneratingProgress(0);
      return;
    }
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / 12000) * 100, 95);
      setGeneratingProgress(newProgress);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isGeneratingPlan]);

  // Show placeholder while generating study plan
  if (isGeneratingPlan) {
    
    return (
      <div className={`px-3 md:px-6 pb-8 w-full max-w-[360px] md:max-w-2xl mx-auto ${isDark ? 'bg-[#0a0a12]' : ''}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Prediction Progress */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className={isDark ? 'stroke-slate-700' : 'stroke-slate-200'} />
                <circle 
                  cx="50" cy="50" r="42" 
                  fill="none" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  className="stroke-purple-500 transition-all duration-300"
                  style={{ 
                    strokeDasharray: '264',
                    strokeDashoffset: 264 - (264 * generatingProgress / 100)
                  }} 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {Math.round(generatingProgress)}%
                </span>
              </div>
            </div>
            
            <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Building Your Study Plan</h3>
            <p className={`text-sm text-center max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Analyzing your diagnostic to create a personalized roadmap
            </p>
          </div>

          {/* Task Skeletons with Sequential Progress */}
          <div className="space-y-2">
            {[
              { icon: '📊', label: 'Calculating grade prediction', duration: 3000 },
              { icon: '🎯', label: 'Finding weak spots', duration: 4000 },
              { icon: '📝', label: 'Creating study tasks', duration: 5000 }
            ].map((step, i) => {
              const stepProgress = Math.max(0, Math.min(100, ((generatingProgress * 3) - (i * 100))));
              
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}
                >
                  <span className="text-2xl">{step.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{step.label}</p>
                    <div className={`h-1 mt-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${stepProgress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // No study plan yet - prompt to take official exam
  if (!loading && !studyPlan) {
    return (
      <div className={`px-3 md:px-6 pt-4 pb-8 w-full max-w-[360px] md:max-w-2xl mx-auto ${isDark ? 'bg-[#0a0a12]' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Hero Section - The Big Hook */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-6 shadow-2xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
            
            <div className="relative text-center">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-3 leading-tight">
                Know your grade<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">before you walk in.</span>
              </h2>
              
              <p className="text-purple-200 text-sm max-w-sm mx-auto leading-relaxed">
                One 5-minute diagnostic. One path to an A+.<br/>
                <span className="text-white font-medium">No more "guessing" if you've studied enough.</span>
              </p>
            </div>
          </div>

          {/* Comparison - Old Way vs StudyApp Way */}
          <div className="grid grid-cols-2 gap-3">
            {/* Old Way */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 relative">
              <div className="absolute -top-2 -left-1">
                <span className="text-lg">💀</span>
              </div>
              <h3 className="font-bold text-slate-700 text-xs mb-2 mt-1">The Old Way</h3>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Staring at 400 pages of notes</span>
                </li>
                <li className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Guessing what might be on the exam</span>
                </li>
                <li className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Anxiety until results day</span>
                </li>
              </ul>
            </div>

            {/* StudyApp Way */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 relative shadow-md">
              <div className="absolute -top-2 -left-1">
                <span className="text-lg">🐐</span>
              </div>
              <h3 className="font-bold text-emerald-700 text-xs mb-2 mt-1">The StudyApp Way</h3>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>AI finds weak spots in 5 min</span>
                </li>
                <li className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Curated plan: exactly what to do</span>
                </li>
                <li className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Predicted grade updates in real-time</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Final CTA - Moved above How It Works */}
          <motion.div
            ref={ctaRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button 
              onClick={() => {
                if (!isDiagnosticReady) return;
                onNavigate('exam');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('startDiagnosticExam', { detail: { examNumber: 1 } }));
                }, 100);
              }}
              disabled={!isDiagnosticReady}
              className={`w-full font-bold py-5 text-base rounded-2xl shadow-xl relative overflow-hidden group ${
                isDiagnosticReady 
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white shadow-purple-500/30'
                  : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white/70 cursor-not-allowed shadow-none'
              }`}
            >
              {isDiagnosticReady ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Play className="w-5 h-5 mr-2" />
                  Start 5-Minute Diagnostic
                </>
              ) : (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Preparing Your Diagnostic...
                </>
              )}
            </Button>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              {isDiagnosticReady 
                ? 'Free • Results in 5 minutes • Know your grade before exam day'
                : 'Almost ready — generating your personalized questions'
              }
            </p>
          </motion.div>

          {/* How It Works - Simple Steps */}
          <div className={`rounded-xl border p-4 shadow-sm ${isDark ? 'bg-white/5 border-purple-500/30' : 'bg-white border-purple-100'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-3 text-center ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>How it works</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center text-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                  <span className="text-lg">📝</span>
                </div>
                <p className={`text-[10px] font-medium leading-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>5-min<br/>Diagnostic</p>
              </div>
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-purple-500' : 'text-purple-300'}`} />
              <div className="flex flex-col items-center text-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 ${isDark ? 'bg-amber-600/20' : 'bg-amber-100'}`}>
                  <span className="text-lg">🎯</span>
                </div>
                <p className={`text-[10px] font-medium leading-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>See Your<br/>Predicted Grade</p>
              </div>
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-purple-500' : 'text-purple-300'}`} />
              <div className="flex flex-col items-center text-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-100'}`}>
                  <span className="text-lg">🚀</span>
                </div>
                <p className={`text-[10px] font-medium leading-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Follow Plan<br/>to Improve</p>
              </div>
            </div>
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
    <div className={`w-full max-w-full overflow-x-hidden py-3 space-y-3 md:space-y-4 pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', maxWidth: '100vw' }}>
      {/* Grade + Confidence Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-3 md:px-4 w-full max-w-full"
        style={{ boxSizing: 'border-box' }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 mb-2 w-full max-w-full" style={{ boxSizing: 'border-box' }}>
          <p className={`text-xs md:text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            If your <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{lesson?.course_name || 'course'}</span> exam was today, you'd score:
          </p>
          {latestOfficialExam && (
            <button
              onClick={() => {
                // Navigate to exam tab with the exam ID
                onNavigate('exam');
                // Also dispatch event to show specific exam
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('viewExamResults', { detail: { examId: latestOfficialExam.id } }));
                }, 100);
              }}
              className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${isDark ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'}`}
            >
              View Diagnostic Results →
            </button>
          )}
        </div>

        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getGradeColor(currentGrade)} p-4 md:p-6 shadow-xl transition-all duration-500 w-full max-w-full ${gradeJustUpdated ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse' : ''}`} style={{ boxSizing: 'border-box' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          
          {/* Grade Updated Banner - More Prominent */}
          <AnimatePresence>
            {gradeJustUpdated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-20"
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-400 text-yellow-900 rounded-full shadow-xl border-2 border-yellow-300">
                    <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '2s' }} />
                    <span className="text-sm font-black">Grade Updated!</span>
                    {gradeChange?.scoreDiff !== null && gradeChange?.scoreDiff !== 0 && (
                      <span className={`text-sm font-bold ${gradeChange.scoreDiff > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {gradeChange.scoreDiff > 0 ? '+' : ''}{gradeChange.scoreDiff}%
                      </span>
                    )}
                  </div>
                  {/* Arrow pointing down */}
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-yellow-400" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`relative w-full max-w-full ${gradeJustUpdated ? 'pt-6' : ''}`} style={{ boxSizing: 'border-box' }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 w-full max-w-full" style={{ boxSizing: 'border-box' }}>
              {/* Current Grade + Score + Velocity */}
              <div className="text-center md:text-left mb-4 md:mb-0 md:flex-1">
                <p className="text-white/70 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">StudyApp Predicted Grade</p>
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <motion.span 
                    className="text-5xl md:text-6xl font-black text-white"
                    animate={gradeJustUpdated ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {currentGrade}
                  </motion.span>
                  <motion.div
                    className="flex flex-col"
                    animate={gradeJustUpdated ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <span className="text-3xl md:text-4xl font-black text-white">
                      {currentScore ? Math.round(currentScore) : '—'}%
                    </span>
                  </motion.div>
                </div>
                
                {/* Learning Velocity - Integrated */}
                {learningVelocity && (
                  <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full ${velocityConfig.bg}`}>
                    <velocityConfig.icon className={`w-3.5 h-3.5 ${velocityConfig.color}`} />
                    <span className={`text-[11px] font-bold ${velocityConfig.color}`}>
                      {velocityConfig.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confidence Meter */}
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 md:p-4 w-full md:w-auto">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-yellow-300" />
                  <span className="text-white/90 text-xs font-bold uppercase tracking-wide">Prediction Confidence</span>
                </div>
                
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-bold text-lg md:text-xl">
                      {Math.round(currentConfidence)}%
                    </span>
                    <Badge className={`text-[10px] px-2 py-0.5 ${
                      currentConfidence >= 75 ? 'bg-emerald-500/80 text-white' :
                      currentConfidence >= 50 ? 'bg-amber-500/80 text-white' :
                      'bg-red-500/80 text-white'
                    }`}>
                      {currentConfidence >= 75 ? 'High' : currentConfidence >= 50 ? 'Medium' : 'Low'} Data
                    </Badge>
                  </div>
                  <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentConfidence}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                </div>
                
                {currentConfidence < 95 && (
                  <div className="flex items-start gap-1.5 bg-white/10 rounded-lg p-2">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-300 mt-0.5 flex-shrink-0" />
                    <p className="text-white/80 text-[10px] md:text-xs leading-tight">
                      Complete tasks to improve prediction accuracy
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Arrow + Target - Mobile only */}
            <div className="flex items-center justify-center gap-2 pt-3 mt-3 md:hidden">
              <motion.div
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-white/70 text-sm"
              >
                ↓
              </motion.div>
              <span className="text-white/60 text-[11px] font-medium">Complete Tasks To Get A+</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI Insights Card - Consolidated */}
      {behavioralInsights && (behavioralInsights.is_guessing_detected || behavioralInsights.is_inefficient_studying || behavioralInsights.recommended_focus || behavioralInsights.estimated_hours_to_target) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="px-3 md:px-4 w-full max-w-full"
          style={{ boxSizing: 'border-box' }}
        >
          <div className={`rounded-2xl p-4 border ${isDark ? 'bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/60'}`}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <Lightbulb className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>StudyApp Insights</span>
            </div>
            
            {/* Metrics Row */}
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {behavioralInsights.estimated_hours_to_target && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                  <Clock className="w-3 h-3" />
                  <span className="text-[11px] font-semibold">~{Math.round(behavioralInsights.estimated_hours_to_target)}h to A+</span>
                </div>
              )}
              {behavioralInsights.is_guessing_detected && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-[11px] font-semibold">Slow down</span>
                </div>
              )}
              {behavioralInsights.is_inefficient_studying && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>
                  <Target className="w-3 h-3" />
                  <span className="text-[11px] font-semibold">Focus needed</span>
                </div>
              )}
            </div>
            
            {/* Recommendation */}
            {behavioralInsights.recommended_focus && (
              <p className={`text-sm leading-relaxed text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{behavioralInsights.recommended_focus}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Task Timeline */}
      <div className="relative w-full max-w-full overflow-x-hidden px-3 md:px-4" style={{ boxSizing: 'border-box' }}>
        <div className="absolute left-[28px] md:left-[26px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 via-purple-200 to-slate-200" />
        
        <div className="space-y-3 w-full max-w-full" style={{ boxSizing: 'border-box' }}>
          {/* Practice Your Topics - First Item */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full flex items-start gap-3"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0 mt-3.5">
              <Plus className="w-3 h-3 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <button
                onClick={() => setShowPracticeTopics(!showPracticeTopics)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all group ${
                  showPracticeTopics 
                    ? (isDark ? 'border-purple-500 bg-gradient-to-r from-purple-600/20 to-indigo-600/20' : 'border-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50')
                    : (isDark ? 'border-purple-500/40 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 hover:border-purple-500/60' : 'border-purple-300 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 hover:border-purple-500')
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg`}>
                    <Plus className={`w-5 h-5 text-white ${showPracticeTopics ? 'rotate-45' : 'group-hover:scale-110'} transition-transform`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                      Practice Your Topics
                    </p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Choose topics from your materials • Pick your format
                    </p>
                  </div>
                  <Sparkles className={`w-5 h-5 transition-all ${showPracticeTopics ? 'text-purple-400' : 'text-purple-300 group-hover:text-purple-500'}`} />
                </div>
              </button>

              {/* Practice Topics Panel - Inline */}
              <AnimatePresence>
                {showPracticeTopics && (
                  <PracticeTopicsPanel
                    isOpen={showPracticeTopics}
                    onClose={() => setShowPracticeTopics(false)}
                    lessonId={lesson?.id}
                    compressedContent={lesson?.compressed_content || lesson?.extracted_content}
                    onCreateTask={handleCreateTask}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Section Header */}
          <div className="flex items-center gap-3 w-full">
            <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center z-10 shadow-lg flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-sm md:text-base ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Complete these tasks to improve your grade</h3>
              <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{completedTasks.length} of {totalTasks} complete</p>
            </div>
          </div>

          {/* Incomplete Tasks */}
          {incompleteTasks.map((task, idx) => {
            const config = TASK_CONFIG[task.task_type] || TASK_CONFIG.flashcards;
            const live = liveProgress[task.task_type] || {};
            let actualCount = task.completed_count || 0;
            let displayText = '';
            
            if (task.task_type === 'flashcards') {
              // Flashcards track reviewed cards (any card that has been seen)
              actualCount = task.completed_count || 0;
              if (live.reviewed !== undefined && live.reviewed > actualCount) {
                actualCount = live.reviewed;
              }
              const targetCount = task.target_count || 10;
              displayText = `${actualCount} / ${targetCount} reviewed`;
            } else if (task.task_type === 'teach_it') {
              // TeachIt tracks completed cards (any answered card counts)
              actualCount = task.completed_count || 0;
              if (live.completed !== undefined && live.completed > actualCount) {
                actualCount = live.completed;
              }
              const targetCount = task.target_count || 3;
              displayText = `${actualCount} / ${targetCount} completed`;
            } else if (task.task_type === 'practice_exam') {
              if (live.completed > 0 && live.totalQuestions > 0) {
                displayText = `Score: ${live.correctAnswers}/${live.totalQuestions}`;
              } else {
                displayText = `${actualCount} / ${task.target_count || 1} completed`;
              }
            } else {
              displayText = task.completed ? 'Completed' : 'Not started';
            }
            
            const progress = task.target_count > 0 ? (actualCount / task.target_count) * 100 : 0;
            const isFocusFactor = task.is_focus_factor;

            return (
              <motion.div
                key={task.task_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + idx * 0.05 }}
                className="relative w-full flex items-start gap-3"
              >
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-4 ${
                  isFocusFactor ? 'bg-amber-500 ring-2 ring-amber-300 ring-offset-1' : 'bg-white border-2 border-purple-300'
                }`} />
                
                <button
                  onClick={() => handleTaskClick(task)}
                  className="flex-1 min-w-0 text-left group"
                >
                  <div className={`relative rounded-xl transition-all ${
                    isFocusFactor 
                      ? (isDark ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/40 hover:border-amber-500/60 hover:shadow-lg shadow-md' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 hover:border-amber-400 hover:shadow-lg shadow-md')
                      : (isDark ? 'bg-white/5 border border-white/10 hover:border-purple-500/30 hover:shadow-md' : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md')
                  } p-3`}>
                    {isFocusFactor && (
                      <div className="absolute -top-0 -right-0">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg rounded-tr-xl">
                          ⚡ Grade Booster
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isFocusFactor
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                          : `bg-gradient-to-br ${config.gradient}`
                      } shadow-md group-hover:scale-105 transition-transform`}>
                        <config.icon className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wide ${
                            isFocusFactor ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-purple-400' : config.text)
                          }`}>
                            {config.label}
                            {task.is_custom && <span className={`ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>• Custom</span>}
                          </span>
                        </div>
                        <p className={`font-semibold text-xs leading-tight mb-1 ${
                          isFocusFactor ? (isDark ? 'text-amber-200' : 'text-amber-900') : (isDark ? 'text-slate-100' : 'text-slate-900')
                        }`}>
                          {task.title || `${config.action} ${task.target_count} ${config.unit}`}
                        </p>
                        
                        {task.target_count > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[9px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{displayText}</span>
                              <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round(progress)}%</span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                              <div 
                                className={`h-full bg-gradient-to-r ${isFocusFactor ? 'from-amber-500 to-orange-500' : config.gradient} rounded-full transition-all`} 
                                style={{ width: `${Math.min(100, progress)}%` }} 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <ChevronRight className={`w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-all ${
                        isFocusFactor ? (isDark ? 'text-amber-400' : 'text-amber-500') : (isDark ? 'text-slate-500 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-purple-600')
                      }`} />
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}



          {/* Completed Tasks - Below Custom Task */}
          {completedTasks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative pt-2 w-full flex items-start gap-3"
            >
              <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0 mt-6" />
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  Completed ({completedTasks.length})
                </p>
                <div className="space-y-1.5">
                  {completedTasks.map((task) => (
                    <CompletedTaskItem 
                      key={task.task_id} 
                      task={task} 
                      onClick={() => handleTaskClick(task)} 
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>



      {/* Rationale */}
      {studyPlan?.plan_rationale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 px-3 md:px-4 w-full max-w-full"
          style={{ boxSizing: 'border-box' }}
        >
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Why this plan</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{studyPlan.plan_rationale}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}