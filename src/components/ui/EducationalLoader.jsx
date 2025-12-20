import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EducationalLoader({ title = "Creating Your Lesson", description = "Our AI is analyzing the curriculum and generating personalized content...", grade }) {
  const [currentFact, setCurrentFact] = useState(null);
  const [allFacts, setAllFacts] = useState([]);
  const [shownFactIds, setShownFactIds] = useState(new Set());

  useEffect(() => {
    // Load educational facts from the database
    const loadFacts = async () => {
      try {
        const facts = await base44.entities.EducationalFact.list();
        if (facts && facts.length > 0) {
          setAllFacts(facts);
          
          // Set initial random fact
          const randomIndex = Math.floor(Math.random() * facts.length);
          setCurrentFact(facts[randomIndex]);
          setShownFactIds(new Set([facts[randomIndex].id]));
        }
      } catch (error) {
        console.error("Error loading educational facts:", error);
        // Fallback to a default fact if database load fails
        setAllFacts([{
          id: 'fallback',
          fact_text: "Our AI is analyzing your content to create personalized learning materials...",
          category: "Processing",
          icon: "⏳"
        }]);
        setCurrentFact({
          id: 'fallback',
          fact_text: "Our AI is analyzing your content to create personalized learning materials...",
          category: "Processing",
          icon: "⏳"
        });
      }
    };
    
    loadFacts();
  }, []);

  useEffect(() => {
    if (allFacts.length === 0) return;
    
    const timer = setInterval(() => {
      // Get unshown facts
      const availableFacts = allFacts.filter(fact => !shownFactIds.has(fact.id));
      
      // If all facts shown, reset
      if (availableFacts.length === 0) {
        setShownFactIds(new Set());
        const randomFact = allFacts[Math.floor(Math.random() * allFacts.length)];
        setCurrentFact(randomFact);
        setShownFactIds(new Set([randomFact.id]));
      } else {
        // Pick from unshown facts
        const randomFact = availableFacts[Math.floor(Math.random() * availableFacts.length)];
        setCurrentFact(randomFact);
        setShownFactIds(prev => new Set([...prev, randomFact.id]));
      }
    }, 6500);

    return () => clearInterval(timer);
  }, [allFacts, shownFactIds]);

  if (!currentFact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-lg text-center p-8 md:p-10 shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
          <div className="mb-8 relative flex justify-center items-center">
            <div className="absolute w-20 h-20 bg-purple-100 rounded-full scale-150 opacity-20 animate-pulse" />
            <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-purple-600 animate-spin relative z-10" />
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {title}
          </h2>
          <p className="text-slate-500 mb-8">
            {description}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-lg text-center p-8 md:p-10 shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
        <div className="mb-8 relative flex justify-center items-center">
          <div className="absolute w-20 h-20 bg-purple-100 rounded-full scale-150 opacity-20 animate-pulse" />
          <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-purple-600 animate-spin relative z-10" />
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
          {title}
        </h2>
        <p className="text-slate-500 mb-8">
          {description}
        </p>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-8" />

        <div className="min-h-[180px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFact.fact_text || currentFact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="text-4xl">
                {currentFact.icon || "💡"}
              </div>
              
              <div className="space-y-2">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-1 rounded-md">
                  Did You Know? • {currentFact.category || "Fun Fact"}
                </span>
                <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed max-w-sm">
                  {currentFact.fact_text}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}