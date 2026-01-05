import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import MathText from "../math/MathText";

export default function WorksheetQuestion({ question, answer, onAnswer }) {
  const handleAnswerChange = (value) => {
    onAnswer(value);
  };

  const renderInput = () => {
    const questionType = question.question_type.toLowerCase();

    if (questionType.includes("multiple choice") || questionType.includes("mcq")) {
      return (
        <RadioGroup value={answer} onValueChange={handleAnswerChange} className="space-y-2 md:space-y-3">
          {question.options.map((option, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            const optionText = typeof option === 'string' ? option : option?.text || JSON.stringify(option);
            return (
              <label
                key={index}
                htmlFor={`option-${index}`}
                className={`flex items-start space-x-2 md:space-x-3 p-2.5 md:p-4 rounded-lg border-2 transition-all cursor-pointer touch-manipulation active:scale-[0.99] ${
                  answer === optionText
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-purple-300 bg-white"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  handleAnswerChange(optionText);
                }}
              >
                <RadioGroupItem value={optionText} id={`option-${index}`} className="mt-0.5 pointer-events-none" />
                <div className="flex-1 pointer-events-none">
                  <div className="flex items-start gap-1.5 md:gap-2">
                    <span className="font-semibold text-slate-700 text-xs md:text-base">{optionLetter}.</span>
                    <MathText inline className="text-slate-700 text-xs md:text-base leading-snug">{optionText}</MathText>
                  </div>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      );
    }

    if (questionType.includes("true") && questionType.includes("false")) {
      return (
        <RadioGroup value={answer} onValueChange={handleAnswerChange} className="space-y-2 md:space-y-3">
          {["True", "False"].map((option) => (
            <div
              key={option}
              className={`flex items-center space-x-2 md:space-x-3 p-2.5 md:p-4 rounded-lg border-2 transition-all ${
                answer === option
                  ? "border-purple-500 bg-purple-50"
                  : "border-slate-200 hover:border-purple-300 bg-white"
              }`}
            >
              <RadioGroupItem value={option} id={`option-${option}`} />
              <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer text-xs md:text-base">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (questionType.includes("short answer") || questionType.includes("fill")) {
      return (
        <Textarea
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          className="min-h-[120px] md:min-h-[200px] text-xs md:text-base p-2.5 md:p-4"
        />
      );
    }

    if (questionType.includes("long answer") || questionType.includes("essay")) {
      return (
        <Textarea
          value={answer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Type your detailed answer here..."
          className="min-h-[120px] md:min-h-[200px] text-xs md:text-base p-2.5 md:p-4"
        />
      );
    }

    return (
      <Textarea
        value={answer}
        onChange={(e) => handleAnswerChange(e.target.value)}
        placeholder="Type your answer here..."
        className="min-h-[100px] md:min-h-[150px] text-xs md:text-base p-2.5 md:p-4"
      />
    );
  };

  const getDifficultyColor = (difficulty) => {
    if (!difficulty) return "bg-slate-100 text-slate-700";
    if (difficulty.includes("Foundational")) return "bg-blue-100 text-blue-700";
    if (difficulty.includes("Conceptual")) return "bg-green-100 text-green-700";
    if (difficulty.includes("Moderate")) return "bg-yellow-100 text-yellow-700";
    if (difficulty.includes("Challenging")) return "bg-orange-100 text-orange-700";
    if (difficulty.includes("High Challenge")) return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
  };

  const getQuestionTypeColor = (type) => {
    if (!type) return "bg-slate-100 text-slate-700";
    if (type.toLowerCase().includes("multiple")) return "bg-purple-100 text-purple-700";
    if (type.toLowerCase().includes("short")) return "bg-indigo-100 text-indigo-700";
    if (type.toLowerCase().includes("long")) return "bg-pink-100 text-pink-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-xl border-0 bg-white">
        <CardContent className="p-3 md:p-8">
          <div className="mb-3 md:mb-6">
            <div className="flex gap-1.5 mb-2 md:mb-4 flex-wrap">
              <Badge className={`${getDifficultyColor(question.difficulty_index)} text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1`}>
                {question.difficulty_index || "Standard"}
              </Badge>
              <Badge className={`${getQuestionTypeColor(question.question_type)} text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1`}>
                {question.question_type}
              </Badge>
            </div>

            <MathText className="text-sm md:text-xl font-medium text-slate-900 leading-relaxed">
              {question.question_text}
            </MathText>
          </div>

          <div className="space-y-2 md:space-y-4">{renderInput()}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}