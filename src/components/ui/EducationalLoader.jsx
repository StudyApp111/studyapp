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
          
          // Get recently shown facts from localStorage
          const recentFactsStr = localStorage.getItem('recentEducationalFacts');
          const recentFacts = recentFactsStr ? JSON.parse(recentFactsStr) : [];
          
          // Filter out facts shown in the last 15 minutes
          const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
          const validRecentFacts = recentFacts.filter(rf => rf.timestamp > fifteenMinutesAgo);
          const recentFactIds = new Set(validRecentFacts.map(rf => rf.id));
          
          // Get available facts (not recently shown)
          const availableFacts = facts.filter(f => !recentFactIds.has(f.id));
          const factsToUse = availableFacts.length > 0 ? availableFacts : facts;
          
          // Set initial random fact
          const randomIndex = Math.floor(Math.random() * factsToUse.length);
          const selectedFact = factsToUse[randomIndex];
          setCurrentFact(selectedFact);
          setShownFactIds(new Set([selectedFact.id]));
          
          // Update localStorage with this fact
          const updatedRecent = [...validRecentFacts, { id: selectedFact.id, timestamp: Date.now() }];
          localStorage.setItem('recentEducationalFacts', JSON.stringify(updatedRecent));
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
      // Get recently shown facts from localStorage
      const recentFactsStr = localStorage.getItem('recentEducationalFacts');
      const recentFacts = recentFactsStr ? JSON.parse(recentFactsStr) : [];
      
      // Filter out facts shown in the last 15 minutes
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
      const validRecentFacts = recentFacts.filter(rf => rf.timestamp > fifteenMinutesAgo);
      const recentFactIds = new Set(validRecentFacts.map(rf => rf.id));
      
      // Get unshown facts (not in current session AND not recently shown)
      const availableFacts = allFacts.filter(fact => !shownFactIds.has(fact.id) && !recentFactIds.has(fact.id));
      
      let selectedFact;
      // If all facts shown in session, reset session but still respect 15-min window
      if (availableFacts.length === 0) {
        const notRecentFacts = allFacts.filter(fact => !recentFactIds.has(fact.id));
        const factsToUse = notRecentFacts.length > 0 ? notRecentFacts : allFacts;
        setShownFactIds(new Set());
        selectedFact = factsToUse[Math.floor(Math.random() * factsToUse.length)];
        setCurrentFact(selectedFact);
        setShownFactIds(new Set([selectedFact.id]));
      } else {
        // Pick from available facts
        selectedFact = availableFacts[Math.floor(Math.random() * availableFacts.length)];
        setCurrentFact(selectedFact);
        setShownFactIds(prev => new Set([...prev, selectedFact.id]));
      }
      
      // Update localStorage with this fact
      const updatedRecent = [...validRecentFacts, { id: selectedFact.id, timestamp: Date.now() }];
      localStorage.setItem('recentEducationalFacts', JSON.stringify(updatedRecent));
    }, 8500);

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
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center p-6 shadow-2xl border-0 bg-white/90 backdrop-blur-xl">
        <div className="mb-6 relative flex justify-center items-center">
          <div className="absolute w-16 h-16 bg-purple-100 rounded-full scale-150 opacity-20 animate-pulse" />
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin relative z-10" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {description}
        </p>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-6" />

        <div className="min-h-[140px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFact.fact_text || currentFact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="text-3xl mb-2">
                {currentFact.icon || "💡"}
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2 py-1 rounded-md">
                  Did You Know? • {currentFact.category || "Fun Fact"}
                </span>
                <p className="text-base font-medium text-slate-800 leading-relaxed">
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