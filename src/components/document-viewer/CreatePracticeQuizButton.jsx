import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import CustomizeGenerationModal from "@/components/modals/CustomizeGenerationModal";

export default function CreatePracticeQuizButton({ lesson, extractedContent, onExamCreated }) {
  const { isDark } = useTheme();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const handleGenerate = async (customOptions = null) => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const { data } = await base44.functions.invoke('generatePracticeExam', {
        lesson_id: lesson.id,
        focus_topics: customOptions?.topics || [],
        target_competency: customOptions?.topics?.[0] || '',
        misconception_addressed: '',
        amount: customOptions?.amount || 10,
        difficulty: customOptions?.difficulty || 'mixed'
      });

      if (data?.success && data.exam) {
        if (onExamCreated) onExamCreated(data.exam);
      }
    } catch (error) {
      console.error("Error generating practice quiz:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3"
      >
        <Button
          onClick={() => setShowCustomize(true)}
          disabled={isGenerating}
          className={`w-full h-11 rounded-xl font-semibold text-sm shadow-md ${
            isDark 
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white' 
              : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Quiz...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create Practice Quiz
            </>
          )}
        </Button>
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