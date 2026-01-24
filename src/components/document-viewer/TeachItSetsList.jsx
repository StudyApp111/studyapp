import React from "react";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, Play, ChevronRight, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function TeachItSetsList({ cards, onSelectCard, onGenerateNew }) {
  const totalMastered = cards.filter(c => c.mastered).length;

  return (
    <div className="px-3 md:px-6 py-4 w-full max-w-[320px] md:max-w-2xl lg:max-w-3xl mx-auto space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-black text-slate-900">Teach It Cards</h2>
          <p className="text-[10px] md:text-xs text-slate-500">
            {totalMastered} / {cards.length} mastered
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {cards.map((card, idx) => {
          const isCompleted = card.completed;
          const isMastered = card.mastered;
          const score = card.score;
          
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectCard(idx)}
              className={`group relative w-full overflow-hidden p-3 md:p-4 rounded-xl transition-all text-left shadow-sm hover:shadow-md ${
                isMastered
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600'
                  : isCompleted
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-white border border-purple-200 hover:border-purple-300'
              }`}
            >
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isMastered || isCompleted ? 'bg-white/20' : 'bg-purple-50'
                }`}>
                  {isMastered ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : isCompleted ? (
                    <span className="text-white font-bold text-sm">{score}%</span>
                  ) : (
                    <Brain className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm line-clamp-2 leading-tight ${isMastered || isCompleted ? 'text-white' : 'text-slate-900'}`}>
                    {card.question}
                  </h3>
                  <p className={`text-[10px] mt-1 ${isMastered || isCompleted ? 'text-white/70' : 'text-slate-500'}`}>
                    {isMastered ? 'Mastered ✓' : isCompleted ? `Score: ${score}/100` : 'Not attempted'}
                  </p>
                </div>
                
                {isMastered || isCompleted ? (
                  <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                    <Play className="w-3 h-3 text-purple-600" />
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
        className="w-full mt-4 border-2 border-dashed border-purple-300 hover:border-purple-400 hover:bg-purple-50"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Generate New Cards
      </Button>
    </div>
  );
}