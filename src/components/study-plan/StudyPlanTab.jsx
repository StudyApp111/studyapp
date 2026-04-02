import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Play, ArrowRight, ChevronRight, Loader2, Sparkles, FileText, TrendingUp, Plus, TrendingDown, Minus, Copy, ChevronDown, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SectionCard from "./SectionCard";
import PickFormatModal from "./PickFormatModal";
import TopicSelectionModal from "./TopicSelectionModal";
import InsightsHero from "./InsightsHero";
import StartStudyPlanCTA from "./StartStudyPlanCTA";
import LiveProgressCounts from "./LiveProgressCounts";
import ExamDatePicker from "./ExamDatePicker";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import posthog from "posthog-js";
import { detectDeviceInfo } from "@/components/utils/userTracking";

const TASK_CONFIG = {
  flashcards: { icon: Copy, gradient: "from-amber-500 to-orange-600", label: "Flashcards", action: "Master", unit: "cards" },
  teach_it: { icon: Brain, gradient: "from-violet-500 to-purple-600", label: "Feynman", action: "Explain", unit: "concepts" },
  review_notes: { icon: FileText, gradient: "from-emerald-500 to-teal-600", label: "Review Notes", action: "Read", unit: "sections" },
  practice_exam: { icon: Zap, gradient: "from-blue-500 to-indigo-600", label: "Practice Quiz", action: "Complete", unit: "quizzes" }
};

const FORMAT_TO_TAB = {
  review_notes: "notes",
  flashcards: "flashcards",
  practice_exam: "exam",
  teach_it: "teachit"
};

const getGradeColor = (grade) => {
  if (!grade || grade === '—') return 'from-slate-500 to-slate-600';
  if (grade.startsWith('A')) return 'from-emerald-500 to-teal-600';
  if (grade.startsWith('B')) return 'from-blue-500 to-indigo-600';
  if (grade.startsWith('C')) return 'from-amber-500 to-orange-600';
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
  const [topicSuggestions, setTopicSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showMoreSections, setShowMoreSections] = useState(false);
  
  // Pick Format Modal state
  const [showPickFormat, setShowPickFormat] = useState(false);
  const [pickFormatSection, setPickFormatSection] = useState(null);
  
  // Topic Selection Modal state
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const [selectedTopicTitles, setSelectedTopicTitles] = useState(null); // null = not loaded yet

  const diagnosticExamFromExams = (exams || []).find(e => e.exam_number === 1 && e.exam_type !== 'practice');
  const isDiagnosticReady = diagnosticExamFromExams?.questions?.length > 0;

  const [gradeJustUpdated, setGradeJustUpdated] = useState(false);
  const [gradeChange, setGradeChange] = useState(null);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const ctaRef = useRef(null);
  const examPollRef = useRef(null);

  // Subscribe to exam changes for instant diagnostic readiness detection
  useEffect(() => {
    if (!lesson?.id || isDiagnosticReady) return;
    
    const unsubscribe = base44.entities.Exam.subscribe((event) => {
      if (event.data?.lesson_id === lesson.id && event.data?.exam_number === 1 && event.data?.exam_type !== 'practice') {
        if (event.data?.questions?.length > 0) {
          console.log('✅ Diagnostic exam ready via realtime subscription');
          window.dispatchEvent(new Event('reloadLesson'));
        }
      }
    });
    
    // Also do one initial check in case it was already created
    base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 }).then(freshExams => {
      const diag = freshExams.find(e => e.exam_type !== 'practice' && e.questions?.length > 0);
      if (diag) window.dispatchEvent(new Event('reloadLesson'));
    }).catch(() => {});
    
    return () => unsubscribe();
  }, [lesson?.id, isDiagnosticReady]);

  // Load study plan
  useEffect(() => {
    const checkAndLoadPlan = async () => {
      if (!lesson?.id) return;
      if (isGeneratingPlan) return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const fromOnboarding = urlParams.get('fromOnboarding') === 'true';
      const reportDataStr = urlParams.get('reportData');
      
      if (fromOnboarding && reportDataStr) {
        try {
          let reportData;
          try { reportData = JSON.parse(reportDataStr); } catch { reportData = JSON.parse(decodeURIComponent(reportDataStr)); }
          
          setStudyPlan({
            initial_predicted_grade: reportData.predicted_grade,
            current_predicted_grade: reportData.predicted_grade,
            initial_score: reportData.predicted_percentage,
            current_score: reportData.predicted_percentage,
            initial_confidence: parseInt(reportData.confidence_level) || 45,
            current_confidence: parseInt(reportData.confidence_level) || 45,
            tasks: [], status: 'active'
          });
          setLoading(false);
          
          setGeneratingProgress(0);
          window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: true } }));
          
          base44.functions.invoke('generateStudyPlan', {
            lesson_id: lesson.id,
            diagnosticData: { predicted_grade: reportData.predicted_grade, predicted_percentage: reportData.predicted_percentage, confidence_level: reportData.confidence_level, weak_areas_detailed: reportData.weak_areas_detailed }
          }).then(result => {
            window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
            if (result.data?.success) { loadStudyPlan(); }
            window.history.replaceState({}, '', `${createPageUrl("DocumentViewer")}?id=${lesson.id}&tab=studyplan`);
          }).catch(err => {
            window.dispatchEvent(new CustomEvent('studyPlanGenerating', { detail: { generating: false } }));
            loadStudyPlan();
          });
        } catch (error) { await loadStudyPlan(); }
      } else {
        await loadStudyPlan();
      }
    };
    checkAndLoadPlan();
  }, [lesson?.id, isGeneratingPlan]);

  // Load selected topics from lesson
  useEffect(() => {
    if (!lesson?.id) return;
    if (lesson.selected_topics?.length > 0) {
      setSelectedTopicTitles(lesson.selected_topics);
    } else {
      setSelectedTopicTitles(null); // null = show all (no filter)
    }
  }, [lesson?.id, lesson?.selected_topics]);

  // Load topic suggestions from lesson
  useEffect(() => {
    if (!lesson?.id) return;
    loadTopicSuggestions();
  }, [lesson?.id, lesson?.topic_suggestions]);

  const loadTopicSuggestions = async () => {
    // First check if already on the lesson object
    if (lesson?.topic_suggestions?.length > 0) {
      setTopicSuggestions(lesson.topic_suggestions);
      return;
    }

    // Poll for them (they're generated async) — use longer polling since generateTopicSuggestions 
    // may need to wait for compressDocument to finish first
    setLoadingSuggestions(true);
    const maxPolls = 15;
    for (let i = 0; i < maxPolls; i++) {
      try {
        const lessons = await base44.entities.Lesson.filter({ id: lesson.id });
        const fresh = lessons[0];
        if (fresh?.topic_suggestions?.length > 0) {
          setTopicSuggestions(fresh.topic_suggestions);
          setLoadingSuggestions(false);
          return;
        }
      } catch (e) { /* ignore */ }
      if (i < maxPolls - 1) await new Promise(r => setTimeout(r, 3000));
    }
    setLoadingSuggestions(false);
  };

  // Subscribe to study plan updates
  useEffect(() => {
    if (!lesson?.id) return;
    const unsubscribe = base44.entities.StudyPlan.subscribe((event) => {
      if (event.data?.lesson_id === lesson.id && event.data?.status === 'active') {
        if (event.type === 'update' && studyPlan) {
          const oldScore = studyPlan.current_score || studyPlan.initial_score;
          const newScore = event.data.current_score || event.data.initial_score;
          const oldGrade = studyPlan.current_predicted_grade || studyPlan.initial_predicted_grade;
          const newGrade = event.data.current_predicted_grade || event.data.initial_predicted_grade;
          if (newScore !== oldScore || newGrade !== oldGrade) {
            setGradeChange({ from: oldGrade, to: newGrade, scoreDiff: newScore && oldScore ? Math.round(newScore - oldScore) : null, newScore });
            setGradeJustUpdated(true);
            setTimeout(() => setGradeJustUpdated(false), 3000);
          }
        }
        setStudyPlan(event.data);
      }
    });
    return () => unsubscribe();
  }, [lesson?.id, studyPlan?.current_score, studyPlan?.current_predicted_grade]);

  const loadStudyPlan = async () => {
    try {
      const plans = await base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: 'active' });
      if (plans.length > 0) setStudyPlan(plans[0]);
      setLoading(false);
    } catch (error) {
      console.error("Error loading study plan:", error);
      setLoading(false);
    }
  };

  // Handle clicking a suggested topic — navigate directly to the format tab
  const handleSuggestedTopicClick = async (section, topic) => {
    const taskCheck = await canDoTask();
    if (!taskCheck.allowed) { triggerUpgradeModal('tasks'); return; }

    try {
      const deviceInfo = detectDeviceInfo();
      posthog.capture('task_started_after_diagnostic', {
        lesson_id: lesson?.id,
        course_name: lesson?.course_name,
        task_type: topic.format,
        device_type: deviceInfo.device_type,
        app_type: deviceInfo.app_type
      });
    } catch {}

    const formatMap = {
      "Review Notes": "notes",
      "Flashcards": "flashcards",
      "Practice Test": "exam",
      "Feynman Technique": "teachit"
    };

    const tab = formatMap[topic.format] || "flashcards";
    const taskTitle = `${section.section_title}: ${topic.topic_title}`;
    
    // Find the matching study plan task to get the real task_id
    const matchingPlanTask = studyPlan?.tasks?.find(t => {
      const typeMap = { "Review Notes": "review_notes", "Flashcards": "flashcards", "Practice Test": "practice_exam", "Feynman Technique": "teach_it" };
      return t.task_type === typeMap[topic.format] && 
        (t.focus_topics?.includes(topic.topic_title) || t.title?.includes(topic.topic_title));
    });
    const taskId = matchingPlanTask?.task_id || `${section.section_title}_${topic.topic_title}_${tab}`;
    
    // Dispatch event with topic info so the target tab can use it
    if (tab === "exam") {
      window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
        detail: {
          taskType: "practice_exam",
          task: {
            task_id: taskId,
            focus_topics: [topic.topic_title],
            target_competency: topic.topic_title,
            title: taskTitle,
            section_title: section.section_title,
            target_count: 1
          },
          focus_topics: [topic.topic_title],
          target_competency: topic.topic_title
        }
      }));
    } else {
      const taskType = tab === "teachit" ? "teach_it" : tab === "notes" ? "review_notes" : tab;
      window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
        detail: {
          taskType,
          task: {
            task_id: taskId,
            task_type: taskType,
            focus_topics: [topic.topic_title],
            target_competency: topic.topic_title,
            title: taskTitle,
            section_title: section.section_title,
            target_count: tab === "flashcards" ? 10 : tab === "exam" ? 1 : 3
          },
          focus_topics: [topic.topic_title],
          target_competency: topic.topic_title
        }
      }));
    }

    onNavigate(tab);
  };

  // Handle "All Topics: Pick Your Format" click
  const handleAllTopicsClick = (section) => {
    setPickFormatSection(section.section_title);
    setShowPickFormat(true);
  };

  // Handle generation from PickFormatModal
  const handlePickFormatGenerate = async (opts) => {
    const taskCheck = await canDoTask();
    if (!taskCheck.allowed) { triggerUpgradeModal('tasks'); return; }

    try {
      const deviceInfo = detectDeviceInfo();
      posthog.capture('task_started_after_diagnostic', {
        lesson_id: lesson?.id,
        course_name: lesson?.course_name,
        task_type: opts.formats.join(','),
        device_type: deviceInfo.device_type,
        app_type: deviceInfo.app_type
      });
    } catch {}

    // Navigate to the first selected format's tab
    const firstFormat = opts.formats[0];
    const tab = FORMAT_TO_TAB[firstFormat] || "flashcards";

    // For each format, dispatch appropriate events
    for (const format of opts.formats) {
      const targetTab = FORMAT_TO_TAB[format];
      
      if (format === "practice_exam") {
        const taskTitle = opts.section_title ? `${opts.section_title}: ${(opts.topics || []).slice(0, 2).join(', ')}` : 'Custom Quiz';
        window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
          detail: {
            task: { task_id: `pick_${opts.section_title}_${format}`, focus_topics: opts.topics, target_competency: opts.section_title || '', title: taskTitle, section_title: opts.section_title || '' },
            focus_topics: opts.topics,
            target_competency: opts.section_title || '',
            custom_instructions: opts.custom_instructions || ''
          }
        }));
      } else if (format === "flashcards" || format === "teach_it") {
        const taskTitle = opts.section_title ? `${opts.section_title}: ${(opts.topics || []).slice(0, 2).join(', ')}` : 'Custom';
        window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
          detail: {
            taskType: format,
            task: { focus_topics: opts.topics, title: taskTitle, section_title: opts.section_title || '', target_count: format === "flashcards" ? 10 : 3 },
            custom_instructions: opts.custom_instructions || ''
          }
        }));
      }
    }

    onNavigate(tab);
  };

  // Grade + metrics
  const latestOfficialExam = (exams || []).filter(e => e.completed && e.predicted_grade && e.exam_type !== 'practice').sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
  const currentGrade = studyPlan?.current_predicted_grade || latestOfficialExam?.predicted_grade || studyPlan?.initial_predicted_grade || '—';
  const currentScore = studyPlan?.current_score || studyPlan?.initial_score || null;
  const currentConfidence = studyPlan?.current_confidence || studyPlan?.initial_confidence || 45;
  const learningVelocity = studyPlan?.learning_velocity;
  const velocityConfig = getVelocityConfig(learningVelocity);
  const behavioralInsights = studyPlan?.behavioral_insights;

  // Progress animation for generating state
  useEffect(() => {
    if (!isGeneratingPlan) { setGeneratingProgress(0); return; }
    const startTime = Date.now();
    const interval = setInterval(() => {
      setGeneratingProgress(Math.min((Date.now() - startTime) / 12000 * 100, 95));
    }, 100);
    return () => clearInterval(interval);
  }, [isGeneratingPlan]);

  // Filter topic suggestions by selected topics
  const filteredSuggestions = React.useMemo(() => {
    if (!selectedTopicTitles || selectedTopicTitles.length === 0) return topicSuggestions;
    const selectedSet = new Set(selectedTopicTitles);
    return topicSuggestions
      .map(section => {
        // Keep section if its title is selected
        if (!selectedSet.has(section.section_title)) {
          // Check if any suggested topics match
          const filteredTopics = (section.suggested_topics || []).filter(t => selectedSet.has(t.topic_title));
          if (filteredTopics.length === 0) return null;
          return { ...section, suggested_topics: filteredTopics };
        }
        return section;
      })
      .filter(Boolean);
  }, [topicSuggestions, selectedTopicTitles]);

  const handleTopicSelectionConfirm = (selected) => {
    setSelectedTopicTitles(selected);
    // Reload lesson to reflect changes
    window.dispatchEvent(new Event('reloadLesson'));
  };

  // Split sections: first 3 expanded, rest collapsed
  const displayedSections = filteredSuggestions.slice(0, 3);
  const remainingSections = filteredSuggestions.slice(3);

  // ===== GENERATING STATE =====
  if (isGeneratingPlan) {
    return (
      <div className={`px-3 md:px-6 pt-4 pb-8 w-full max-w-[400px] md:max-w-2xl mx-auto ${isDark ? 'bg-[#0a0a12]' : ''}`}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className={isDark ? 'stroke-slate-700' : 'stroke-slate-200'} />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-purple-500 transition-all duration-300" style={{ strokeDasharray: '264', strokeDashoffset: 264 - (264 * generatingProgress / 100) }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{Math.round(generatingProgress)}%</span>
              </div>
            </div>
            <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Building Your Study Plan</h3>
            <p className={`text-sm text-center max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Analyzing your diagnostic to create a personalized roadmap</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ===== NO STUDY PLAN - TAKE DIAGNOSTIC =====
  if (!loading && !studyPlan) {
    const workflowSteps = [
      { num: "1", label: "Take Diagnostic", desc: "5-min quiz to find your weak spots", icon: Target, color: "from-purple-500 to-indigo-600" },
      { num: "2", label: "Get Your Grade", desc: "AI predicts your exam grade", icon: Trophy, color: "from-amber-500 to-orange-600" },
      { num: "3", label: "Custom Study Plan", desc: "Personalized tasks to improve", icon: BookOpen, color: "from-emerald-500 to-teal-600" },
    ];

    return (
      <div className={`px-3 md:px-6 pt-4 pb-8 w-full max-w-[400px] md:max-w-2xl mx-auto ${isDark ? 'bg-[#0a0a12]' : ''}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Hero CTA */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-6 shadow-2xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative text-center">
              <h2 className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
                Let's build your custom<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">study roadmap.</span>
              </h2>
              <p className="text-purple-200 text-sm max-w-sm mx-auto leading-relaxed mb-4">
                Take a quick 5-minute diagnostic. It's completely okay if you don't know the answers yet!
              </p>

              {/* Visual workflow steps */}
              <div className="flex items-center justify-center gap-2 mb-5">
                {workflowSteps.map((step, idx) => (
                  <React.Fragment key={step.num}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                        <step.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] text-purple-200 font-medium leading-tight text-center max-w-[80px]">{step.label}</span>
                    </div>
                    {idx < workflowSteps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-purple-400/60 flex-shrink-0 mt-[-14px]" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <Button 
                ref={ctaRef}
                onClick={() => {
                  if (!isDiagnosticReady) return;
                  window.dispatchEvent(new CustomEvent('startDiagnosticExam', { detail: { examNumber: 1 } }));
                  onNavigate('exam');
                }}
                disabled={!isDiagnosticReady}
                className={`w-full max-w-xs mx-auto font-bold py-5 text-base rounded-2xl shadow-xl relative overflow-hidden group ${isDiagnosticReady ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30' : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white/70 cursor-not-allowed shadow-none'}`}
              >
                {isDiagnosticReady ? (<><Play className="w-5 h-5 mr-2" />Start Diagnostic — 5 min</>) : (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing Your Quiz...</>)}
              </Button>
              <p className="text-[10px] text-purple-300/70 mt-2">
                {isDiagnosticReady ? 'Free · 5 questions · Get your predicted grade' : 'Almost ready — generating your personalized questions'}
              </p>
            </div>
          </div>

          {/* Topic suggestions hidden until diagnostic is completed */}
        </motion.div>
        <PickFormatModal open={showPickFormat} onOpenChange={setShowPickFormat} lessonId={lesson?.id} sectionTitle={pickFormatSection} onGenerate={handlePickFormatGenerate} />
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full" /></div>;
  }

  // ===== MAIN STUDY PLAN VIEW =====
  return (
    <div className={`w-full max-w-full overflow-x-hidden py-3 space-y-3 md:space-y-4 pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', maxWidth: '100vw' }}>
      {/* Grade Banner with Progress Explanation */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-3 md:px-4 w-full max-w-full">
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${getGradeColor(currentGrade)} px-4 py-3 shadow-lg transition-all duration-500 w-full ${gradeJustUpdated ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <AnimatePresence>
            {gradeJustUpdated && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-1 right-2 z-20">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-[9px] font-black">
                  <Sparkles className="w-3 h-3" />Updated
                  {gradeChange?.scoreDiff != null && gradeChange.scoreDiff !== 0 && (
                    <span className={gradeChange.scoreDiff > 0 ? 'text-emerald-700' : 'text-red-700'}>{gradeChange.scoreDiff > 0 ? '+' : ''}{gradeChange.scoreDiff}%</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <motion.span className="text-3xl md:text-4xl font-black text-white" animate={gradeJustUpdated ? { scale: [1, 1.1, 1] } : {}}>{currentGrade}</motion.span>
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg leading-tight">{currentScore ? Math.round(currentScore) : '—'}%</span>
                <span className="text-white/60 text-[9px] font-medium uppercase tracking-wide">Predicted</span>
              </div>
              {learningVelocity && (
                <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full ${velocityConfig.bg}`}>
                  <velocityConfig.icon className={`w-3 h-3 ${velocityConfig.color}`} />
                  <span className={`text-[10px] font-bold ${velocityConfig.color}`}>{velocityConfig.label}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${currentConfidence}%` }} />
                  </div>
                  <span className="text-white/80 text-[10px] font-bold">{Math.round(currentConfidence)}%</span>
                </div>
                <span className="text-white/50 text-[8px]">confidence</span>
              </div>
              {latestOfficialExam && (
                <button onClick={() => { onNavigate('exam'); setTimeout(() => { window.dispatchEvent(new CustomEvent('viewExamResults', { detail: { examId: latestOfficialExam.id } })); }, 100); }} className="text-white/60 hover:text-white/90 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* Live progress counts */}
          <LiveProgressCounts lessonId={lesson?.id} />
          {/* Exam date picker */}
          <div className="relative mt-2">
            <ExamDatePicker lesson={lesson} onUpdate={(updated) => window.dispatchEvent(new Event('reloadLesson'))} />
          </div>
        </div>
      </motion.div>

      {/* AI Insights Hero — dynamic personalized message */}
      {(studyPlan?.mastery_gap || studyPlan?.priority_focus || studyPlan?.weak_competencies?.length > 0 || behavioralInsights) && (
        <InsightsHero 
          lesson={lesson}
          studyPlan={studyPlan}
          behavioralInsights={behavioralInsights}
        />
      )}

      {/* Start / Continue Study Plan CTA */}
      {filteredSuggestions.length > 0 && studyPlan && (
        <StartStudyPlanCTA
          studyPlan={studyPlan}
          topicSuggestions={filteredSuggestions}
          onNavigate={onNavigate}
        />
      )}

      {/* Section-based Study Guide */}
      {filteredSuggestions.length > 0 && (
        <div className="px-3 md:px-4 space-y-3">
          <div className="px-1 flex items-center justify-between">
            <div className="space-y-1">
              <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Your Study Guide
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedTopicTitles ? `${filteredSuggestions.length} of ${topicSuggestions.length} sections` : 'Complete tasks in order'}
              </p>
            </div>
            <button
              onClick={() => setShowTopicSelection(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter Topics
            </button>
          </div>
          {displayedSections.map((section, idx) => (
            <SectionCard
              key={idx}
              section={section}
              index={idx}
              defaultExpanded={idx < 2}
              onTopicClick={handleSuggestedTopicClick}
              onAllTopicsClick={handleAllTopicsClick}
              studyPlan={studyPlan}
            />
          ))}
          {remainingSections.length > 0 && (
            <>
              <button onClick={() => setShowMoreSections(!showMoreSections)} className={`w-full text-center py-2 text-xs font-semibold flex items-center justify-center gap-1 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                {showMoreSections ? <><ChevronDown className="w-3 h-3" /> Show less</> : <><ChevronRight className="w-3 h-3" /> {remainingSections.length} more section{remainingSections.length !== 1 ? 's' : ''}</>}
              </button>
              {showMoreSections && remainingSections.map((section, idx) => (
                <SectionCard key={idx + 3} section={section} index={idx + 3} defaultExpanded={false} onTopicClick={handleSuggestedTopicClick} onAllTopicsClick={handleAllTopicsClick} studyPlan={studyPlan} />
              ))}
            </>
          )}
        </div>
      )}
      {loadingSuggestions && filteredSuggestions.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 px-3">
          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading study guide...</span>
        </div>
      )}

      {/* Completed tasks are now shown inline within sections via studyPlan prop */}

      {/* Rationale */}
      {studyPlan?.plan_rationale && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4 px-3 md:px-4 w-full">
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Why this plan</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{studyPlan.plan_rationale}</p>
          </div>
        </motion.div>
      )}

      {/* Pick Format Modal */}
      <PickFormatModal open={showPickFormat} onOpenChange={setShowPickFormat} lessonId={lesson?.id} sectionTitle={pickFormatSection} onGenerate={handlePickFormatGenerate} />

      {/* Topic Selection Modal */}
      <TopicSelectionModal
        open={showTopicSelection}
        onOpenChange={setShowTopicSelection}
        lesson={lesson}
        onConfirm={handleTopicSelectionConfirm}
      />
    </div>
  );
}