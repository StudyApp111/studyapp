import React, { useState, useEffect, useRef } from "react";
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
import { useTheme } from "@/components/theme/ThemeProvider";

// DiagnosticSocialProof moved to ExamTab level so it doesn't reset per question

export default function ExamQuestion({ question, answer, onAnswer, showFeedback = false, lesson = null, isDiagnostic = false }) {
  const { isDark } = useTheme();
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(answer || "");
  const [isCorrect, setIsCorrect] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWrongPulse, setShowWrongPulse] = useState(false);
  const [showCorrectBurst, setShowCorrectBurst] = useState(false);
  const stuckTimerRef = useRef(null);
  const hasNudgedRef = useRef(false);

  // Proactive Polly: nudge on mobile if user is stuck >45s without answering
  useEffect(() => {
    hasNudgedRef.current = false;
    if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current);
    
    if (hasAnswered || selectedAnswer) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    stuckTimerRef.current = setTimeout(() => {
      if (hasNudgedRef.current) return;
      hasNudgedRef.current = true;
      window.dispatchEvent(new CustomEvent('pollyStuckNudge', {
        detail: {
          nudge_type: 'exam_stuck',
          question_text: question?.question_text,
          topic: question?.assessed_competencies?.[0],
          lesson
        }
      }));
    }, 45000);

    return () => { if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current); };
  }, [question?.question_text, hasAnswered, selectedAnswer]);

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
      // User selected an option - extract the letter from their selection
      const userLetter = extractOptionLetter(userTrimmed, optionIndex);
      return userLetter.toUpperCase() === correctTrimmed.toUpperCase();
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
        ? isDark ? "border-purple-500 bg-purple-500/20" : "border-purple-500 bg-purple-50"
        : isDark ? "border-white/10 hover:border-purple-500/30 bg-white/[0.04]" : "border-slate-200 hover:border-purple-300 bg-slate-50";
    }

    const isThisCorrect = checkIsCorrect(optionText, question.correct_answer, optionIndex);
    const isThisSelected = selectedAnswer === optionText;

    if (isThisCorrect) {
      return isDark ? "border-emerald-500 bg-emerald-500/20" : "border-emerald-500 bg-emerald-50";
    }
    if (isThisSelected && !isThisCorrect) {
      return isDark ? "border-red-400 bg-red-500/20" : "border-red-400 bg-red-50";
    }
    return isDark ? "border-white/10 bg-white/[0.04] opacity-60" : "border-slate-200 bg-slate-50 opacity-60";
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
        // Robust option text extraction - handle objects
        let optionText = '';
        if (typeof option === 'string') {
          optionText = option;
        } else if (option && typeof option === 'object') {
          optionText = option.text || option.label || option.value || option.content || '';
          // Last resort: don't stringify objects, just use empty string
        }
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
                <span className={`font-semibold text-xs shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{optionLetter}.</span>
                <MathText inline className={`text-xs leading-snug break-words ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{displayText}</MathText>
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
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fill in the blank:</p>
      <input
        type="text"
        value={selectedAnswer}
        onChange={(e) => {
          setSelectedAnswer(e.target.value);
          onAnswer(e.target.value);
        }}
        placeholder="Type your answer..."
        className={`w-full p-2.5 text-sm border-2 rounded-lg focus:border-purple-500 focus:ring-0 transition-colors ${
          isDark 
            ? 'bg-slate-800 border-slate-600 text-white placeholder:text-slate-500' 
            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
        }`}
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
          {/* Left side - Explain This button only */}
          <AskAIButton 
            type="question" 
            data={{ ...question, user_answer: selectedAnswer }} 
            lesson={lesson} 
          />
          
          {/* Right side - Difficulty badge only */}
          <div className="flex gap-1 flex-wrap items-center">
            {question.difficulty_index && (
              <Badge className={`text-[9px] px-1.5 py-0 ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                {(question.difficulty_index || '')
                  .replace(/\b\w/g, c => c.toUpperCase())}
              </Badge>
            )}
          </div>
        </div>
        <MathText className={`text-sm font-medium leading-relaxed ${isDark ? 'text-purple-200' : 'text-slate-900'}`}>
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
          className={`p-3 rounded-xl border ${isCorrect ? (isDark ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/30' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300 shadow-sm shadow-emerald-200') : (isDark ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-sm shadow-amber-200')}`}
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
              <p className={`text-xs font-bold ${isCorrect ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                {isCorrect ? "🎉 Excellent!" : "Keep learning!"}
              </p>
              {/* Show correct answer when wrong */}
              {!isCorrect && question.correct_answer && (
                <MathText className={`text-xs font-medium mt-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  Correct answer: {isMCQ && /^[A-Da-d]$/i.test(question.correct_answer.trim()) 
                    ? (() => {
                        const letter = question.correct_answer.trim().toUpperCase();
                        const idx = letter.charCodeAt(0) - 65;
                        const optText = question.options?.[idx];
                        const cleanText = optText ? stripLetterPrefix(typeof optText === 'string' ? optText : (optText?.text || '')) : '';
                        return `${letter}. ${cleanText}`;
                      })()
                    : question.correct_answer}
                </MathText>
              )}
              {question.explanation && (
                <MathText className={`text-xs mt-1.5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {question.explanation}
                </MathText>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
    </>
  );
}