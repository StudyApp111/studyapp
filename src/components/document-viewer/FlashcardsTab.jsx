import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RotateCcw, Shuffle, ChevronLeft, ChevronRight, HelpCircle, X, Zap, Play, Copy, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import XPGainToast from "@/components/gamification/XPGainToast";
import AskAIButton from "@/components/ai-tutor/AskAIButton";
import { recordDailyActivity, awardDailyXP } from "@/components/utils/dailyReset";
import FlashcardSetsList from "./FlashcardSetsList";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import MathText from "@/components/math/MathText";
import CustomizeGenerationModal from "@/components/modals/CustomizeGenerationModal";

// Sound effects removed per user request

export default function FlashcardsTab({ lesson, extractedContent, focusTopics }) {
  const { canDoTask, incrementTaskCount, triggerUpgradeModal } = useSubscription();
  const { isDark } = useTheme();
  const [cards, setCards] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [sessionStats, setSessionStats] = useState({ total: 0, bad: 0, okay: 0, good: 0, excellent: 0 });
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [studyPlanTopics, setStudyPlanTopics] = useState(null);
  const [showSetsList, setShowSetsList] = useState(true);
  // Celebration modal removed - was blocking UI
  const [lastRating, setLastRating] = useState(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [currentSetStart, setCurrentSetStart] = useState(0);
  const [currentSetEnd, setCurrentSetEnd] = useState(0);

  const isGeneratingRef = useRef(false);
  const pendingStudyTaskRef = useRef(null);

  useEffect(() => {
    if (lesson?.id) {
      loadFlashcards();
    }
  }, [lesson?.id]);

  useEffect(() => {
    const handleStudyTask = async (e) => {
      if (e.detail.taskType === 'flashcards') {
        if (isGeneratingRef.current) {
          console.log('🎯 Flashcard event already generating, skipping');
          return;
        }
        
        console.log('🎯 Received flashcard generation request from study plan');
        pendingStudyTaskRef.current = e.detail.task;
        
        // Always generate new set when coming from study plan (don't skip)
        if (!isGeneratingRef.current) {
          handleGenerate();
        }
      }
    };
    
    window.addEventListener('generateFromStudyTask', handleStudyTask);
    return () => window.removeEventListener('generateFromStudyTask', handleStudyTask);
  }, [lesson?.id, cards]);
  
  const loadStudyPlanTopics = async () => {
    if (!lesson?.id) return;
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lesson.id,
        status: 'active'
      });
      if (plans.length > 0) {
        const flashcardTask = plans[0].tasks?.find(t => t.task_type === 'flashcards' && !t.completed);
        if (flashcardTask?.focus_topics?.length > 0) {
          setStudyPlanTopics(flashcardTask.focus_topics);
        }
      }
    } catch (error) {
      console.error("Error loading study plan topics:", error);
    }
  };

  const loadFlashcards = async () => {
    if (!lesson) return;
    try {
      const existingCards = await base44.entities.Flashcard.filter({ lesson_id: lesson.id });
      if (existingCards.length > 0) {
        setCards(existingCards);
        setShowSetsList(true);
      }
    } catch (error) {
      console.error("Error loading flashcards:", error);
    }
  };

  const handleGenerate = async (customOptions = null) => {
    if (isGeneratingRef.current) return;
    
    const taskCheck = await canDoTask('flashcards');
    if (!taskCheck.allowed) {
      triggerUpgradeModal('tasks');
      return;
    }
    
    isGeneratingRef.current = true;
    setIsGenerating(true);
    await incrementTaskCount('flashcards');
    
    try {
      let contentForFlashcards = lesson.compressed_content || extractedContent || lesson.description || 'General course material';
      if (contentForFlashcards.length > 50000) {
        contentForFlashcards = contentForFlashcards.substring(0, 50000) + "\n...[content truncated]";
      }
      
      const studyTaskTopics = pendingStudyTaskRef.current?.focus_topics;
      const topicsToFocus = customOptions?.topics?.length > 0 ? customOptions.topics : (studyTaskTopics || focusTopics || studyPlanTopics);
      
      const { data: response } = await base44.functions.invoke('generateFlashcards', {
        course_name: lesson.course_name,
        content: contentForFlashcards,
        focus_topics: topicsToFocus || [],
        amount: Math.min(customOptions?.amount || 10, 10),
        difficulty: customOptions?.difficulty || 'mixed',
        custom_instructions: customOptions?.custom_instructions || ''
      });

      const generatedCards = response?.flashcards || [];
      
      if (!Array.isArray(generatedCards) || generatedCards.length === 0) {
        console.error("No flashcards generated");
        setIsGenerating(false);
        return;
      }
      
      // Determine set label from study task or custom options
      const setLabel = pendingStudyTaskRef.current?.title || customOptions?.title || null;
      
      const savedCards = [];
      for (const card of generatedCards) {
        const saved = await base44.entities.Flashcard.create({
          lesson_id: lesson.id,
          question: card.question || "Question",
          answer: card.answer || "Answer",
          topics: setLabel ? [setLabel, ...(card.topics || [])] : (card.topics || []),
          difficulty: card.difficulty || "medium",
          status: "new",
          review_count: 0,
          ease_factor: 2.5,
          next_review: new Date().toISOString()
        });
        savedCards.push(saved);
      }
      // Reload all cards so sets list shows all sets including new one
      const allCards = await base44.entities.Flashcard.filter({ lesson_id: lesson.id });
      setCards(allCards);
      // Jump into the newly generated set
      const newFirstIndex = allCards.findIndex(c => c.id === savedCards[0]?.id);
      setCurrentIndex(newFirstIndex >= 0 ? newFirstIndex : 0);
      setShowSetsList(false); // Jump straight into review
      pendingStudyTaskRef.current = null;
    } catch (error) {
      console.error("Error generating flashcards:", error);
    }
    setIsGenerating(false);
    isGeneratingRef.current = false;
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const awardXP = async (amount, reason) => {
    try {
      const result = await awardDailyXP(amount, reason);
      if (result.success) {
        await recordDailyActivity('flashcards', 1);
        
        const user = await base44.auth.me();
        await base44.auth.updateMe({
          total_flashcards_mastered: (user.total_flashcards_mastered || 0) + 1
        });
        
        setXpToast({ show: true, xp: amount, reason });
      }
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleRating = async (rating) => {
    // rating: 'bad', 'okay', 'good', 'excellent'
    const currentCard = cards[currentIndex];
    setLastRating(rating);
    
    // Check subscription limit
    const wasReviewed = currentCard.review_count > 0;
    
    // Anki algorithm - adjust ease factor and calculate next review interval
    const currentEase = currentCard.ease_factor || 2.5;
    let newEase = currentEase;
    let intervalDays = 0;
    
    switch (rating) {
      case 'bad':
        // Reset card, reduce ease
        newEase = Math.max(1.3, currentEase - 0.2);
        intervalDays = 0; // Review again soon
        break;
      case 'okay':
        // Slight ease reduction, short interval
        newEase = Math.max(1.3, currentEase - 0.15);
        intervalDays = 1;
        break;
      case 'good':
        // Standard progression
        intervalDays = Math.round((currentCard.review_count || 0) + 1) * currentEase;
        break;
      case 'excellent':
        // Boost ease, longer interval
        newEase = currentEase + 0.15;
        intervalDays = Math.round(((currentCard.review_count || 0) + 1) * currentEase * 1.5);
        break;
    }
    
    const newReviewCount = (currentCard.review_count || 0) + 1;
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
    
    const newStatus = newReviewCount >= 1 ? 'learning' : 'new';
    const isMastered = rating === 'excellent' || rating === 'good';

    try {
      await base44.entities.Flashcard.update(currentCard.id, {
        status: newStatus,
        review_count: newReviewCount,
        ease_factor: newEase,
        next_review: nextReviewDate.toISOString(),
        last_reviewed: new Date().toISOString(),
        mastered: isMastered && newReviewCount >= 2
      });

      const updatedCards = [...cards];
      updatedCards[currentIndex] = { 
        ...currentCard, 
        status: newStatus, 
        review_count: newReviewCount,
        ease_factor: newEase,
        mastered: isMastered && newReviewCount >= 2
      };
      setCards(updatedCards);
      
      // Update session stats
      setSessionStats(prev => ({
        total: prev.total + 1,
        bad: prev.bad + (rating === 'bad' ? 1 : 0),
        okay: prev.okay + (rating === 'okay' ? 1 : 0),
        good: prev.good + (rating === 'good' ? 1 : 0),
        excellent: prev.excellent + (rating === 'excellent' ? 1 : 0)
      }));

      // Update study plan
      if (!wasReviewed) {
        const totalReviewed = updatedCards.filter(c => c.review_count > 0).length;
        const taskJustCompleted = await updateStudyPlanProgress('flashcards', totalReviewed);
        
        // Trigger Polly after flashcard task completion
        if (taskJustCompleted) {
          base44.functions.invoke('runPollyEngine', {
            trigger_event: 'flashcard_task_completed',
            lesson_id: lesson.id
          }).catch(err => console.warn('Polly trigger failed:', err.message));
        }
      }
      
      // Milestone celebrations removed - were blocking UI
    } catch (error) {
      console.error("Error updating flashcard:", error);
    }

    // Move to next card within the current set, or show completion
    setIsFlipped(false);
    setLastRating(null);
    setTimeout(() => {
      if (currentIndex < currentSetEnd) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Reached end of set — show session complete
        setSessionComplete(true);
      }
    }, 400);
  };

  const updateStudyPlanProgress = async (taskType, completedCount) => {
    try {
      const plans = await base44.entities.StudyPlan.filter({ 
        lesson_id: lesson.id,
        status: 'active'
      });
      if (plans.length === 0) return false;
      
      const plan = plans[0];
      let taskJustCompleted = false;
      
      const updatedTasks = plan.tasks.map(task => {
        if (task.task_type === taskType) {
          const newCount = completedCount;
          const wasComplete = task.completed;
          const targetCount = task.target_count || 10;
          const isComplete = newCount >= targetCount;
          
          if (isComplete && !wasComplete) {
            taskJustCompleted = true;
          }
          
          return {
            ...task,
            completed_count: newCount,
            completed: isComplete,
            completed_date: isComplete && !task.completed_date ? new Date().toISOString() : task.completed_date
          };
        }
        return task;
      });
      
      const allComplete = updatedTasks.every(t => t.completed);
      
      await base44.entities.StudyPlan.update(plan.id, {
        tasks: updatedTasks,
        all_tasks_completed: allComplete,
        official_exam_unlocked: allComplete
      });
      
      return taskJustCompleted;
    } catch (error) {
      console.error("Error updating study plan:", error);
      return false;
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setLastRating(null);
    setCurrentIndex(prev => prev > currentSetStart ? prev - 1 : currentSetEnd);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setLastRating(null);
    setCurrentIndex(prev => prev < currentSetEnd ? prev + 1 : currentSetStart);
  };

  const handleRegenerate = async () => {
    // Generate a new set without deleting existing sets
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionStats({ total: 0, bad: 0, okay: 0, good: 0, excellent: 0 });
    await handleGenerate();
  };

  // Reload cards from DB when returning to sets list to get fresh mastered status
  const handleBackToSets = async () => {
    setShowSetsList(true);
    setSessionComplete(false);
    if (lesson?.id) {
      const freshCards = await base44.entities.Flashcard.filter({ lesson_id: lesson.id });
      if (freshCards.length > 0) setCards(freshCards);
    }
  };

  // Determine current set boundaries — find all cards in the same generation batch
  const findSetBounds = (idx) => {
    if (!cards || cards.length === 0) return { start: 0, end: 0 };
    
    // Sort cards by created_date and group into sets (>2min gap = new set)
    const sorted = [...cards].map((c, i) => ({ ...c, origIdx: i })).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const sets = [];
    let currentSet = [];
    
    sorted.forEach((card, i) => {
      if (i === 0 || new Date(card.created_date).getTime() - new Date(sorted[i - 1].created_date).getTime() > 120000) {
        if (currentSet.length > 0) sets.push(currentSet);
        currentSet = [];
      }
      currentSet.push(card);
    });
    if (currentSet.length > 0) sets.push(currentSet);
    
    // Find which set contains the card at `idx`
    const targetSet = sets.find(set => set.some(c => c.origIdx === idx));
    if (!targetSet) return { start: idx, end: idx };
    
    // Return the min and max original indices within that set
    const origIndices = targetSet.map(c => c.origIdx);
    return { start: Math.min(...origIndices), end: Math.max(...origIndices) };
  };

  // Show list view when cards exist and showSetsList is true
  if (cards && cards.length > 0 && showSetsList) {
    return (
      <FlashcardSetsList 
        cards={cards}
        onSelectSet={(cardIds) => {
          // cardIds is the array of card IDs in this set
          // Find the indices in our cards array that match these IDs
          const idSet = new Set(cardIds);
          const indices = cards.map((c, i) => idSet.has(c.id) ? i : -1).filter(i => i >= 0);
          if (indices.length === 0) return;
          
          setCurrentIndex(indices[0]);
          setCurrentSetStart(indices[0]);
          setCurrentSetEnd(indices[indices.length - 1]);
          setIsFlipped(false);
          setShowSetsList(false);
          setSessionComplete(false);
          setSessionStats({ total: 0, bad: 0, okay: 0, good: 0, excellent: 0 });
        }}
        onGenerateNew={handleRegenerate}
      />
    );
  }

  // Initial state - not generated
  if (!cards && !isGenerating) {
    return (
      <div className={`flex items-center justify-center p-4 pb-8 w-full max-w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className={`backdrop-blur-xl border-2 shadow-2xl overflow-hidden ${isDark ? 'bg-[#12121a]/95 border-purple-500/30' : 'bg-white/95 border-purple-200'}`}>
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 px-5 py-6 text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Sparkles className="w-16 h-16 text-yellow-300 mx-auto mb-3 drop-shadow-lg" />
              </motion.div>
              <h3 className="text-xl font-black text-white mb-1">AI-Powered Flashcards</h3>
              <p className="text-purple-100 text-xs">
                Master concepts through active recall
              </p>
            </div>
            <div className="p-5 text-center w-full" style={{ boxSizing: 'border-box' }}>
              <p className={`mb-4 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Generate smart flashcards from your notes. Rate each card to optimize your learning!
              </p>
              
              <div className={`rounded-xl p-3 border mb-6 ${isDark ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30' : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'}`}>
                <div className="flex items-center justify-center gap-2">
                  <Zap className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  <span className={`text-xs font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                    Earn <span className="font-bold">+2-10 XP</span> per card mastered!
                  </span>
                </div>
              </div>
              
              <Button
                onClick={() => handleGenerate()}
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 text-white font-bold text-lg rounded-xl shadow-xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Flashcards
              </Button>
              <button
                onClick={() => setShowCustomize(true)}
                className={`w-full mt-2 text-sm font-medium py-2 rounded-lg transition-colors ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}
              >
                ⚙️ Customize (topics, difficulty, amount)
              </button>

              <CustomizeGenerationModal
                open={showCustomize}
                onOpenChange={setShowCustomize}
                type="flashcards"
                lessonId={lesson?.id}
                compressedContent={lesson?.compressed_content || extractedContent}
                onGenerate={(opts) => handleGenerate(opts)}
              />
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <Card className={`backdrop-blur-xl border shadow-xl mx-3 p-6 max-w-lg md:mx-auto mb-8 ${isDark ? 'bg-[#12121a]/90 border-purple-500/30' : 'bg-white/90 border-purple-200'}`}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Generating Flashcards...</h3>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
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
      <div className={`flex items-center justify-center p-4 pb-8 w-full max-w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden' }}>
        <Card className={`backdrop-blur-xl border-2 shadow-2xl overflow-hidden w-full max-w-md ${isDark ? 'bg-[#12121a]/95 border-purple-500/30' : 'bg-white/95 border-purple-200'}`}>
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 px-5 py-6 text-center">
            <Sparkles className="w-16 h-16 text-yellow-300 mx-auto mb-3 drop-shadow-lg" />
            <h3 className="text-xl font-black text-white mb-1">AI-Powered Flashcards</h3>
            <p className="text-purple-100 text-xs">Master concepts through active recall</p>
          </div>
          <div className="p-5 text-center">
            <p className={`mb-5 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Generate intelligent flashcards from your notes.
            </p>
            <Button
              onClick={() => handleGenerate()}
              className="w-full h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 text-white font-bold text-lg rounded-xl shadow-xl"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Flashcards
            </Button>
            <button
              onClick={() => setShowCustomize(true)}
              className={`w-full mt-2 text-sm font-medium py-2 rounded-lg transition-colors ${isDark ? 'text-purple-400 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}
            >
              ⚙️ Customize (topics, difficulty, amount)
            </button>

            <CustomizeGenerationModal
              open={showCustomize}
              onOpenChange={setShowCustomize}
              type="flashcards"
              lessonId={lesson?.id}
              compressedContent={lesson?.compressed_content || extractedContent}
              onGenerate={(opts) => handleGenerate(opts)}
            />
          </div>
        </Card>
      </div>
    );
  }

  // Session complete screen
  if (sessionComplete && cards) {
    const currentSetCards = cards.slice(currentSetStart, currentSetEnd + 1);
    const masteredInSet = currentSetCards.filter(c => c.mastered).length;
    const needsReview = currentSetCards.filter(c => !c.mastered).length;
    const totalInSet = currentSetCards.length;
    
    return (
      <div className={`space-y-4 px-3 py-6 pb-8 w-full max-w-full md:max-w-lg mx-auto ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
          <div className="text-5xl mb-2">{sessionStats.excellent + sessionStats.good > sessionStats.bad + sessionStats.okay ? '🎉' : '💪'}</div>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Set Complete!</h2>
          
          <div className={`rounded-2xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{sessionStats.good + sessionStats.excellent}</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Got it</div>
              </div>
              <div>
                <div className={`text-2xl font-black ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{sessionStats.bad + sessionStats.okay}</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Needs review</div>
              </div>
            </div>
          </div>

          {/* What to do next */}
          <div className={`rounded-2xl p-4 border text-left ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              ✨ What's next?
            </p>
            {needsReview > 0 ? (
              <div className="space-y-2">
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  You have <strong>{needsReview} card{needsReview !== 1 ? 's' : ''}</strong> that need more practice. Cards need at least 2 "Good" or "Excellent" ratings to be mastered.
                </p>
                <Button
                  onClick={() => {
                    setCurrentIndex(currentSetStart);
                    setIsFlipped(false);
                    setSessionComplete(false);
                    setSessionStats({ total: 0, bad: 0, okay: 0, good: 0, excellent: 0 });
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Review This Set Again
                </Button>
              </div>
            ) : (
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Amazing! All {totalInSet} cards mastered. Head back to your study plan for the next task.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBackToSets}
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              All Sets
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerate}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              New Set
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const setSize = currentSetEnd - currentSetStart + 1;
  const positionInSet = currentIndex - currentSetStart;
  const totalReviewed = sessionStats.total;
  const sessionProgress = totalReviewed > 0 ? ((sessionStats.good + sessionStats.excellent) / totalReviewed) * 100 : 0;
  
  // Progress bar color based on performance
  const getProgressBarColor = () => {
    if (sessionProgress >= 70) return 'from-emerald-500 to-teal-600';
    if (sessionProgress >= 40) return 'from-yellow-500 to-amber-600';
    return 'from-red-500 to-orange-600';
  };

  return (
    <div className={`space-y-3 px-3 py-3 pb-8 w-full max-w-full md:max-w-lg mx-auto relative ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Celebration modal removed */}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBackToSets}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30' : 'text-amber-600 bg-amber-50 hover:bg-amber-100'}`}
        >
          <Copy className="w-3.5 h-3.5" />
          All Sets
        </button>
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.3 }}
          key={currentIndex}
          className="absolute left-1/2 -translate-x-1/2"
        >
          <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            Card {positionInSet + 1} of {setSize}
          </span>
        </motion.div>
        <button
          onClick={() => setShowHowTo(true)}
          className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Session Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Session Progress</span>
          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{totalReviewed} / {setSize}</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <motion.div 
            className={`h-full bg-gradient-to-r ${getProgressBarColor()} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${(totalReviewed / setSize) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {totalReviewed > 0 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              ✓ {sessionStats.excellent + sessionStats.good} doing well
            </span>
            <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>•</span>
            <span className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              ⚠ {sessionStats.bad + sessionStats.okay} needs review
            </span>
          </div>
        )}
      </div>

      {/* Flashcard with 3D flip */}
      <div 
        onClick={handleFlip}
        className="cursor-pointer select-none w-full max-w-full"
        style={{ boxSizing: 'border-box', perspective: '1000px' }}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative min-h-[280px]"
        >
          {/* Question Side */}
          <Card 
            className={`absolute inset-0 border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-purple-900 to-indigo-900' : 'bg-gradient-to-br from-purple-50 to-indigo-50'}`}
            style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
          >
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="font-semibold text-sm text-white">Question</span>
              </div>
              <Badge className={`text-[10px] ${isDark ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-100 text-purple-700'}`}>
                {currentCard.difficulty}
              </Badge>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[220px]">
              <MathText className={`text-lg font-medium leading-relaxed text-center mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentCard.question}
              </MathText>
              <div className="text-center space-y-2">
                <p className={`text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Think of the answer, then...</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Tap to reveal →</p>
                <div onClick={(e) => e.stopPropagation()}>
                  <AskAIButton
                    type="flashcard"
                    data={{ question: currentCard.question, answer: currentCard.answer, topics: currentCard.topics }}
                    lesson={lesson}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Answer Side */}
          <Card 
            className={`absolute inset-0 border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-emerald-900 to-teal-900' : 'bg-gradient-to-br from-emerald-50 to-teal-50'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', transformStyle: 'preserve-3d' }}
          >
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3">
              <span className="font-semibold text-sm text-white">Answer</span>
            </div>
            <div className="p-6 flex items-center justify-center min-h-[220px]">
              <MathText className={`text-base leading-relaxed text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentCard.answer}
              </MathText>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Rating Buttons - Below Card - Duolingo/Gizmo style fast pop animations */}
      {isFlipped && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="mt-4"
        >
          <p className={`text-xs text-center mb-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>How well did you know this?</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Bad */}
            <motion.button
              onClick={() => handleRating('bad')}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl py-3 px-3 shadow-lg relative overflow-hidden"
            >
              {lastRating === 'bad' && (
                <motion.div
                  className="absolute inset-0 bg-red-400/50 rounded-xl"
                  initial={{ scale: 0, borderRadius: '50%' }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{ transformOrigin: 'center' }}
                />
              )}
              <div className="relative flex flex-col items-center gap-1">
                <motion.span className="text-xl" animate={lastRating === 'bad' ? { x: [0, -4, 4, -3, 3, 0] } : {}} transition={{ duration: 0.3 }}>❌</motion.span>
                <div className="font-bold text-sm">Bad</div>
                <div className="text-[10px] opacity-80">Show again</div>
              </div>
            </motion.button>
            
            {/* Okay */}
            <motion.button
              onClick={() => handleRating('okay')}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl py-3 px-3 shadow-lg relative overflow-hidden"
            >
              {lastRating === 'okay' && (
                <motion.div
                  className="absolute inset-0 bg-amber-300/50 rounded-xl"
                  initial={{ scale: 0, borderRadius: '50%' }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{ transformOrigin: 'center' }}
                />
              )}
              <div className="relative flex flex-col items-center gap-1">
                <motion.span className="text-xl" animate={lastRating === 'okay' ? { y: [0, -4, 0] } : {}} transition={{ duration: 0.25, type: "spring", stiffness: 400 }}>😐</motion.span>
                <div className="font-bold text-sm">Okay</div>
                <div className="text-[10px] opacity-80">1 day</div>
              </div>
            </motion.button>
            
            {/* Good */}
            <motion.button
              onClick={() => handleRating('good')}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl py-3 px-3 shadow-lg relative overflow-hidden"
            >
              {lastRating === 'good' && (
                <>
                  <motion.div
                    className="absolute inset-0 bg-emerald-300/50 rounded-xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ transformOrigin: 'center' }}
                  />
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 bg-emerald-200 rounded-full"
                      style={{ left: '50%', top: '50%' }}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{ scale: [0, 1, 0], x: Math.cos((i / 6) * Math.PI * 2) * 30, y: Math.sin((i / 6) * Math.PI * 2) * 30 }}
                      transition={{ duration: 0.35, delay: i * 0.02 }}
                    />
                  ))}
                </>
              )}
              <div className="relative flex flex-col items-center gap-1">
                <motion.span className="text-xl" animate={lastRating === 'good' ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.25, type: "spring", stiffness: 500 }}>✅</motion.span>
                <div className="font-bold text-sm">Good</div>
                <div className="text-[10px] opacity-80">Few days</div>
              </div>
            </motion.button>
            
            {/* Excellent */}
            <motion.button
              onClick={() => handleRating('excellent')}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl py-3 px-3 shadow-lg relative overflow-hidden"
            >
              {lastRating === 'excellent' && (
                <>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-yellow-300/60 to-purple-300/60 rounded-xl"
                    initial={{ scale: 0 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    style={{ transformOrigin: 'center' }}
                  />
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-sm"
                      style={{ left: '50%', top: '50%' }}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{ scale: [0, 1, 0], x: Math.cos((i / 8) * Math.PI * 2) * 35, y: Math.sin((i / 8) * Math.PI * 2) * 35 }}
                      transition={{ duration: 0.4, delay: i * 0.02 }}
                    >⭐</motion.div>
                  ))}
                </>
              )}
              <div className="relative flex flex-col items-center gap-1">
                <motion.span className="text-xl" animate={lastRating === 'excellent' ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] } : {}} transition={{ duration: 0.3, type: "spring", stiffness: 400 }}>⭐</motion.span>
                <div className="font-bold text-sm">Excellent</div>
                <div className="text-[10px] opacity-80">Mastered</div>
              </div>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
        >
          <ChevronLeft className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
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
          className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
        >
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
        </button>
      </div>

      {/* How to Use Modal */}
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
              className={`rounded-2xl max-w-sm w-full p-5 shadow-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>How Flashcards Work</h3>
                <button onClick={() => setShowHowTo(false)} className={`p-1 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                    <span className={`font-bold text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>1</span>
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Read & Think</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Think about the answer before revealing</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                    <span className={`font-bold text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>2</span>
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Tap to Flip</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Click anywhere on the card to see the answer</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                    <span className={`font-bold text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>3</span>
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Rate Honestly</p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bad = review soon • Excellent = mastered</p>
                  </div>
                </div>

                <div className={`border rounded-xl p-3 mt-4 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    <strong>💡 Tip:</strong> The AI learns from your ratings to show you the right cards at the right time!
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

      {/* XP Toast - positioned within tab container */}
      <AnimatePresence>
        {xpToast.show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            onAnimationComplete={() => {
              setTimeout(() => setXpToast({ show: false, xp: 0, reason: '' }), 1800);
            }}
          >
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5">
              <motion.span animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }} className="text-lg">⚡</motion.span>
              <div>
                <p className="text-lg font-bold">+{xpToast.xp} XP</p>
                {xpToast.reason && <p className="text-xs text-slate-700">{xpToast.reason}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}