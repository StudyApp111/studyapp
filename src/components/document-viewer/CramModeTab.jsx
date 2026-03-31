import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Calendar, Brain, Clock3, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
      className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
        isVeryUrgent 
          ? 'bg-red-500/15 border-red-500/30' 
          : 'bg-orange-500/15 border-orange-500/30'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isVeryUrgent ? 'bg-red-500/20' : 'bg-orange-500/20'}`}>
        <Calendar className={`w-4 h-4 ${isVeryUrgent ? 'text-red-400' : 'text-orange-400'}`} />
      </div>
      <div>
        <p className={`text-sm font-bold ${isVeryUrgent ? (isDark ? 'text-red-300' : 'text-red-700') : (isDark ? 'text-orange-300' : 'text-orange-700')}`}>
          {urgencyText}
        </p>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Focus on your weak spots below
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
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState("setup"); // "setup" | "sprint" | "done"
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!lesson?.id) return;
    setIsLoading(true);
    base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: 'active' })
      .then((plans) => setStudyPlan(plans?.[0] || null))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [lesson?.id]);

  const topicOptions = useMemo(() => {
    if (studyPlan?.weak_competencies?.length) return studyPlan.weak_competencies.slice(0, 6);
    if (studyPlan?.mastery_gap) return [studyPlan.mastery_gap];
    return (lesson?.selected_topics || []).slice(0, 6);
  }, [studyPlan, lesson?.selected_topics]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
        <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>Loading cram mode...</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`p-5 border text-center ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h3 className={`font-black text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Sprint complete</h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            You completed {completedCount} focused reps inside Cram Mode.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => { setPhase("setup"); setCompletedCount(0); }}>
              Close
            </Button>
            <Button onClick={() => { setCompletedCount(0); setPhase("sprint"); }}>
              <RotateCcw className="w-4 h-4 mr-2" /> New sprint
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
        topicOptions={topicOptions}
        isDark={isDark}
        onFinish={(count) => { setCompletedCount(count); setPhase("done"); }}
        onExit={() => setPhase("setup")}
      />
    );
  }

  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      {isCramActive && <CramUrgencyBanner daysUntilExam={daysUntilExam} isDark={isDark} />}
      <CramBriefing studyPlan={studyPlan} topicOptions={topicOptions} isDark={isDark} />
      <CramSetup
        settings={settings}
        onChange={setSettings}
        topicOptions={topicOptions}
        isDark={isDark}
        onStart={() => setPhase("sprint")}
      />
    </div>
  );
}