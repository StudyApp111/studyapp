import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RotateCcw, Shuffle, ChevronLeft, ChevronRight, HelpCircle, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import XPGainToast from "@/components/gamification/XPGainToast";

export default function FlashcardsTab({ lesson, extractedContent }) {
  const [cards, setCards] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [streakCount, setStreakCount] = useState(0);

  useEffect(() => {
    loadFlashcards();
  }, [lesson?.id]);

  const loadFlashcards = async () => {
    if (!lesson) return;
    try {
      const existingCards = await base44.entities.Flashcard.filter({ lesson_id: lesson.id });
      if (existingCards.length > 0) {
        setCards(existingCards);
      }
    } catch (error) {
      console.error("Error loading flashcards:", error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 20 high-quality flashcards for this course: ${lesson.course_name}

Content: ${extractedContent || lesson.description || 'General course material'}

Create flashcards that:
1. Cover key concepts, definitions, and important facts
2. Are clear and concise
3. Have a question/front side and detailed answer/back side
4. Include topic tags for categorization
5. Vary in difficulty (mark as easy/medium/hard)`,
        response_json_schema: {
          type: "object",
          properties: {
            flashcards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  topics: { type: "array", items: { type: "string" } },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                }
              }
            }
          }
        }
      });

      const generatedCards = response.flashcards || [];
      const savedCards = await Promise.all(
        generatedCards.map(card => 
          base44.entities.Flashcard.create({
            lesson_id: lesson.id,
            question: card.question,
            answer: card.answer,
            topics: card.topics,
            difficulty: card.difficulty,
            status: "new",
            mastery_level: 0
          })
        )
      );
      setCards(savedCards);
    } catch (error) {
      console.error("Error generating flashcards:", error);
    }
    setIsGenerating(false);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const awardXP = async (amount, reason) => {
    try {
      const user = await base44.auth.me();
      await base44.auth.updateMe({
        daily_xp: (user.daily_xp || 0) + amount,
        total_points: (user.total_points || 0) + amount,
        total_flashcards_mastered: (user.total_flashcards_mastered || 0) + 1
      });
      setXpToast({ show: true, xp: amount, reason });
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleRating = async (knew) => {
    const currentCard = cards[currentIndex];
    
    // Update mastery based on whether they knew it
    const newMastery = knew 
      ? Math.min((currentCard.mastery_level || 0) + 1, 5)
      : Math.max((currentCard.mastery_level || 0) - 1, 0);
    
    const newStatus = newMastery >= 4 ? 'mastered' : newMastery >= 2 ? 'learning' : 'new';
    
    // Update streak and award XP
    if (knew) {
      const newStreak = streakCount + 1;
      setStreakCount(newStreak);
      
      // Award XP based on streak
      let xpAmount = 2; // Base XP per correct card
      let reason = 'Flashcard correct!';
      
      if (newStreak >= 5 && newStreak % 5 === 0) {
        xpAmount = 10;
        reason = `${newStreak} card streak! 🔥`;
      } else if (newMastery === 4) {
        xpAmount = 5;
        reason = 'Card mastered! ⭐';
      }
      
      awardXP(xpAmount, reason);
    } else {
      setStreakCount(0);
    }

    try {
      await base44.entities.Flashcard.update(currentCard.id, {
        status: newStatus,
        mastery_level: newMastery,
        last_reviewed: new Date().toISOString()
      });

      const updatedCards = [...cards];
      updatedCards[currentIndex] = { ...currentCard, status: newStatus, mastery_level: newMastery };
      setCards(updatedCards);
      
      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        correct: knew ? prev.correct + 1 : prev.correct
      }));
    } catch (error) {
      console.error("Error updating flashcard:", error);
    }

    // Move to next card
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex(0);
      }
    }, 200);
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => prev > 0 ? prev - 1 : cards.length - 1);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => prev < cards.length - 1 ? prev + 1 : 0);
  };

  const handleRegenerate = async () => {
    // Delete existing cards
    if (cards && cards.length > 0) {
      await Promise.all(cards.map(c => base44.entities.Flashcard.delete(c.id)));
    }
    setCards(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionStats({ reviewed: 0, correct: 0 });
  };



  // Initial state - not generated
  if (!cards && !isGenerating) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl mx-2 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">AI-Powered Flashcards</h3>
            <p className="text-sm text-slate-600 mb-1">
              Generate smart flashcards from your notes.
            </p>
            <p className="text-xs text-slate-500">
              Think of the answer, then reveal to check yourself!
            </p>
          </div>
          
          {/* XP incentive */}
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-3 border border-yellow-200">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-800">
                Earn <span className="font-bold">+2-10 XP</span> per card mastered!
              </span>
            </div>
          </div>
          
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Flashcards
          </Button>
        </div>
      </Card>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl mx-2 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Generating Flashcards...</h3>
            <p className="text-sm text-slate-600">
              Creating intelligent flashcards from your course content.
            </p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        </div>
      </Card>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl mx-2 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">AI-Powered Flashcards</h3>
            <p className="text-sm text-slate-600">
              Generate intelligent flashcards from your notes.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Flashcards
          </Button>
        </div>
      </Card>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const masteredCount = cards.filter(c => c.mastery_level >= 4).length;

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy": return "bg-emerald-100 text-emerald-700";
      case "hard": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  const getMasteryColor = (level) => {
    if (level >= 4) return "bg-emerald-500";
    if (level >= 2) return "bg-amber-500";
    return "bg-slate-300";
  };

  return (
    <div className="space-y-3 px-2">
      {/* How to use modal */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowHowTo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">How to Use Flashcards</h3>
                <button onClick={() => setShowHowTo(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Read the question</p>
                    <p className="text-xs text-slate-500">Think about the answer in your head or say it out loud</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Tap to reveal</p>
                    <p className="text-xs text-slate-500">Click anywhere on the card to flip and see the answer</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Rate yourself honestly</p>
                    <p className="text-xs text-slate-500">Did you know it? This helps the app show you cards you need to practice more</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
                  <p className="text-xs text-amber-800">
                    <strong>💡 Tip:</strong> Don't type answers! Active recall (thinking before revealing) is proven to be more effective for memory.
                  </p>
                </div>
              </div>
              
              <Button onClick={() => setShowHowTo(false)} className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                Got it!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with help button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {currentIndex + 1} / {cards.length}
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-emerald-600 font-medium">
            {masteredCount} mastered
          </span>
        </div>
        <button
          onClick={() => setShowHowTo(true)}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          How to use
        </button>
      </div>

      <Progress value={progress} className="h-1.5" />

      {/* Session stats - always show */}
      <div className="flex justify-center items-center gap-3 text-xs">
        <span className="text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
          Session: <span className="font-semibold text-slate-700">{sessionStats.correct}/{sessionStats.reviewed}</span>
        </span>
        {streakCount >= 2 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-bold flex items-center gap-1"
          >
            🔥 {streakCount} streak!
          </motion.span>
        )}
        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-medium">
          +{sessionStats.correct * 2} XP
        </span>
      </div>

      {/* Flashcard */}
      <div 
        onClick={handleFlip}
        className="cursor-pointer select-none"
      >
        <Card className="border-0 shadow-xl overflow-hidden min-h-[280px] relative">
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              <motion.div
                key="question"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {/* Question side */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="font-semibold text-sm text-white">Question</span>
                  </div>
                  <Badge className={`${getDifficultyColor(currentCard.difficulty)} text-[10px]`}>
                    {currentCard.difficulty}
                  </Badge>
                </div>
                <div className="p-6 flex flex-col items-center justify-center min-h-[220px] bg-white">
                  <p className="text-slate-900 text-base font-medium leading-relaxed text-center mb-6">
                    {currentCard.question}
                  </p>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Think of the answer, then...</p>
                    <p className="text-sm text-purple-600 font-semibold">Tap to reveal →</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="answer"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {/* Answer side */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">Answer</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/80">Mastery:</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <div 
                          key={i} 
                          className={`w-2 h-2 rounded-full ${i <= (currentCard.mastery_level || 0) ? getMasteryColor(currentCard.mastery_level) : 'bg-white/30'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 flex flex-col min-h-[220px] bg-white">
                  <p className="text-slate-900 text-sm leading-relaxed text-center flex-1 flex items-center justify-center">
                    {currentCard.answer}
                  </p>
                  
                  {/* Rating section */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-center text-slate-500 mb-3">Did you know the answer?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRating(false); }}
                        className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl py-3 px-4 shadow-lg transition-all active:scale-95"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg">❌</span>
                          <div className="text-left">
                            <div className="font-bold text-sm">Nope</div>
                            <div className="text-[10px] opacity-90">Show more often</div>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRating(true); }}
                        className="bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl py-3 px-4 shadow-lg transition-all active:scale-95"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg">✅</span>
                          <div className="text-left">
                            <div className="font-bold text-sm">Got it!</div>
                            <div className="text-[10px] opacity-90">Show less often</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShuffle}
            className="text-xs h-8"
          >
            <Shuffle className="w-3 h-3 mr-1" />
            Shuffle
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRegenerate}
            className="text-xs h-8"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            New Cards
          </Button>
        </div>
        
        <button
          onClick={handleNext}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* XP Toast */}
      <XPGainToast 
        xpGained={xpToast.xp}
        reason={xpToast.reason}
        show={xpToast.show}
        onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })}
      />
    </div>
  );
}