import React from "react";
import { Sparkles } from "lucide-react";
import { useAITutor } from "./AITutorContext";

/**
 * Contextual "Ask AI" button that pre-loads context into the AI tutor
 * 
 * @param {string} type - "question" | "flashcard" | "document"
 * @param {object} data - Context data (question object, flashcard, or selected text)
 * @param {object} lesson - Lesson context for additional info
 * @param {string} size - "sm" | "md" (default: "sm")
 */
export default function AskAIButton({ type, data, lesson, size = "sm" }) {
  const { openWithContext } = useAITutor();

  const handleClick = (e) => {
    e.stopPropagation();
    
    let contextData = {
      type,
      lesson: lesson ? {
        id: lesson.id,
        course_name: lesson.course_name,
        extracted_content: lesson.extracted_content?.substring(0, 8000) // Limit content size
      } : null
    };

    if (type === "question") {
      contextData.question = {
        text: data.question_text,
        options: data.options,
        correct_answer: data.correct_answer,
        explanation: data.explanation,
        type: data.question_type
      };
      contextData.initialPrompt = `Help me understand this question:\n\n"${data.question_text}"\n\nExplain the concept behind it and why the correct answer is "${data.correct_answer}".`;
    } 
    else if (type === "flashcard") {
      contextData.flashcard = {
        question: data.question,
        answer: data.answer,
        topics: data.topics
      };
      contextData.initialPrompt = `Help me understand this flashcard:\n\nQuestion: "${data.question}"\nAnswer: "${data.answer}"\n\nExplain this concept in more detail.`;
    }
    else if (type === "document") {
      contextData.selectedText = data.selectedText;
      contextData.initialPrompt = `Explain this section from my notes:\n\n"${data.selectedText}"\n\nBreak it down in simple terms.`;
    }

    openWithContext(contextData);
  };

  const sizeClasses = size === "sm" 
    ? "px-2 py-1 text-[10px] gap-1" 
    : "px-3 py-1.5 text-xs gap-1.5";

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center ${sizeClasses} bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-95`}
    >
      <Sparkles className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>Ask AI</span>
    </button>
  );
}