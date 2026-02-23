import React from "react";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, Play, ChevronRight, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function TeachItSetsList({ cards, onSelectCard, onGenerateNew }) {
  const { isDark } = useTheme();
  const totalMastered = cards.filter(c => c.mastered).length;

  // Group cards by generation batch (cards created within 2 min of each other = 1 set)
  const sorted = [...cards].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const sets = [];
  let currentSet = null;
  
  sorted.forEach((card) => {
    const cardTime = new Date(card.created_date).getTime();
    const globalIndex = cards.findIndex(c => c.id === card.id);
    
    if (!currentSet || cardTime - currentSet.lastTime > 120000) {
      const setNum = sets.length + 1;
      currentSet = { 
        label: `Set ${setNum}`, 
        cards: [], 
        mastered: 0,
        completed: 0,
        firstIndex: -1,
        lastTime: cardTime
      };
      sets.push(currentSet);
    }
    
    currentSet.lastTime = cardTime;
    currentSet.cards.push({ ...card, globalIndex });
    if (card.mastered) currentSet.mastered++;
    if (card.completed) currentSet.completed++;
  });

  // Set firstIndex to the first card's position in the original array
  sets.forEach(set => {
    if (set.cards.length > 0) {
      set.firstIndex = set.cards[0].globalIndex;
    }
  });
  
  sets.reverse();

  return (
    <div className={`px-3 md:px-4 py-4 w-full max-w-full mx-auto space-y-4 pb-8 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden', maxWidth: '100vw' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className={`text-base md:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Feynman Cards</h2>
          <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {totalMastered} / {cards.length} mastered
          </p>
        </div>
      </div>

      {/* Sets Grid */}
      <div className="space-y-2 w-full max-w-full">
        {sets.map((set, idx) => {
          const allMastered = set.mastered === set.cards.length && set.cards.length > 0;
          const allCompleted = set.completed === set.cards.length && set.cards.length > 0;
          const progress = set.cards.length > 0 ? (set.mastered / set.cards.length) * 100 : 0;
          
          return (
            <motion.button
              key={`set-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectCard(set.firstIndex)}
              className={`group relative w-full overflow-hidden p-3 md:p-4 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                allMastered
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600'
                  : allCompleted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : (isDark ? 'bg-white/5 border border-purple-500/30 hover:border-purple-500/50' : 'bg-white border border-purple-200 hover:border-purple-300')
              }`}
            >
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  allMastered || allCompleted ? 'bg-white/20' : (isDark ? 'bg-purple-600/20' : 'bg-purple-50')
                }`}>
                  {allMastered ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Brain className={`w-5 h-5 ${allCompleted ? 'text-white' : (isDark ? 'text-purple-400' : 'text-purple-600')}`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm truncate ${allMastered || allCompleted ? 'text-white' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                    {set.label} ({set.cards.length} cards)
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[100px] ${allMastered || allCompleted ? 'bg-white/30' : (isDark ? 'bg-white/10' : 'bg-purple-100')}`}>
                      <div 
                        className={`h-full rounded-full ${allMastered || allCompleted ? 'bg-white' : 'bg-purple-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${allMastered || allCompleted ? 'text-white/80' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      {set.mastered}/{set.cards.length} mastered
                    </span>
                  </div>
                </div>
                
                {allMastered || allCompleted ? (
                  <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isDark ? 'bg-purple-600/20 group-hover:bg-purple-600/30' : 'bg-purple-100 group-hover:bg-purple-200'}`}>
                    <Play className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Generate New */}
      <Button
        variant="outline"
        onClick={onGenerateNew}
        className={`w-full mt-4 border-2 border-dashed ${isDark ? 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-600/10 text-purple-400' : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'}`}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Generate New Cards
      </Button>
    </div>
  );
}