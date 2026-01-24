import React from "react";
import { Button } from "@/components/ui/button";
import { Layers, CheckCircle2, Play, ChevronRight, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function FlashcardSetsList({ cards, onSelectSet, onGenerateNew }) {
  // Group cards by topic
  const setMap = new Map();
  cards.forEach((card, idx) => {
    const topic = card.topics?.[0] || 'General';
    if (!setMap.has(topic)) {
      setMap.set(topic, { topic, cards: [], mastered: 0, firstIndex: idx });
    }
    const set = setMap.get(topic);
    set.cards.push({ ...card, globalIndex: idx });
    if (card.mastered) set.mastered++;
  });
  const sets = Array.from(setMap.values());

  const totalMastered = cards.filter(c => c.mastered).length;

  return (
    <div className="px-3 md:px-6 py-4 w-full max-w-[320px] md:max-w-2xl lg:max-w-3xl mx-auto space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-black text-slate-900">Flashcard Sets</h2>
          <p className="text-[10px] md:text-xs text-slate-500">
            {totalMastered} / {cards.length} mastered
          </p>
        </div>
      </div>

      {/* Sets Grid */}
      <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
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
                  : 'bg-white border border-amber-200 hover:border-amber-300'
              }`}
            >
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-white/20' : 'bg-amber-50'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Layers className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm truncate ${isCompleted ? 'text-white' : 'text-slate-900'}`}>
                    {set.topic}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[100px] ${isCompleted ? 'bg-white/30' : 'bg-amber-100'}`}>
                      <div 
                        className={`h-full rounded-full ${isCompleted ? 'bg-white' : 'bg-amber-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-medium ${isCompleted ? 'text-white/80' : 'text-slate-500'}`}>
                      {set.mastered}/{set.cards.length}
                    </span>
                  </div>
                </div>
                
                {isCompleted ? (
                  <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                    <Play className="w-3 h-3 text-amber-600" />
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
        className="w-full mt-4 border-2 border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Generate New Set
      </Button>
    </div>
  );
}