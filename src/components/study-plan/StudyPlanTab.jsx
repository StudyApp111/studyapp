import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Target, CheckCircle2, BookOpen, Zap, Brain, 
  Trophy, Play, ArrowRight, ChevronRight, Loader2, Sparkles, FileText, TrendingUp, AlertCircle, Plus, TrendingDown, Minus, Lightbulb, Clock, Copy, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SectionCard from "./SectionCard";
import PickFormatModal from "./PickFormatModal";
import CompletedTaskItem from "./CompletedTaskItem";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

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

  const diagnosticExamFromExams = (exams || []).find(e => e.exam_number === 1 && e.exam_type !== 'practice');
  const isDiagnosticReady = diagnosticExamFromExams?.questions?.length > 0;

  const [gradeJustUpdated, setGradeJustUpdated] = useState(false);
  const [gradeChange, setGradeChange] = useState(null);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const ctaRef = useRef(null);
  const examPollRef = useRef(null);

  // Poll for diagnostic exam readiness
  useEffect(() => {
    if (examPollRef.current) { clearInterval(examPollRef.current); examPollRef.current = null; }
    if (lesson?.id && !isDiagnosticReady) {
      examPollRef.current = setInterval(async () => {
        try {
          const freshExams = await base44.entities.Exam.filter({ lesson_id: lesson.id, exam_number: 1 });
          const diag = freshExams.find(e => e.exam_type !== 'practice');
          if (diag?.questions?.length > 0) {
            window.dispatchEvent(new Event('reloadLesson'));
            clearInterval(examPollRef.current); examPollRef.current = null;
          }
        } catch (err) { console.warn('Exam poll error:', err); }
      }, 3000);
    }
    return () => { if (examPollRef.current) { clearInterval(examPollRef.current); examPollRef.current = null; } };
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

    // Poll for them (they're generated async)
    setLoadingSuggestions(true);
    const maxPolls = 8;
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

    const formatMap = {
      "Review Notes": "notes",
      "Flashcards": "flashcards",
      "Practice Test": "exam",
      "Feynman Technique": "teachit"
    };

    const tab = formatMap[topic.format] || "flashcards";
    
    // Dispatch event with topic info so the target tab can use it
    const eventMap = {
      "flashcards": "generateFromStudyTask",
      "teachit": "generateFromStudyTask",
      "exam": "generatePracticeExamFromTask"
    };

    const eventName = eventMap[tab];
    if (eventName) {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: {
          taskType: tab === "teachit" ? "teach_it" : tab === "exam" ? "practice_exam" : tab,
          task: {
            focus_topics: [topic.topic_title],
            target_competency: topic.topic_title,
            title: topic.topic_title,
            target_count: tab === "flashcards" ? 10 : tab === "exam" ? 1 : 3
          }
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

    // Navigate to the first selected format's tab
    const firstFormat = opts.formats[0];
    const tab = FORMAT_TO_TAB[firstFormat] || "flashcards";

    // For each format, dispatch appropriate events
    for (const format of opts.formats) {
      const targetTab = FORMAT_TO_TAB[format];
      
      if (format === "practice_exam") {
        window.dispatchEvent(new CustomEvent('generatePracticeExamFromTask', {
          detail: {
            task: { focus_topics: opts.topics, target_competency: opts.section_title || '', title: opts.section_title || 'Custom Quiz' },
            focus_topics: opts.topics,
            target_competency: opts.section_title || '',
            custom_instructions: opts.custom_instructions || ''
          }
        }));
      } else if (format === "flashcards" || format === "teach_it") {
        window.dispatchEvent(new CustomEvent('generateFromStudyTask', {
          detail: {
            taskType: format,
            task: { focus_topics: opts.topics, title: opts.section_title || 'Custom', target_count: format === "flashcards" ? 10 : 3 },
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

  const completedTasks = studyPlan?.tasks?.filter(t => t.completed) || [];

  // Progress animation for generating state
  useEffect(() => {
    if (!isGeneratingPlan) { setGeneratingProgress(0); return; }
    const startTime = Date.now();
    const interval = setInterval(() => {
      setGeneratingProgress(Math.min((Date.now() - startTime) / 12000 * 100, 95));
    }, 100);
    return () => clearInterval(interval);
  }, [isGeneratingPlan]);

  // Split sections: first 3 expanded, rest collapsed
  const displayedSections = topicSuggestions.slice(0, 3);
  const remainingSections = topicSuggestions.slice(3);

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
              <p className="text-purple-200 text-sm max-w-sm mx-auto leading-relaxed mb-5">
                Take a quick 5-minute diagnostic. It's completely okay if you don't know the answers yet!
              </p>
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
                {isDiagnosticReady ? 'Free · 10 questions · Get your predicted grade' : 'Almost ready — generating your personalized questions'}
              </p>
            </div>
          </div>

          {/* Topic Suggestions - show even before diagnostic */}
          {topicSuggestions.length > 0 && (
            <div className="space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Your Content Breakdown
              </p>
              {displayedSections.map((section, idx) => (
                <SectionCard
                  key={idx}
                  section={section}
                  index={idx}
                  defaultExpanded={idx === 0}
                  onTopicClick={handleSuggestedTopicClick}
                  onAllTopicsClick={handleAllTopicsClick}
                />
              ))}
              {remainingSections.length > 0 && (
                <>
                  <button onClick={() => setShowMoreSections(!showMoreSections)} className={`w-full text-center py-2 text-xs font-semibold ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                    {showMoreSections ? 'Show less' : `+ ${remainingSections.length} more section${remainingSections.length !== 1 ? 's' : ''}`}
                  </button>
                  <AnimatePresence>
                    {showMoreSections && remainingSections.map((section, idx) => (
                      <SectionCard key={idx + 3} section={section} index={idx + 3} defaultExpanded={false} onTopicClick={handleSuggestedTopicClick} onAllTopicsClick={handleAllTopicsClick} />
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}
          {loadingSuggestions && topicSuggestions.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Analyzing your materials...</span>
            </div>
          )}
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
      {/* Grade Banner */}
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
        </div>
      </motion.div>

      {/* AI Insights */}
      {behavioralInsights && (behavioralInsights.is_guessing_detected || behavioralInsights.is_inefficient_studying || behavioralInsights.recommended_focus || behavioralInsights.estimated_hours_to_target) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="px-3 md:px-4 w-full">
          <div className={`rounded-2xl p-4 border ${isDark ? 'bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/60'}`}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <Lightbulb className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>StudyApp Insights</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {behavioralInsights.estimated_hours_to_target && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                  <Clock className="w-3 h-3" /><span className="text-[11px] font-semibold">~{Math.round(behavioralInsights.estimated_hours_to_target)}h to A+</span>
                </div>
              )}
              {behavioralInsights.is_guessing_detected && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  <AlertCircle className="w-3 h-3" /><span className="text-[11px] font-semibold">Slow down</span>
                </div>
              )}
            </div>
            {behavioralInsights.recommended_focus && (
              <p className={`text-sm leading-relaxed text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{behavioralInsights.recommended_focus}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Section-based Study Guide */}
      {topicSuggestions.length > 0 && (
        <div className="px-3 md:px-4 space-y-3">
          <p className={`text-xs font-bold uppercase tracking-wider px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Your Study Guide
          </p>
          {displayedSections.map((section, idx) => (
            <SectionCard
              key={idx}
              section={section}
              index={idx}
              defaultExpanded={idx < 2}
              onTopicClick={handleSuggestedTopicClick}
              onAllTopicsClick={handleAllTopicsClick}
            />
          ))}
          {remainingSections.length > 0 && (
            <>
              <button onClick={() => setShowMoreSections(!showMoreSections)} className={`w-full text-center py-2 text-xs font-semibold flex items-center justify-center gap-1 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                {showMoreSections ? <><ChevronDown className="w-3 h-3" /> Show less</> : <><ChevronRight className="w-3 h-3" /> {remainingSections.length} more section{remainingSections.length !== 1 ? 's' : ''}</>}
              </button>
              <AnimatePresence>
                {showMoreSections && remainingSections.map((section, idx) => (
                  <SectionCard key={idx + 3} section={section} index={idx + 3} defaultExpanded={false} onTopicClick={handleSuggestedTopicClick} onAllTopicsClick={handleAllTopicsClick} />
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
      {loadingSuggestions && topicSuggestions.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 px-3">
          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading study guide...</span>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="px-3 md:px-4">
          <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <CheckCircle2 className="w-3 h-3 inline mr-1" />Completed ({completedTasks.length})
          </p>
          <div className="space-y-1.5">
            {completedTasks.map((task) => (
              <CompletedTaskItem key={task.task_id} task={task} onClick={() => {
                const tab = FORMAT_TO_TAB[task.task_type] || 'flashcards';
                onNavigate(tab);
              }} />
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}