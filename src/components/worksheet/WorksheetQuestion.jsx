
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function WorksheetQuestion({ question, answer, onAnswer }) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAnswerChange = (newAnswer) => {
    onAnswer(newAnswer);
    // Show success animation briefly
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 800);
  };

  // Helper function to render text with math notation
  const renderMathText = (text) => {
    if (!text) return null;
    
    // Replace superscripts: x^2 becomes x², (2x^3)^2 becomes (2x³)², x^-1 becomes x⁻¹
    let processed = text.replace(/\^(-?\d+)/g, '<sup>$1</sup>'); // Handles ^2, ^-1, ^10
    processed = processed.replace(/\^([a-zA-Z])/g, '<sup>$1</sup>'); // Handles ^x, ^y
    processed = processed.replace(/\^\(([^)]+)\)/g, '<sup>($1)</sup>'); // Handles ^(2x+1)
    
    // Replace subscripts: H_2O becomes H₂O, H_-1 becomes H₋₁
    processed = processed.replace(/_(-?\d+)/g, '<sub>$1</sub>'); // Handles _2, _-1, _10
    processed = processed.replace(/_([a-zA-Z])/g, '<sub>$1</sub>'); // Handles _x, _y
    
    return processed;
  };

  const renderQuestionInput = () => {
    const questionType = question.question_type.toLowerCase();
    
    // Check if it's a multiple choice question
    if (questionType.includes("multiple choice") || questionType.includes("mcq")) {
      // Ensure options exist and have at least 2 items
      if (!question.options || question.options.length < 2) {
        // Fallback to text input if no valid options
        return (
          <div className="space-y-2">
            <Label htmlFor="answer">Your Answer</Label>
            <Input
              id="answer"
              value={answer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              className="text-base"
            />
            <p className="text-xs text-amber-600">Note: This question appears to be missing options. Please provide a written answer.</p>
          </div>
        );
      }

      return (
        <RadioGroup value={answer} onValueChange={handleAnswerChange}>
          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  answer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
                onClick={() => handleAnswerChange(option)}
              >
                {answer === option && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  </motion.div>
                )}
                <RadioGroupItem value={option} id={`option-${idx}`} className="mt-0.5 flex-shrink-0" />
                <Label
                  htmlFor={`option-${idx}`}
                  className="flex-1 cursor-pointer text-slate-700 font-medium leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMathText(option) }}
                />
              </motion.div>
            ))}
          </div>
        </RadioGroup>
      );
    }

    if (questionType.includes("true") && questionType.includes("false")) {
      return (
        <RadioGroup value={answer} onValueChange={handleAnswerChange}>
          <div className="space-y-3">
            {["True", "False"].map((option) => (
              <motion.div
                key={option}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  answer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
                onClick={() => handleAnswerChange(option)}
              >
                {answer === option && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  </motion.div>
                )}
                <RadioGroupItem value={option} id={option} />
                <Label htmlFor={option} className="flex-1 cursor-pointer text-slate-700 font-medium">
                  {option}
                </Label>
              </motion.div>
            ))}
          </div>
        </RadioGroup>
      );
    }

    if (questionType.includes("short")) {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Answer (1-2 sentences)</Label>
          <Input
            id="answer"
            value={answer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
            className="text-base"
          />
        </div>
      );
    }

    // Long answer or any other type
    return (
      <div className="space-y-2">
        <Label htmlFor="answer">Your Answer (detailed response)</Label>
        <Textarea
          id="answer"
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Provide a detailed answer..."
          className="min-h-[200px] text-base"
        />
      </div>
    );
  };

  const getDifficultyColor = () => {
    const difficulty = question.difficulty_index;
    const colors = {
      "Moderate Exam-Level": "bg-blue-50 text-blue-700 border-blue-200",
      "Challenging Exam-Level": "bg-purple-50 text-purple-700 border-purple-200",
      "High Challenge Exam-Level": "bg-amber-50 text-amber-700 border-amber-200",
      "Foundational": "bg-emerald-50 text-emerald-700 border-emerald-200",
      "Conceptual": "bg-cyan-50 text-cyan-700 border-cyan-200",
      "Applied/Multi-step": "bg-orange-50 text-orange-700 border-orange-200",
      "Applied": "bg-orange-50 text-orange-700 border-orange-200"
    };
    return colors[difficulty] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getQuestionTypeColor = () => {
    const type = question.question_type;
    const colors = {
      "Multiple Choice": "bg-indigo-50 text-indigo-700 border-indigo-200",
      "MCQ": "bg-indigo-50 text-indigo-700 border-indigo-200",
      "True/False": "bg-teal-50 text-teal-700 border-teal-200",
      "Short Answer": "bg-violet-50 text-violet-700 border-violet-200",
      "Fill-in-the-Blank": "bg-pink-50 text-pink-700 border-pink-200",
      "Problem-Solving": "bg-rose-50 text-rose-700 border-rose-200",
      "Long Answer": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
    };
    return colors[type] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-full p-4 md:p-6 shadow-2xl"
            >
              <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-yellow-500" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="shadow-2xl">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-3">
              <motion.div 
                className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <span className="text-white font-bold text-sm md:text-base">{question.question_number}</span>
              </motion.div>
              <div>
                <CardTitle className="text-lg md:text-xl">Question {question.question_number}</CardTitle>
                <div className="flex gap-2 mt-1 md:mt-2 flex-wrap">
                  <Badge className={`${getDifficultyColor()} border text-xs`}>
                    {question.difficulty_index}
                  </Badge>
                  <Badge className={`${getQuestionTypeColor()} border text-xs`}>
                    {question.question_type}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {/* Render question text with proper math notation */}
          <div 
            className="text-base md:text-lg text-slate-700 leading-relaxed font-medium break-words"
            dangerouslySetInnerHTML={{ __html: renderMathText(question.question_text) }}
          />
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {renderQuestionInput()}
        </CardContent>
      </Card>
    </motion.div>
  );
}
