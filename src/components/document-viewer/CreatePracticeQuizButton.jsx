import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import CustomizeGenerationModal from "@/components/modals/CustomizeGenerationModal";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

export default function CreatePracticeQuizButton({ lesson, extractedContent, onExamCreated, diagnosticCompleted = false }) {
  const { isDark } = useTheme();
  const { canDoTask, incrementTaskCount, triggerUpgradeModal } = useSubscription();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const generatingRef = React.useRef(false);

  const handleGenerate = async (customOptions = null) => {
    if (isGenerating || generatingRef.current) return;
    
    const taskCheck = await canDoTask('practice_exam');
    if (!taskCheck.allowed) {
      triggerUpgradeModal('practice_quiz');
      return;
    }
    
    generatingRef.current = true;
    setIsGenerating(true);

    try {
      const { data } = await base44.functions.invoke('generatePracticeExam', {
        lesson_id: lesson.id,
        focus_topics: customOptions?.topics || [],
        target_competency: customOptions?.topics?.[0] || '',
        misconception_addressed: '',
        amount: 10,
        difficulty: customOptions?.difficulty || 'mixed',
        question_types: customOptions?.question_types || [],
        custom_instructions: customOptions?.custom_instructions || ''
      });

      if (data?.success && data.exam) {
        await incrementTaskCount('practice_exam');
        if (onExamCreated) onExamCreated(data.exam);
      }
    } catch (error) {
      console.error("Error generating practice quiz:", error);
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  };

  // Always show — user can create a practice quiz at any time, even before
  // the diagnostic, because they may want to practice specific topics first.
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          onClick={() => setShowCustomize(true)}
          disabled={isGenerating}
          className="w-full h-14 rounded-2xl font-bold text-base shadow-lg bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating Quiz...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Create a New Practice Quiz
            </>
          )}
        </Button>
        <p className={`text-center text-[11px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Pick topics, difficulty, and number of questions
        </p>
      </motion.div>

      <CustomizeGenerationModal
        open={showCustomize}
        onOpenChange={setShowCustomize}
        type="practice_quiz"
        lessonId={lesson?.id}
        compressedContent={lesson?.compressed_content || extractedContent}
        onGenerate={(opts) => handleGenerate(opts)}
      />
    </>
  );
}