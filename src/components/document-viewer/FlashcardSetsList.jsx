import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Play, ChevronRight, RotateCcw, Copy, Layers, Lock, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const FREE_FLASHCARD_REVIEW_LIMIT = 5;

export default function FlashcardSetsList({ cards, onSelectSet, onGenerateNew }) {
  const { isDark } = useTheme();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const isFree = !isPro();
  
  // Group cards by generation batch (cards created within 2 min of each other = 1 set)
  const sorted = [...cards].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const sets = [];
  let currentSet = null;
  
  sorted.forEach((card) => {
    const cardTime = new Date(card.created_date).getTime();
    
    if (!currentSet || cardTime - currentSet.lastTime > 120000) {
      const setNum = sets.length + 1;
      const topicLabel = card.topics?.[0] || null;
      currentSet = { 
        label: topicLabel || `Set ${setNum}`,
        cardIds: [],
        cards: [], 
        mastered: 0, 
        lastTime: cardTime,
        createdDate: card.created_date
      };
      sets.push(currentSet);
    }
    
    currentSet.lastTime = cardTime;
    currentSet.cards.push(card);
    currentSet.cardIds.push(card.id);
    if (card.mastered) currentSet.mastered++;
  });
  
  // Reverse so newest set is first
  sets.reverse();

  const totalMastered = cards.filter(c => c.mastered).length;

  return (
    <div className={`px-3 md:px-4 py-4 w-full max-w-full mx-auto space-y-4 pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden', maxWidth: '100vw' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Copy className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className={`text-base md:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Flashcard Sets</h2>
          <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {totalMastered} / {cards.length} mastered
          </p>
        </div>
      </div>

      {/* Sets Grid */}
      <div className="space-y-2 w-full max-w-full" style={{ boxSizing: 'border-box' }}>
        {sets.map((set, idx) => {
          const isCompleted = set.mastered === set.cards.length && set.cards.length > 0;
          const progress = set.cards.length > 0 ? (set.mastered / set.cards.length) * 100 : 0;
          const hasLockedCards = isFree && set.cards.length > FREE_FLASHCARD_REVIEW_LIMIT;
          const lockedCount = hasLockedCards ? set.cards.length - FREE_FLASHCARD_REVIEW_LIMIT : 0;
          
          return (
            <motion.button
              key={`set-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectSet(set.cardIds)}
              className={`group relative w-full overflow-hidden p-3 md:p-4 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                isCompleted
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                  : (isDark ? 'bg-white/5 border border-amber-500/30 hover:border-amber-500/50' : 'bg-white border border-amber-200 hover:border-amber-300')
              }`}
            >
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-white/20' : (isDark ? 'bg-amber-600/20' : 'bg-amber-50')
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Layers className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-white' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                      {set.label} ({set.cards.length} cards)
                    </h3>
                    {hasLockedCards && (
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                        <Lock className="w-2.5 h-2.5" />
                        {lockedCount} locked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[100px] ${isCompleted ? 'bg-white/30' : (isDark ? 'bg-white/10' : 'bg-amber-100')}`}>
                      <div 
                        className={`h-full rounded-full ${isCompleted ? 'bg-white' : 'bg-amber-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${isCompleted ? 'text-white/80' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      {set.mastered}/{set.cards.length} mastered
                    </span>
                  </div>
                </div>
                
                {isCompleted ? (
                  <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isDark ? 'bg-amber-600/20 group-hover:bg-amber-600/30' : 'bg-amber-100 group-hover:bg-amber-200'}`}>
                    <Play className={`w-3 h-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Generate New — primary CTA */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
        <Button
          onClick={onGenerateNew}
          className="w-full h-14 rounded-2xl font-bold text-base shadow-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
        >
          <Zap className="w-5 h-5 mr-2" />
          Create a New Flashcard Set
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
        <p className={`text-center text-[11px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Pick topics, difficulty, and number of cards
        </p>
      </motion.div>
    </div>
  );
}