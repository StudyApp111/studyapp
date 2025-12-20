import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Eye, EyeOff, Shuffle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function FlashcardsTab({ lesson, extractedContent }) {
  const [cards, setCards] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [cardStats, setCardStats] = useState({
    new: 0,
    learning: 0,
    review: 0
  });

  useEffect(() => {
    loadFlashcards();
  }, [lesson?.id]);

  const loadFlashcards = async () => {
    if (!lesson) return;
    
    try {
      const existingCards = await base44.entities.Flashcard.filter({ lesson_id: lesson.id });
      if (existingCards.length > 0) {
        setCards(existingCards);
        updateCardStats(existingCards);
      }
    } catch (error) {
      console.error("Error loading flashcards:", error);
    }
  };

  const updateCardStats = (flashcards) => {
    const stats = {
      new: flashcards.filter(c => c.status === 'new').length,
      learning: flashcards.filter(c => c.status === 'learning').length,
      review: flashcards.filter(c => c.status === 'review').length
    };
    setCardStats(stats);
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
      
      // Save to database
      const savedCards = await Promise.all(
        generatedCards.map(card => 
          base44.entities.Flashcard.create({
            lesson_id: lesson.id,
            question: card.question,
            answer: card.answer,
            topics: card.topics,
            difficulty: card.difficulty,
            status: "new"
          })
        )
      );

      setCards(savedCards);
      updateCardStats(savedCards);
    } catch (error) {
      console.error("Error generating flashcards:", error);
    }
    setIsGenerating(false);
  };

  const handleReveal = () => {
    setShowAnswer(!showAnswer);
  };

  const handleRating = async (rating) => {
    const currentCard = cards[currentIndex];
    
    // Update card status based on rating
    let newStatus = currentCard.status;
    if (currentCard.status === 'new') {
      newStatus = 'learning';
    } else if (rating === 'easy' && currentCard.status === 'learning') {
      newStatus = 'review';
    }

    // Save to database
    try {
      await base44.entities.Flashcard.update(currentCard.id, {
        status: newStatus,
        last_reviewed: new Date().toISOString()
      });

      const updatedCards = [...cards];
      updatedCards[currentIndex] = { ...currentCard, status: newStatus };
      setCards(updatedCards);
      updateCardStats(updatedCards);
    } catch (error) {
      console.error("Error updating flashcard:", error);
    }

    setShowAnswer(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const handleRegenerate = () => {
    setCards(null);
    setCurrentIndex(0);
    setShowAnswer(false);
    setCardStats({ new: 0, learning: 0, review: 0 });
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
            <p className="text-sm text-slate-600">
              Generate intelligent flashcards using spaced repetition to maximize retention.
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

  // Loading state
  if (isGenerating) {
    return null; // Will use EducationalLoader from parent
  }

  // Flashcard display
  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-700";
      case "hard": return "bg-red-100 text-red-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="space-y-3 px-2">
      {/* Progress header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">Card {currentIndex + 1} of {cards.length}</span>
        <span className="font-medium text-slate-700">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-1.5" />

      {/* Card */}
      <Card className="border-0 shadow-xl overflow-hidden">
        {showAnswer ? (
          <>
            {/* Answer view with flip animation */}
            <div className="relative" style={{ perspective: '1000px' }}>
              <div className={`transition-all duration-500 transform-style-3d ${showAnswer ? '' : 'rotate-y-180'}`}>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-1.5 text-white">
                    <Eye className="w-4 h-4" />
                    <span className="font-semibold text-sm">Answer</span>
                  </div>
                  <Badge className={`${getDifficultyColor(currentCard.difficulty)} font-semibold text-xs`}>
                    {currentCard.difficulty}
                  </Badge>
                </div>
                <div className="p-6 bg-white rounded-b-lg min-h-[200px] flex flex-col items-center justify-center">
                  <p className="text-slate-900 text-sm leading-relaxed mb-6 text-center">
                    {currentCard.answer}
                  </p>
                  <div className="flex justify-center">
                    <button
                      onClick={handleReveal}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold text-xs flex items-center gap-1.5 transition-all hover:scale-105"
                    >
                      <EyeOff className="w-4 h-4" />
                      Hide answer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Rating buttons */}
            <div className="grid grid-cols-4 gap-2 p-3">
              <button
                onClick={() => handleRating('again')}
                className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl p-3 shadow-lg transition-all active:scale-95"
              >
                <div className="text-center">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-lg">✕</span>
                  </div>
                  <div className="font-bold text-xs mb-0.5">Again</div>
                  <div className="text-[10px] opacity-90">&lt;1d</div>
                </div>
              </button>
              <button
                onClick={() => handleRating('hard')}
                className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl p-3 shadow-lg transition-all active:scale-95"
              >
                <div className="text-center">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-lg">⏱</span>
                  </div>
                  <div className="font-bold text-xs mb-0.5">Hard</div>
                  <div className="text-[10px] opacity-90">1d</div>
                </div>
              </button>
              <button
                onClick={() => handleRating('good')}
                className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl p-3 shadow-lg transition-all active:scale-95"
              >
                <div className="text-center">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-lg">✓</span>
                  </div>
                  <div className="font-bold text-xs mb-0.5">Good</div>
                  <div className="text-[10px] opacity-90">3d</div>
                </div>
              </button>
              <button
                onClick={() => handleRating('easy')}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl p-3 shadow-lg transition-all active:scale-95"
              >
                <div className="text-center">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-lg">⚡</span>
                  </div>
                  <div className="font-bold text-xs mb-0.5">Easy</div>
                  <div className="text-[10px] opacity-90">4d</div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Question view with flip animation */}
            <div className="relative" style={{ perspective: '1000px' }}>
              <div className={`transition-all duration-500 transform-style-3d ${showAnswer ? 'rotate-y-180' : ''}`}>
                <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-1.5 text-white">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-semibold text-sm">Question</span>
                  </div>
                  <div className="flex gap-1">
                    {currentCard.topics.slice(0, 2).map((topic, i) => (
                      <Badge key={i} className="bg-purple-400 text-white border-0 text-[10px] px-2 py-0.5">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-white min-h-[200px] flex flex-col items-center justify-center rounded-b-lg">
                  <p className="text-slate-900 text-base font-medium leading-relaxed text-center mb-6">
                    {currentCard.question}
                  </p>
                  <button
                    onClick={handleReveal}
                    className="text-purple-600 hover:text-purple-700 font-semibold text-xs flex items-center gap-1.5 transition-all hover:scale-105"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal answer
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Stats footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50">
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 justify-center">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">New</Badge>
                <span className="text-xs font-bold text-slate-900">{cardStats.new}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">Learning</Badge>
                <span className="text-xs font-bold text-slate-900">{cardStats.learning}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Review</Badge>
                <span className="text-xs font-bold text-slate-900">{cardStats.review}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={handleShuffle} className="text-xs h-8">
                <Shuffle className="w-3 h-3 mr-1" />
                Shuffle
              </Button>
              <Button variant="outline" size="sm" onClick={handleRegenerate} className="text-xs h-8">
                <Plus className="w-3 h-3 mr-1" />
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}