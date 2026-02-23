import React from "react";
import { HelpCircle } from "lucide-react";
import { useAITutor } from "./AITutorContext";

/**
 * Contextual "Explain This" button that pre-loads context into the AI tutor
 * 
 * @param {string} type - "question" | "flashcard" | "document" | "teachit"
 * @param {object} data - Context data (question object, flashcard, or selected text)
 * @param {object} lesson - Lesson context for additional info
 * @param {string} size - "sm" | "md" (default: "sm")
 */
export default function AskAIButton({ type, data, lesson, size = "sm" }) {
  const { openWithContext, sendToPanel } = useAITutor();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      const hasUserAnswer = data.user_answer && data.user_answer.trim() !== "";
      const userAnswerIsCorrect = hasUserAnswer && data.user_answer?.trim().toLowerCase() === data.correct_answer?.trim().toLowerCase();
      
      contextData.question = {
        text: data.question_text,
        options: data.options,
        correct_answer: hasUserAnswer ? data.correct_answer : null, // Only include if user answered
        user_answer: data.user_answer || null,
        explanation: data.explanation,
        type: data.question_type
      };
      
      const isShortAnswer = (data.question_type || '').toLowerCase().includes('short answer') || 
                           (data.question_type || '').toLowerCase().includes('fill in the blank') ||
                           (data.question_type || '').toLowerCase().includes('structured response');
      
      // Different prompts based on whether user has answered
      if (!hasUserAnswer && isShortAnswer) {
        contextData.initialPrompt = `I'm stuck on this short answer question and need help structuring my response. Do NOT give me the answer directly.\n\nQuestion: "${data.question_text}"\n\nPlease:\n1. Briefly explain the key concept being tested (1-2 sentences)\n2. Break down what the question is really asking — identify the specific parts I need to address\n3. Give me a framework/structure for a strong response (e.g. "Start by identifying X, then explain how Y relates to Z")\n4. Provide 2-3 starter hints or phrases I could use to begin my answer\n5. End with encouragement\n\nDo NOT write the full answer. Guide me so I can write it myself.`;
      } else if (!hasUserAnswer) {
        contextData.initialPrompt = `Help me understand this question without giving away the answer:\n\n"${data.question_text}"\n\nExplain the underlying concept and give me hints to figure it out myself.`;
      } else if (userAnswerIsCorrect) {
        contextData.initialPrompt = `I got this question right! My answer: "${data.user_answer}"\n\nQuestion: "${data.question_text}"\n\nCan you explain why this is correct and help me understand the concept deeper?`;
      } else {
        contextData.initialPrompt = `I answered "${data.user_answer}" but the correct answer is "${data.correct_answer}".\n\nQuestion: "${data.question_text}"\n\nHelp me understand why my answer was wrong and why the correct answer is right.`;
      }
    } 
    else if (type === "flashcard") {
      contextData.flashcard = {
        question: data.question,
        answer: data.answer,
        topics: data.topics
      };
      contextData.initialPrompt = `I'm stuck on this flashcard and need help understanding it. Do NOT give me the full answer directly.\n\nQuestion: "${data.question}"\n\nPlease:\n1. Explain the key concept being tested in simple terms (2-3 sentences)\n2. Give me a hint or clue to help me figure out the answer\n3. Suggest how I should think about this (e.g., "Think about what happens when X...")\n4. If it's a definition, break it into parts I can reason about\n\nGuide me to the answer without spelling it out.`;
    }
    else if (type === "teachit") {
      contextData.teachit = {
        question: data.question,
        model_answer: data.model_answer
      };
      contextData.initialPrompt = `Help me understand how to explain this concept:\n\n"${data.question}"\n\nGive me hints on how to structure my explanation without giving me the full answer.`;
    }
    else if (type === "document") {
      contextData.selectedText = data.selectedText;
      contextData.initialPrompt = `Explain this section from my notes:\n\n"${data.selectedText}"\n\nBreak it down in simple terms.`;
    }

    // Desktop: dispatch event for AITutorPanel, Mobile: open sheet modal
    if (isMobile) {
      openWithContext(contextData);
    } else {
      // Dispatch event that AITutorPanel listens to
      window.dispatchEvent(new CustomEvent('askAIFromContext', { detail: contextData }));
    }
  };

  const sizeClasses = size === "sm" 
    ? "px-2 py-1 text-[10px] gap-1" 
    : "px-3 py-1.5 text-xs gap-1.5";

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center ${sizeClasses} bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-95`}
    >
      <HelpCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      <span>I don't know</span>
    </button>
  );
}