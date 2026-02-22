import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, BookOpen, ChevronRight, Check, X, ListChecks, FileText, ToggleLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";
import TopicPickerView from "./TopicPickerView";

const QUESTION_TYPES = [
  { id: "Multiple Choice", label: "Multiple Choice", description: "Select the correct answer from options", icon: ListChecks },
  { id: "Short Answer", label: "Long Response", description: "Written answers requiring explanation", icon: FileText },
  { id: "True/False", label: "True/False", description: "Determine if statements are correct", icon: ToggleLeft },
];

export default function CustomizeGenerationModal({ open, onOpenChange, type, lessonId, compressedContent, onGenerate }) {
  const { isDark } = useTheme();
  const isPracticeQuiz = type === "practice_quiz";
  const isFlashcards = type === "flashcards";

  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  // Practice quiz specific
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState(["Multiple Choice", "Short Answer", "True/False"]);

  // Flashcards / Feynman specific
  const defaultAmount = isFlashcards ? 10 : 5;
  const [amount, setAmount] = useState(defaultAmount);
  const minAmount = isFlashcards ? 5 : 3;
  const maxAmount = isFlashcards ? 20 : 10;

  // Load topics from lesson entity or extract them
  useEffect(() => {
    if (!open || !lessonId) return;
    loadTopics();
  }, [open, lessonId]);

  const loadTopics = async () => {
    // First try to load from the lesson's topics field
    try {
      const lessons = await base44.entities.Lesson.filter({ id: lessonId });
      const lesson = lessons[0];
      if (lesson?.topics?.length > 0) {
        setExtractedTopics(lesson.topics);
        return;
      }
    } catch (e) {
      console.warn("Could not load lesson topics:", e);
    }

    // Check localStorage fallback
    const saved = localStorage.getItem(`topics_${lessonId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExtractedTopics(parsed);
          return;
        }
      } catch (e) { /* ignore */ }
    }

    // Extract if we have content and no saved topics
    if (compressedContent && extractedTopics.length === 0) {
      extractTopics();
    }
  };

  const extractTopics = async () => {
    if (!compressedContent || loadingTopics) return;
    setLoadingTopics(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract 6-10 key study topics from this educational content. Identify any structural divisions like chapters, lectures, units, sections, etc.

Content:
${compressedContent.substring(0, 4000)}

Return a JSON object with a "topics" array. Each topic should have:
- "title": The topic/section name
- "description": 1-2 sentence summary
- "subtopics": Optional array of sub-topics (each with title and description)`,
        response_json_schema: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  subtopics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  }
                },
                required: ["title", "description"]
              }
            }
          },
          required: ["topics"]
        }
      });

      if (result?.topics) {
        setExtractedTopics(result.topics);
        localStorage.setItem(`topics_${lessonId}`, JSON.stringify(result.topics));
        
        // Also save to lesson entity for persistence
        try {
          await base44.entities.Lesson.update(lessonId, { topics: result.topics });
        } catch (e) {
          console.warn("Could not save topics to lesson:", e);
        }
      }
    } catch (error) {
      console.error("Error extracting topics:", error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const toggleQuestionType = (typeId) => {
    setSelectedQuestionTypes(prev => {
      if (prev.includes(typeId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(t => t !== typeId);
      }
      return [...prev, typeId];
    });
  };

  // Compute total topic count for display
  const getTotalTopicCount = () => {
    let count = 0;
    extractedTopics.forEach(t => {
      count++;
      if (t.subtopics?.length > 0) count += t.subtopics.length;
    });
    return count;
  };

  const totalTopicCount = getTotalTopicCount();

  const handleGenerate = () => {
    const opts = {
      topics: selectedTopics.length > 0 ? selectedTopics : [],
      custom_instructions: customInstructions.trim() || undefined,
    };

    if (isPracticeQuiz) {
      opts.amount = 10;
      opts.difficulty = "mixed";
      opts.question_types = selectedQuestionTypes;
    } else {
      opts.amount = amount;
      opts.difficulty = "mixed";
    }

    onGenerate(opts);
    onOpenChange(false);
  };

  // If showing topic picker, render it full-screen in the dialog
  if (showTopicPicker) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
          <DialogTitle className="sr-only">Select Topics</DialogTitle>
          <DialogDescription className="sr-only">Choose which topics to focus on</DialogDescription>
          <TopicPickerView
            topics={extractedTopics}
            selectedTopics={selectedTopics}
            onSelectionChange={setSelectedTopics}
            onBack={() => setShowTopicPicker(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-y-auto rounded-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <DialogTitle className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isPracticeQuiz ? 'Test Settings' : isFlashcards ? 'Flashcard Settings' : 'Feynman Settings'}
            </DialogTitle>
            <DialogDescription className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isPracticeQuiz ? 'Configure question types, difficulty, and topics' : 'Configure topics and amount'}
            </DialogDescription>
          </div>
          <button onClick={() => onOpenChange(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className={`p-5 space-y-5 ${isDark ? '' : 'bg-slate-50/50'}`}>
          {/* Question Types - Practice Quiz Only */}
          {isPracticeQuiz && (
            <div className="space-y-2.5">
              <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Question Types
              </Label>
              <div className="space-y-2">
                {QUESTION_TYPES.map((qt) => {
                  const isSelected = selectedQuestionTypes.includes(qt.id);
                  const Icon = qt.icon;
                  return (
                    <button
                      key={qt.id}
                      onClick={() => toggleQuestionType(qt.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? isDark ? 'bg-purple-600/15 border-purple-500/40' : 'bg-purple-50 border-purple-300'
                          : isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        isSelected 
                          ? isDark ? 'bg-purple-600/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                          : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{qt.label}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{qt.description}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount slider - Flashcards & Feynman only */}
          {!isPracticeQuiz && (
            <div className="space-y-2">
              <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Number of {isFlashcards ? 'Flashcards' : 'Cards'}
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={minAmount}
                  max={maxAmount}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value))}
                  className="flex-1 accent-purple-600"
                />
                <span className={`font-bold text-lg w-8 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{amount}</span>
              </div>
            </div>
          )}

          {/* Topics Selector */}
          <div className="space-y-2.5">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Topics
            </Label>
            
            {loadingTopics ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Extracting topics from your material...</span>
              </div>
            ) : extractedTopics.length > 0 ? (
              <button
                onClick={() => setShowTopicPicker(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <BookOpen className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={`flex-1 text-left text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {selectedTopics.length > 0
                    ? `${selectedTopics.length} of ${totalTopicCount} topics selected`
                    : `${totalTopicCount} topics available`
                  }
                </span>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>
            ) : (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No topics detected — all content will be used.
              </p>
            )}
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2.5">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Custom Instructions <span className={`font-normal normal-case ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>(optional)</span>
            </Label>
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
              <Sparkles className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="E.g., 'Test conceptual understanding only', 'Focus on dates'"
                className={`flex-1 bg-transparent border-none outline-none text-sm ${isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex items-center gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`flex-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {isPracticeQuiz
              ? `${selectedQuestionTypes.length} type${selectedQuestionTypes.length !== 1 ? 's' : ''} · Adaptive difficulty`
              : `${amount} ${isFlashcards ? 'flashcards' : 'cards'} · Adaptive difficulty`
            }
          </p>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl px-5"
          >
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}