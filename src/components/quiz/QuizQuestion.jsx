
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

export default function QuizQuestion({ question, questionNumber, selectedAnswer, onSelectAnswer }) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAnswerChange = (answer) => {
    onSelectAnswer(answer);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 800);
  };

  // Helper function to render text with math notation
  const renderMathText = (text) => {
    if (!text) return null;
    
    // Replace superscripts: x^2 becomes x²
    let processed = text.replace(/\^(\d+)/g, '<sup>$1</sup>');
    processed = processed.replace(/\^([a-zA-Z])/g, '<sup>$1</sup>');
    
    // Replace subscripts: H_2O becomes H₂O
    processed = processed.replace(/_(\d+)/g, '<sub>$1</sub>');
    processed = processed.replace(/_([a-zA-Z])/g, '<sub>$1</sub>');
    
    return processed;
  };

  const renderQuestionInput = () => {
    if (question.question_type === "MCQ" || question.question_type === "Multiple Choice") {
      // Ensure options exist
      if (!question.options || question.options.length < 2) {
        return (
          <div className="space-y-2">
            <Label htmlFor="answer">Your Answer</Label>
            <Input
              id="answer"
              value={selectedAnswer || ""}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              className="text-base"
            />
            <p className="text-xs text-amber-600">Note: This question appears to be missing options. Please provide a written answer.</p>
          </div>
        );
      }

      return (
        <RadioGroup value={selectedAnswer?.toString()} onValueChange={handleAnswerChange}>
          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
                onClick={() => handleAnswerChange(option)}
              >
                {selectedAnswer === option && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <CheckCircle className="w-5 h-5 text-purple-600" />
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

    if (question.question_type === "True/False") {
      return (
        <RadioGroup value={selectedAnswer} onValueChange={handleAnswerChange}>
          <div className="space-y-3">
            {["True", "False"].map((option) => (
              <motion.div
                key={option}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                }`}
                onClick={() => handleAnswerChange(option)}
              >
                {selectedAnswer === option && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <CheckCircle className="w-5 h-5 text-purple-600" />
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

    if (question.question_type === "Short Answer" || question.question_type === "Fill-in-the-Blank") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Answer</Label>
          <Input
            id="answer"
            value={selectedAnswer || ""}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
            className="text-base"
          />
        </div>
      );
    }

    if (question.question_type === "Problem-Solving") {
      return (
        <div className="space-y-2">
          <Label htmlFor="answer">Your Solution</Label>
          <Textarea
            id="answer"
            value={selectedAnswer || ""}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Show your work and provide your answer..."
            className="min-h-[120px] text-base"
          />
        </div>
      );
    }
  };

  const getDifficultyColor = () => {
    const difficulty = question.difficulty_index;
    const colors = {
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
      "Problem-Solving": "bg-rose-50 text-rose-700 border-rose-200"
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
              className="bg-white rounded-full p-6 shadow-2xl"
            >
              <Sparkles className="w-12 h-12 text-yellow-500" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-3">
            <motion.div 
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center flex-shrink-0"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <span className="text-white font-bold">{questionNumber}</span>
            </motion.div>
            <CardTitle className="text-xl">Question {questionNumber}</CardTitle>
          </div>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Badge className={`${getDifficultyColor()} border`}>
              {question.difficulty_index}
            </Badge>
            <Badge className={`${getQuestionTypeColor()} border`}>
              {question.question_type}
            </Badge>
          </div>
          
          {/* Use ReactMarkdown for rich text support */}
          <div className="text-lg text-slate-700 prose prose-slate max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => {
                  const text = String(children);
                  return <span dangerouslySetInnerHTML={{ __html: renderMathText(text) }} className="px-1.5 py-0.5 bg-slate-100 rounded text-sm" />;
                }
              }}
            >
              {question.question_text}
            </ReactMarkdown>
          </div>

          {question.targeted_misconception && question.targeted_misconception !== "null" && (
            <p className="text-sm text-slate-500 mt-2 italic">
              💡 This question addresses a common misconception
            </p>
          )}
        </CardHeader>
        <CardContent>
          {renderQuestionInput()}
        </CardContent>
      </Card>
    </motion.div>
  );
}
