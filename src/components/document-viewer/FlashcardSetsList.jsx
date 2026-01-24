import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, ChevronRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function FlashcardSetsList({ lessonId, onSelectSet, onGenerateNew }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lessonId) loadSets();
  }, [lessonId]);

  const loadSets = async () => {
    try {
      const cards = await base44.entities.Flashcard.filter({ lesson_id: lessonId });
      
      // Group cards by topics (first topic as set identifier)
      const setMap = new Map();
      cards.forEach(card => {
        const topic = card.topics?.[0] || 'General';
        if (!setMap.has(topic)) {
          setMap.set(topic, { topic, cards: [], mastered: 0, total: 0 });
        }
        const set = setMap.get(topic);
        set.cards.push(card);
        set.total++;
        if (card.mastered) set.mastered++;
      });
      
      setSets(Array.from(setMap.values()));
    } catch (error) {
      console.error("Error loading flashcard sets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (sets.length === 0) {
    return null; // Parent will show generate button
  }

  return (
    <div className="space-y-3 px-3 pb-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Your Flashcard Sets</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateNew}
          className="text-xs h-7 gap-1"
        >
          <Sparkles className="w-3 h-3" />
          New Set
        </Button>
      </div>
      
      <div className="space-y-2">
        {sets.map((set, idx) => {
          const progress = set.total > 0 ? (set.mastered / set.total) * 100 : 0;
          const isComplete = progress === 100;
          
          return (
            <motion.button
              key={set.topic}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectSet(set)}
              className="w-full text-left"
            >
              <Card className={`p-3 transition-all hover:shadow-md ${
                isComplete 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-white border-slate-200 hover:border-purple-300'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isComplete 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-br from-amber-500 to-orange-600'
                  }`}>
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Layers className="w-5 h-5 text-white" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${
                      isComplete ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {set.topic}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {set.mastered}/{set.total}
                      </span>
                    </div>
                  </div>
                  
                  <ChevronRight className={`w-4 h-4 ${
                    isComplete ? 'text-emerald-400' : 'text-slate-400'
                  }`} />
                </div>
              </Card>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}