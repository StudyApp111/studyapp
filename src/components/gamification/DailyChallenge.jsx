import React from "react";
import { motion } from "framer-motion";
import { Target, Zap, CheckCircle2, Clock, BookOpen, Brain } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "@/components/theme/ThemeProvider";

const DAILY_CHALLENGES = [
  { id: 'study_10', title: 'Study for 10 minutes', xp: 15, icon: Clock, target: 10 },
  { id: 'answer_5', title: 'Answer 5 questions', xp: 20, icon: Brain, target: 5 },
  { id: 'flashcard_10', title: 'Review 10 flashcards', xp: 15, icon: BookOpen, target: 10 },
];

export default function DailyChallenge({ 
  studyMinutes = 0, 
  questionsAnswered = 0, 
  flashcardsReviewed = 0,
  onChallengeComplete,
  compact = false
}) {
  const { isDark } = useTheme();
  const getProgress = (challengeId) => {
    switch (challengeId) {
      case 'study_10': return Math.min(studyMinutes, 10);
      case 'answer_5': return Math.min(questionsAnswered, 5);
      case 'flashcard_10': return Math.min(flashcardsReviewed, 10);
      default: return 0;
    }
  };

  const isComplete = (challenge) => getProgress(challenge.id) >= challenge.target;
  const completedCount = DAILY_CHALLENGES.filter(isComplete).length;

  // Compact version for sidebar
  if (compact) {
    return (
      <div className={`rounded-2xl p-4 shadow-sm border ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-100'}`}>
              <Target className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Daily Goals</p>
            </div>
          </div>
          <span className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{completedCount}/3</span>
        </div>
        
        <div className="space-y-2">
          {DAILY_CHALLENGES.map((challenge) => {
            const progress = getProgress(challenge.id);
            const complete = isComplete(challenge);
            const Icon = challenge.icon;
            
            return (
              <div key={challenge.id} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${complete ? 'bg-emerald-500' : (isDark ? 'bg-white/10' : 'bg-slate-100')}`}>
                  {complete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Icon className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div 
                        className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-purple-500'}`}
                        style={{ width: `${(progress / challenge.target) * 100}%` }}
                      />
                    </div>
                    <span className={`text-[10px] w-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{progress}/{challenge.target}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 shadow-lg border ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-purple-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Daily Challenges</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{completedCount}/{DAILY_CHALLENGES.length} completed</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-100'}`}>
          <span className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
            +{DAILY_CHALLENGES.filter(isComplete).reduce((sum, c) => sum + c.xp, 0)} XP
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {DAILY_CHALLENGES.map((challenge, idx) => {
          const progress = getProgress(challenge.id);
          const complete = isComplete(challenge);
          const Icon = challenge.icon;
          
          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-3 rounded-xl border-2 transition-all ${
                complete 
                  ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300')
                  : (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  complete ? 'bg-emerald-500' : (isDark ? 'bg-white/10' : 'bg-slate-200')
                }`}>
                  {complete ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-sm font-medium ${complete ? (isDark ? 'text-emerald-300 line-through' : 'text-emerald-800 line-through') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                      {challenge.title}
                    </p>
                    <span className={`text-xs font-bold ${complete ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      +{challenge.xp} XP
                    </span>
                  </div>
                  
                  {!complete && (
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${(progress / challenge.target) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{progress}/{challenge.target}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}