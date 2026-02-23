import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Play, ChevronRight, RotateCcw, Copy, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function FlashcardSetsList({ cards, onSelectSet, onGenerateNew }) {
  const { isDark } = useTheme();
  
  // Group cards by generation batch (cards created within 2 min of each other = 1 set)
  const sorted = [...cards].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const sets = [];
  let currentSet = null;
  
  sorted.forEach((card) => {
    const cardTime = new Date(card.created_date).getTime();
    const globalIndex = cards.findIndex(c => c.id === card.id);
    
    if (!currentSet || cardTime - currentSet.lastTime > 120000) {
      // New batch — start a new set
      const setNum = sets.length + 1;
      currentSet = { 
        label: `Set ${setNum}`, 
        cards: [], 
        mastered: 0, 
        firstIndex: globalIndex,
        lastTime: cardTime,
        createdDate: card.created_date
      };
      sets.push(currentSet);
    }
    
    currentSet.lastTime = cardTime;
    currentSet.cards.push({ ...card, globalIndex });
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
          const isCompleted = set.mastered === set.cards.length;
          const progress = (set.mastered / set.cards.length) * 100;
          
          return (
            <motion.button
              key={set.topic}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectSet(set.firstIndex)}
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
                  <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-white' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                    {set.topic}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[100px] ${isCompleted ? 'bg-white/30' : (isDark ? 'bg-white/10' : 'bg-amber-100')}`}>
                      <div 
                        className={`h-full rounded-full ${isCompleted ? 'bg-white' : 'bg-amber-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${isCompleted ? 'text-white/80' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      {set.mastered}/{set.cards.length}
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

      {/* Generate New */}
      <Button
        variant="outline"
        onClick={onGenerateNew}
        className={`w-full mt-4 border-2 border-dashed ${isDark ? 'border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-600/10 text-amber-400' : 'border-amber-300 hover:border-amber-400 hover:bg-amber-50'}`}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Generate New Set
      </Button>
    </div>
  );
}