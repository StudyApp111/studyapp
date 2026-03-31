import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RotateCcw, Calendar, CheckCircle2, FlameKindling } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import CramBriefing from "./cram/CramBriefing";
import CramSetup from "./cram/CramSetup";
import CramSprint from "./cram/CramSprint";

function CramUrgencyBanner({ daysUntilExam, isDark }) {
  if (daysUntilExam == null || daysUntilExam < 0) return null;
  const urgencyText = daysUntilExam === 0 ? "Your exam is TODAY!" 
    : daysUntilExam === 1 ? "Your exam is TOMORROW!" 
    : `${daysUntilExam} days until your exam`;
  const isVeryUrgent = daysUntilExam <= 2;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl px-4 py-3 flex items-center gap-3 border shadow-sm ${
        isVeryUrgent 
          ? 'bg-red-600/15 border-red-600/30' 
          : 'bg-red-500/15 border-red-500/30'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/20`}>
        <Calendar className={`w-4 h-4 text-red-500`} />
      </div>
      <div>
        <p className={`text-sm font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
          {urgencyText}
        </p>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          A focused sprint is highly recommended.
        </p>
      </div>
    </motion.div>
  );
}

const DEFAULT_SETTINGS = {
  formats: ['flashcards', 'teach_it', 'practice_exam'],
  durationMinutes: 10,
  itemCount: 12,
  topics: [],
};

export default function CramModeTab({ lesson, isCramActive, daysUntilExam }) {
  const { isDark } = useTheme();
  const [studyPlan, setStudyPlan] = useState(null);
  const [inventory, setInventory] = useState({ flashcards: [], teachIt: [], exams: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState("setup"); 
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!lesson?.id) return;
    setIsLoading(true);
    Promise.all([
      base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: 'active' }),
      base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
      base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
      base44.entities.Exam.filter({ lesson_id: lesson.id, exam_type: 'practice' })
    ]).then(([plans, fcards, tcards, px]) => {
      setStudyPlan(plans?.[0] || null);
      setInventory({ flashcards: fcards, teachIt: tcards, exams: px });
    }).catch(console.error).finally(() => setIsLoading(false));
  }, [lesson?.id]);

  const allTopics = useMemo(() => {
    const topics = (lesson?.topics || []).map(t => t.title || t).filter(Boolean);
    if (topics.length > 0) return topics;
    return lesson?.selected_topics || ['General Concepts'];
  }, [lesson]);

  const weakTopics = useMemo(() => {
    const weak = [];
    if (studyPlan?.weak_competencies?.length) weak.push(...studyPlan.weak_competencies);
    if (studyPlan?.mastery_gap) weak.push(studyPlan.mastery_gap);
    return [...new Set(weak)];
  }, [studyPlan]);

  useEffect(() => {
    if (weakTopics.length > 0 && settings.topics.length === 0) {
      setSettings(prev => ({ ...prev, topics: weakTopics.slice(0, 6) }));
    }
  }, [weakTopics]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-4" />
        <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>Loading Cram Mode...</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`p-8 border-2 shadow-2xl text-center ${isDark ? 'bg-[#12121a]/95 border-red-500/30' : 'bg-white border-red-200'}`}>
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h3 className={`font-black text-2xl mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Sprint Complete!</h3>
          <p className={`text-base mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            You successfully completed <strong className="text-red-500">{completedCount}</strong> focused reps. Excellent work!
          </p>
          <div className="flex gap-3 justify-center max-w-sm mx-auto">
            <Button variant="outline" onClick={() => { setPhase("setup"); setCompletedCount(0); }} className="flex-1 h-12">
              Back to Overview
            </Button>
            <Button onClick={() => { setCompletedCount(0); setPhase("sprint"); }} className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white shadow-lg">
              <RotateCcw className="w-4 h-4 mr-2" /> Sprint Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "sprint") {
    return (
      <CramSprint
        lesson={lesson}
        settings={settings}
        topicOptions={allTopics}
        weakTopics={weakTopics}
        inventory={inventory}
        isDark={isDark}
        onFinish={(count) => { setCompletedCount(count); setPhase("done"); }}
        onExit={() => setPhase("setup")}
      />
    );
  }

  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <Card className={`border-0 shadow-xl overflow-hidden ${isDark ? 'bg-[#12121a] border-red-500/30' : 'bg-white border-red-200'}`}>
        <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-800 px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-400/20 rounded-full blur-2xl" />
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <FlameKindling className="w-14 h-14 text-white mx-auto mb-3 drop-shadow-lg" />
          </motion.div>
          <h2 className="text-2xl font-black text-white mb-2">Cram Mode</h2>
          <p className="text-red-100 text-sm max-w-sm mx-auto">
            A high-intensity, mixed-format sprint. Your actual materials, served fast.
          </p>
        </div>
      </Card>
      {isCramActive && <CramUrgencyBanner daysUntilExam={daysUntilExam} isDark={isDark} />}
      <CramBriefing studyPlan={studyPlan} isDark={isDark} />
      <CramSetup
        settings={settings}
        onChange={setSettings}
        topicOptions={allTopics}
        weakTopics={weakTopics}
        inventory={inventory}
        isDark={isDark}
        onStart={() => setPhase("sprint")}
      />
    </div>
  );
}