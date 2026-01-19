import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Lightbulb, Sparkles, Star } from "lucide-react";
import MathText from "@/components/math/MathText";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";
import AskAIButton from "@/components/ai-tutor/AskAIButton";

export default function ExamQuestion({ question, answer, onAnswer, showFeedback = false, lesson = null }) {
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(answer || "");
  const [isCorrect, setIsCorrect] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWrongPulse, setShowWrongPulse] = useState(false);
  const [showCorrectBurst, setShowCorrectBurst] = useState(false);

  const questionType = question.question_type?.toLowerCase() || "";
  // Handle both official exam types ("Multiple Choice") and practice exam types ("multiple_choice")
  const isMCQ = questionType.includes("multiple choice") || questionType.includes("multiple_choice") || questionType.includes("mcq");
  const isTrueFalse = (questionType.includes("true") && questionType.includes("false")) || questionType.includes("true_false");
  const isFillBlank = questionType.includes("fill") && questionType.includes("blank") || questionType.includes("fill_blank");
  const isObjective = isMCQ || isTrueFalse;

  // For MCQ: extract just the letter from an option like "A. Some text" or "B) Answer"
  const extractOptionLetter = (optionText, optionIndex) => {
    if (!optionText) return String.fromCharCode(65 + optionIndex); // Fallback to A, B, C, D based on index
    const letterMatch = optionText.trim().match(/^([A-Da-d])[\.\)\:\s]/i);
    if (letterMatch) return letterMatch[1].toUpperCase();
    // Return letter based on position in options array
    return String.fromCharCode(65 + optionIndex);
  };

  const checkIsCorrect = (userAns, correctAns, optionIndex = -1) => {
    if (!userAns || !correctAns) return false;
    
    const userTrimmed = userAns.trim();
    const correctTrimmed = correctAns.trim();
    
    // For MCQ where correct_answer should be just a letter (A, B, C, D)
    if (/^[A-Da-d]$/i.test(correctTrimmed)) {
      // The optionIndex tells us which option the user selected (0=A, 1=B, 2=C, 3=D)
      if (optionIndex >= 0) {
        const userLetter = String.fromCharCode(65 + optionIndex); // 0->A, 1->B, etc.
        return userLetter === correctTrimmed.toUpperCase();
      }
      // Fallback: try to extract letter from user's answer text
      const letterMatch = userTrimmed.match(/^([A-Da-d])[\.\)\:\s]/i);
      if (letterMatch) {
        return letterMatch[1].toUpperCase() === correctTrimmed.toUpperCase();
      }
      return false;
    }
    
    // For True/False
    if (correctTrimmed.toLowerCase() === 'true' || correctTrimmed.toLowerCase() === 'false') {
      return userTrimmed.toLowerCase() === correctTrimmed.toLowerCase();
    }
    
    // For fill-in-blank and short answer - exact match (case insensitive)
    return userTrimmed.toLowerCase() === correctTrimmed.toLowerCase();
  };

  useEffect(() => {
    if (answer && isObjective) {
      setSelectedAnswer(answer);
      setHasAnswered(true);
      // Find the option index for the user's answer
      const optionIndex = question.options?.findIndex(opt => opt === answer) ?? -1;
      const correct = checkIsCorrect(answer, question.correct_answer, optionIndex);
      setIsCorrect(correct);
    }
  }, []);

  const handleAnswerSelect = (value) => {
    if (hasAnswered && isObjective) return; // Lock after answering for objective questions
    
    setSelectedAnswer(value);
    onAnswer(value);

    if (isObjective) {
      setHasAnswered(true);
      // Find the option index for the selected answer
      const optionIndex = question.options?.findIndex(opt => opt === value) ?? -1;
      const correct = checkIsCorrect(value, question.correct_answer, optionIndex);
      console.log('📝 Answer check:', { 
        selectedOption: value, 
        optionIndex, 
        correctAnswer: question.correct_answer,
        userLetter: optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : 'N/A',
        isCorrect: correct 
      });
      setIsCorrect(correct);
      
      if (correct) {
        setShowConfetti(true);
        setShowCorrectBurst(true);
        setTimeout(() => setShowCorrectBurst(false), 1500);
      } else {
        setShowWrongPulse(true);
        setTimeout(() => setShowWrongPulse(false), 800);
      }
    }
  };

  const getOptionStyle = (optionText, optionIndex) => {
    if (!hasAnswered || !isObjective) {
      return selectedAnswer === optionText
        ? "border-purple-500 bg-purple-50"
        : "border-slate-200 hover:border-purple-300 bg-white";
    }

    const isThisCorrect = checkIsCorrect(optionText, question.correct_answer, optionIndex);
    const isThisSelected = selectedAnswer === optionText;

    if (isThisCorrect) {
      return "border-emerald-500 bg-emerald-50";
    }
    if (isThisSelected && !isThisCorrect) {
      return "border-red-400 bg-red-50";
    }
    return "border-slate-200 bg-slate-50 opacity-60";
  };

  // Strip leading letter prefix like "A)", "B.", "C) " from option text
  const stripLetterPrefix = (text) => {
    if (!text) return text;
    return text.replace(/^[A-Da-d][\).\s]+\s*/g, '').trim();
  };

  const renderMCQOptions = () => (
    <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect} className="space-y-2">
      {question.options?.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const optionText = typeof option === 'string' ? option : (option?.text || option?.label || option?.value || String(option));
        const displayText = stripLetterPrefix(optionText);
        const isThisCorrect = checkIsCorrect(optionText, question.correct_answer, index);
        const isThisSelected = selectedAnswer === optionText;

        return (
          <label
            key={index}
            htmlFor={`option-${index}`}
            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all cursor-pointer ${getOptionStyle(optionText, index)} ${hasAnswered ? 'cursor-default' : 'active:scale-[0.99]'}`}
            onClick={(e) => {
              e.preventDefault();
              handleAnswerSelect(optionText);
            }}
          >
            <RadioGroupItem value={optionText} id={`option-${index}`} className="pointer-events-none shrink-0" disabled={hasAnswered} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <span className="font-semibold text-slate-700 text-xs shrink-0">{optionLetter}.</span>
                <MathText inline className="text-slate-700 text-xs leading-snug break-words">{displayText}</MathText>
              </div>
            </div>
            {hasAnswered && isThisCorrect && (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {hasAnswered && isThisSelected && !isThisCorrect && (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
          </label>
        );
      })}
    </RadioGroup>
  );

  const renderTrueFalseOptions = () => (
    <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect} className="space-y-2">
      {["True", "False"].map((option, index) => {
        const isThisCorrect = checkIsCorrect(option, question.correct_answer, index);
        const isThisSelected = selectedAnswer === option;

        return (
          <div
            key={option}
            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all cursor-pointer ${getOptionStyle(option, index)} ${hasAnswered ? 'cursor-default' : ''}`}
            onClick={() => handleAnswerSelect(option)}
          >
            <RadioGroupItem value={option} id={`option-${option}`} disabled={hasAnswered} />
            <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer text-xs">
              {option}
            </Label>
            {hasAnswered && isThisCorrect && (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {hasAnswered && isThisSelected && !isThisCorrect && (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
          </div>
        );
      })}
    </RadioGroup>
  );

  const renderSubjectiveInput = () => (
    <Textarea
      value={selectedAnswer}
      onChange={(e) => {
        setSelectedAnswer(e.target.value);
        onAnswer(e.target.value);
      }}
      placeholder="Type your answer here..."
      className="min-h-[80px] text-xs p-2.5"
    />
  );

  const renderFillBlankInput = () => (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Fill in the blank:</p>
      <input
        type="text"
        value={selectedAnswer}
        onChange={(e) => {
          setSelectedAnswer(e.target.value);
          onAnswer(e.target.value);
        }}
        placeholder="Type your answer..."
        className="w-full p-2.5 text-sm border-2 border-slate-200 rounded-lg focus:border-purple-500 focus:ring-0 transition-colors"
      />
    </div>
  );

  const renderInput = () => {
    if (isMCQ) return renderMCQOptions();
    if (isTrueFalse) return renderTrueFalseOptions();
    if (isFillBlank) return renderFillBlankInput();
    return renderSubjectiveInput();
  };

  return (
    <>
    <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
    
    {/* Correct answer celebration overlay */}
    <AnimatePresence>
      {showCorrectBurst && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-6 shadow-2xl shadow-emerald-500/50"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
          </motion.div>
          {/* Floating stars */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                x: Math.cos(i * 60 * Math.PI / 180) * 100,
                y: Math.sin(i * 60 * Math.PI / 180) * 100,
                scale: [0, 1, 0.5]
              }}
              transition={{ duration: 0.8, delay: 0.1 * i }}
              className="absolute"
            >
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        x: showWrongPulse ? [0, -8, 8, -8, 8, -4, 4, 0] : 0,
        scale: showWrongPulse ? [1, 0.98, 1] : 1
      }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        duration: showWrongPulse ? 0.5 : 0.2,
        x: { duration: 0.5, ease: "easeInOut" }
      }}
      className={`space-y-3 relative ${showWrongPulse ? 'ring-2 ring-red-400/60 rounded-xl' : ''}`}
    >
      {/* Wrong answer flash overlay */}
      <AnimatePresence>
        {showWrongPulse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-red-500 rounded-xl pointer-events-none z-10"
          />
        )}
      </AnimatePresence>
      {/* Question */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex gap-1 flex-wrap">
            <Badge className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0">
              {(question.question_type || '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())}
            </Badge>
            {question.difficulty_index && (
              <Badge className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0">
                {(question.difficulty_index || '')
                  .replace(/\b\w/g, c => c.toUpperCase())}
              </Badge>
            )}
          </div>
          {/* Ask AI Button */}
          <AskAIButton 
            type="question" 
            data={{ ...question, user_answer: selectedAnswer }} 
            lesson={lesson} 
          />
        </div>
        <MathText className="text-sm font-medium text-slate-900 leading-relaxed">
          {question.question_text}
        </MathText>
      </div>

      {/* Options */}
      <div>{renderInput()}</div>

      {/* Instant Feedback for Objective Questions */}
      {hasAnswered && isObjective && (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`p-3 rounded-xl ${isCorrect ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-300 shadow-sm shadow-emerald-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 shadow-sm shadow-amber-200'}`}
        >
          <div className="flex items-start gap-2">
            {isCorrect ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-white" />
                </div>
              </motion.div>
            )}
            <div className="flex-1">
              <p className={`text-xs font-bold ${isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isCorrect ? "🎉 Excellent!" : "Keep learning!"}
              </p>
              {/* Show correct answer when wrong */}
              {!isCorrect && question.correct_answer && (
                <p className="text-xs text-emerald-700 font-medium mt-1">
                  Correct answer: {isMCQ ? `${question.correct_answer}` : question.correct_answer}
                </p>
              )}
              {question.explanation && (
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {question.explanation}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
    </>
  );
}