import React from "react";
import { Sparkles, Target, Clock, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const PILL_STYLES = {
  danger: { bg: "bg-red-500/15 text-red-300 border-red-500/20", bgLight: "bg-red-50 text-red-700 border-red-200", icon: Target },
  warning: { bg: "bg-amber-500/15 text-amber-300 border-amber-500/20", bgLight: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  info: { bg: "bg-blue-500/15 text-blue-300 border-blue-500/20", bgLight: "bg-blue-50 text-blue-700 border-blue-200", icon: Info },
};

export default function InsightsHero({ lesson, studyPlan, behavioralInsights }) {
  const { isDark } = useTheme();

  const insightsPanel = studyPlan?.insights_panel;

  // If we have the new insights_panel from generateStudyPlan, use it directly
  if (insightsPanel?.headline) {
    const pills = insightsPanel.pills || [];

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.1 }}
        className="px-3 md:px-4 w-full"
      >
        <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950/60 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-white border-indigo-200/60'}`}>
          {/* Main message */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30' : 'bg-gradient-to-br from-purple-100 to-indigo-100'}`}>
                <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm md:text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {insightsPanel.headline}
                </p>
                <p className={`text-xs md:text-sm leading-relaxed mt-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {insightsPanel.support_text}
                </p>
              </div>
            </div>
          </div>

          {/* Pills strip */}
          {pills.length > 0 && (
            <div className={`px-4 py-2.5 flex flex-wrap items-center gap-2 border-t ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200/60 bg-slate-50/50'}`}>
              {pills.map((pill, idx) => {
                const style = PILL_STYLES[pill.type] || PILL_STYLES.info;
                const Icon = style.icon;
                return (
                  <div 
                    key={pill.id || idx} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${isDark ? style.bg : style.bgLight}`}
                  >
                    <Icon className="w-3 h-3" />
                    {pill.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Fallback: legacy behavior using studyPlan fields + behavioralInsights
  const currentGrade = studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || '—';
  const masteryGap = studyPlan?.mastery_gap || studyPlan?.priority_focus;
  const weakComps = studyPlan?.weak_competencies?.filter(c => c !== masteryGap) || [];
  const courseName = lesson?.course_name || 'your course';
  const estimatedHours = behavioralInsights?.estimated_hours_to_target;
  const isGuessing = behavioralInsights?.is_guessing_detected;
  const isInefficient = behavioralInsights?.is_inefficient_studying;
  const recommendedFocus = behavioralInsights?.recommended_focus;

  const gradeIsGood = currentGrade.startsWith('A');
  const gradeIsBad = currentGrade.startsWith('D') || currentGrade.startsWith('F');

  let headline = '';
  let subtext = '';

  if (gradeIsGood) {
    headline = `You're on track for an ${currentGrade} in ${courseName}.`;
    subtext = masteryGap 
      ? `Keep it up! Fine-tune your understanding of "${masteryGap}" to lock in that top grade.`
      : `Keep completing tasks below to maintain your edge.`;
  } else if (gradeIsBad) {
    headline = `Your predicted grade for ${courseName} is a ${currentGrade} — but we've got a plan.`;
    subtext = masteryGap
      ? `Your biggest gap is "${masteryGap}." The study plan below is designed to close it. Let's get you to an A.`
      : `The tasks below target your weakest areas. Every one you complete moves the needle.`;
  } else {
    headline = `Welcome to your study hub for ${courseName}.`;
    subtext = masteryGap
      ? `Your predicted grade is a ${currentGrade}. We've identified "${masteryGap}" as your #1 gap — your custom plan below targets it directly to get you to an A.`
      : `Your predicted grade is a ${currentGrade}. Complete the tasks below and watch your grade climb.`;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.1 }}
      className="px-3 md:px-4 w-full"
    >
      <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950/60 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-white border-indigo-200/60'}`}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30' : 'bg-gradient-to-br from-purple-100 to-indigo-100'}`}>
              <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm md:text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {headline}
              </p>
              <p className={`text-xs md:text-sm leading-relaxed mt-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {subtext}
              </p>
            </div>
          </div>
        </div>

        <div className={`px-4 py-2.5 flex flex-wrap items-center gap-2 border-t ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200/60 bg-slate-50/50'}`}>
          {masteryGap && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <Target className="w-3 h-3" />#1 Gap: {masteryGap}
            </div>
          )}
          {estimatedHours && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
              <Clock className="w-3 h-3" />~{Math.round(estimatedHours)}h to A+
            </div>
          )}
          {isGuessing && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <AlertCircle className="w-3 h-3" />Guessing detected
            </div>
          )}
          {isInefficient && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <AlertCircle className="w-3 h-3" />Try active recall
            </div>
          )}
          {weakComps.length > 0 && weakComps.slice(0, 3).map((comp, idx) => (
            <span key={idx} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {comp}
            </span>
          ))}
        </div>

        {recommendedFocus && (
          <div className={`px-4 py-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Sparkles className="w-3 h-3 inline mr-1 text-purple-400" />{recommendedFocus}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}