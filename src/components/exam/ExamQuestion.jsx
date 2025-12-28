import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Lightbulb } from "lucide-react";
import MathText from "@/components/math/MathText";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";

export default function ExamQuestion({ question, answer, onAnswer, showFeedback = false }) {
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(answer || "");
  const [isCorrect, setIsCorrect] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWrongPulse, setShowWrongPulse] = useState(false);

  const questionType = question.question_type?.toLowerCase() || "";
  const isMCQ = questionType.includes("multiple choice") || questionType.includes("mcq");
  const isTrueFalse = questionType.includes("true") && questionType.includes("false");
  const isObjective = isMCQ || isTrueFalse;

  useEffect(() => {
    if (answer && isObjective) {
      setSelectedAnswer(answer);
      setHasAnswered(true);
      const correct = answer?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
      setIsCorrect(correct);
    }
  }, []);

  const handleAnswerSelect = (value) => {
    if (hasAnswered && isObjective) return; // Lock after answering for objective questions
    
    setSelectedAnswer(value);
    onAnswer(value);

    if (isObjective) {
      setHasAnswered(true);
      const correct = value?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
      setIsCorrect(correct);
      
      if (correct) {
        setShowConfetti(true);
      } else {
        setShowWrongPulse(true);
        setTimeout(() => setShowWrongPulse(false), 600);
      }
    }
  };

  const getOptionStyle = (optionText) => {
    if (!hasAnswered || !isObjective) {
      return selectedAnswer === optionText
        ? "border-purple-500 bg-purple-50"
        : "border-slate-200 hover:border-purple-300 bg-white";
    }

    const isThisCorrect = optionText?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
    const isThisSelected = selectedAnswer === optionText;

    if (isThisCorrect) {
      return "border-emerald-500 bg-emerald-50";
    }
    if (isThisSelected && !isThisCorrect) {
      return "border-red-400 bg-red-50";
    }
    return "border-slate-200 bg-slate-50 opacity-60";
  };

  const renderMCQOptions = () => (
    <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelect} className="space-y-2">
      {question.options?.map((option, index) => {
        const optionLetter = String.fromCharCode(65 + index);
        const optionText = typeof option === 'string' ? option : option?.text || JSON.stringify(option);
        const isThisCorrect = optionText?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
        const isThisSelected = selectedAnswer === optionText;

        return (
          <label
            key={index}
            htmlFor={`option-${index}`}
            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all cursor-pointer ${getOptionStyle(optionText)} ${hasAnswered ? 'cursor-default' : 'active:scale-[0.99]'}`}
            onClick={(e) => {
              e.preventDefault();
              handleAnswerSelect(optionText);
            }}
          >
            <RadioGroupItem value={optionText} id={`option-${index}`} className="pointer-events-none shrink-0" disabled={hasAnswered} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <span className="font-semibold text-slate-700 text-xs shrink-0">{optionLetter}.</span>
                <MathText inline className="text-slate-700 text-xs leading-snug break-words">{optionText}</MathText>
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
      {["True", "False"].map((option) => {
        const isThisCorrect = option?.toLowerCase() === question.correct_answer?.trim().toLowerCase();
        const isThisSelected = selectedAnswer === option;

        return (
          <div
            key={option}
            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all cursor-pointer ${getOptionStyle(option)} ${hasAnswered ? 'cursor-default' : ''}`}
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

  const renderInput = () => {
    if (isMCQ) return renderMCQOptions();
    if (isTrueFalse) return renderTrueFalseOptions();
    return renderSubjectiveInput();
  };

  return (
    <>
    <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: showWrongPulse ? [1, 0.98, 1] : 1
      }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`space-y-3 ${showWrongPulse ? 'ring-2 ring-amber-300 ring-opacity-50 rounded-xl' : ''}`}
    >
      {/* Question */}
      <div>
        <div className="flex gap-1 mb-2 flex-wrap">
          <Badge className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0">
            {question.question_type}
          </Badge>
          {question.difficulty_index && (
            <Badge className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0">
              {question.difficulty_index}
            </Badge>
          )}
        </div>
        <MathText className="text-sm font-medium text-slate-900 leading-relaxed">
          {question.question_text}
        </MathText>
      </div>

      {/* Options */}
      <div>{renderInput()}</div>

      {/* Instant Feedback for Objective Questions */}
      {hasAnswered && isObjective && (
        <div className={`p-3 rounded-xl ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-start gap-2">
            {isCorrect ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-xs font-semibold ${isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isCorrect ? "Correct!" : "Not quite right"}
              </p>
              {question.explanation && (
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {question.explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
    </>
  );
}