import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function FlashcardsTab({ lesson, extractedContent }) {
  const [cards] = useState([
    { front: "What is a variable?", back: "A named storage location that can hold different values during program execution" },
    { front: "Define algorithm", back: "A step-by-step procedure for solving a problem or performing a task" },
    { front: "What is recursion?", back: "A programming technique where a function calls itself to solve a problem" }
  ]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setShowAnswer(!showAnswer);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleAgain = () => {
    // Anki logic: card goes to beginning of queue
    handleNext();
  };

  const handleGood = () => {
    // Anki logic: card scheduled for later review
    handleNext();
  };

  const handleEasy = () => {
    // Anki logic: card scheduled for much later
    handleNext();
  };

  return (
    <Card className="bg-white/90 border-purple-200 backdrop-blur-xl min-h-[500px] shadow-xl p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            <h3 className="text-2xl font-bold text-slate-900">Flashcards</h3>
          </div>
          <p className="text-slate-600">
            Spaced repetition learning • Card {currentIndex + 1} of {cards.length}
          </p>
        </div>

        <div className="perspective-1000 mb-8">
          <motion.div
            className="relative h-80 cursor-pointer"
            onClick={handleFlip}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front of card */}
            <div
              className={`absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-2xl flex items-center justify-center p-8 ${
                isFlipped ? "invisible" : "visible"
              }`}
              style={{ backfaceVisibility: "hidden" }}
            >
              <p className="text-2xl font-medium text-white text-center">
                {cards[currentIndex].front}
              </p>
            </div>

            {/* Back of card */}
            <div
              className={`absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl shadow-2xl flex items-center justify-center p-8 ${
                !isFlipped ? "invisible" : "visible"
              }`}
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <p className="text-xl text-slate-900 text-center leading-relaxed">
                {cards[currentIndex].back}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="text-center text-sm text-slate-500 mb-6">
          {!showAnswer && "Click card to reveal answer"}
          {showAnswer && "Rate your recall to continue"}
        </div>

        {!showAnswer ? (
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              className="w-32"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleFlip}
              className="w-32 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Flip
            </Button>
            <Button
              variant="outline"
              onClick={handleNext}
              className="w-32"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Button
              onClick={handleAgain}
              variant="outline"
              className="border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <span className="text-red-600 font-semibold">Again</span>
              <span className="text-xs text-slate-500 block mt-1">1 min</span>
            </Button>
            <Button
              onClick={handleGood}
              variant="outline"
              className="border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300"
            >
              <span className="text-yellow-600 font-semibold">Good</span>
              <span className="text-xs text-slate-500 block mt-1">10 min</span>
            </Button>
            <Button
              onClick={handleEasy}
              variant="outline"
              className="border-green-200 hover:bg-green-50 hover:border-green-300"
            >
              <span className="text-green-600 font-semibold">Easy</span>
              <span className="text-xs text-slate-500 block mt-1">4 days</span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}