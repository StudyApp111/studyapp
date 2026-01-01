import React from "react";
import { motion } from "framer-motion";
import { Target, Zap, CheckCircle2, Clock, BookOpen, Brain } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const DAILY_CHALLENGES = [
  { id: 'study_10', title: 'Study for 10 minutes', xp: 15, icon: Clock, target: 10 },
  { id: 'answer_5', title: 'Answer 5 questions', xp: 20, icon: Brain, target: 5 },
  { id: 'flashcard_10', title: 'Review 10 flashcards', xp: 15, icon: BookOpen, target: 10 },
];

export default function DailyChallenge({ 
  studyMinutes = 0, 
  questionsAnswered = 0, 
  flashcardsReviewed = 0,
  onChallengeComplete 
}) {
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

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Daily Challenges</p>
            <p className="text-xs text-slate-500">{completedCount}/{DAILY_CHALLENGES.length} completed</p>
          </div>
        </div>
        <div className="bg-emerald-100 px-3 py-1 rounded-full">
          <span className="text-xs font-bold text-emerald-700">
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
                  ? 'bg-emerald-50 border-emerald-300' 
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  complete ? 'bg-emerald-500' : 'bg-slate-200'
                }`}>
                  {complete ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-sm font-medium ${complete ? 'text-emerald-800 line-through' : 'text-slate-700'}`}>
                      {challenge.title}
                    </p>
                    <span className={`text-xs font-bold ${complete ? 'text-emerald-600' : 'text-slate-500'}`}>
                      +{challenge.xp} XP
                    </span>
                  </div>
                  
                  {!complete && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${(progress / challenge.target) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{progress}/{challenge.target}</span>
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