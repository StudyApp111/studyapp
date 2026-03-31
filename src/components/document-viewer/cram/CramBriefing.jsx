import React from "react";
import { Card } from "@/components/ui/card";
import { Brain, Target, TrendingUp } from "lucide-react";

export default function CramBriefing({ studyPlan, isDark }) {
  return (
    <Card className={`p-5 border-2 shadow-sm ${isDark ? 'bg-[#12121a]/95 border-purple-500/20' : 'bg-white border-purple-100'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20' : 'bg-gradient-to-br from-purple-100 to-indigo-100'}`}>
          <Brain className={`w-6 h-6 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
        </div>
        <div>
          <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>AI Analysis Briefing</h3>
          <p className={`text-xs md:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Polly has identified your current weak spots based on exam performance.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile 
          icon={<Target className="w-4 h-4" />}
          label="Primary Weakness" 
          value={studyPlan?.mastery_gap || 'Not enough data yet'} 
          isDark={isDark} 
          highlight
        />
        <InfoTile 
          icon={<TrendingUp className="w-4 h-4" />}
          label="Current Outlook" 
          value={studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || 'No prediction yet'} 
          isDark={isDark} 
        />
        <InfoTile 
          icon={<Brain className="w-4 h-4" />}
          label="Recommended Focus" 
          value={studyPlan?.behavioral_insights?.recommended_focus || 'Stay tight on weak topics'} 
          isDark={isDark} 
        />
      </div>
    </Card>
  );
}

function InfoTile({ icon, label, value, isDark, highlight }) {
  return (
    <div className={`rounded-xl p-3 border flex flex-col ${
      highlight 
        ? (isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200') 
        : (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
    }`}>
      <div className={`flex items-center gap-1.5 mb-1.5 ${
        highlight 
          ? (isDark ? 'text-red-400' : 'text-red-700') 
          : (isDark ? 'text-purple-400' : 'text-purple-600')
      }`}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-medium leading-snug mt-auto ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}