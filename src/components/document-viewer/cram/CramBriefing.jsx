import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";

export default function CramBriefing({ studyPlan, topicOptions, isDark }) {
  return (
    <Card className={`p-4 border ${isDark ? 'bg-[#12121a]/95 border-orange-500/20' : 'bg-white border-orange-200'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
          <Brain className={`w-5 h-5 ${isDark ? 'text-orange-300' : 'text-orange-600'}`} />
        </div>
        <div>
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Polly briefing</h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sprint targets your weakest areas with embedded mini-practice.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile label="Mastery gap" value={studyPlan?.mastery_gap || 'Not enough data yet'} isDark={isDark} />
        <InfoTile label="Current outlook" value={studyPlan?.current_predicted_grade || studyPlan?.initial_predicted_grade || 'No prediction yet'} isDark={isDark} />
        <InfoTile label="Behavioral focus" value={studyPlan?.behavioral_insights?.recommended_focus || 'Stay tight on weak topics'} isDark={isDark} />
      </div>

      {topicOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topicOptions.map((topic) => (
            <Badge key={topic} className={isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200'}>
              {topic}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function InfoTile({ label, value, isDark }) {
  return (
    <div className={`rounded-xl p-3 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
      <p className={`text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{value}</p>
    </div>
  );
}