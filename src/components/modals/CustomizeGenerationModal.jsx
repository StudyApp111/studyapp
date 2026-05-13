import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, BookOpen, ChevronRight, Check, X, ListChecks, FileText, ToggleLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";
import TopicPickerView from "./TopicPickerView";

const QUESTION_TYPES = [
  { id: "Multiple Choice", label: "Multiple Choice", description: "Select the correct answer from options", icon: ListChecks },
  { id: "Short Answer", label: "Long Response", description: "Written answers requiring explanation", icon: FileText },
  { id: "True/False", label: "True/False", description: "Determine if statements are correct", icon: ToggleLeft },
];

const DIFFICULTIES = [
  { id: "easy", label: "Easy", description: "Build confidence with foundational questions" },
  { id: "medium", label: "Medium", description: "Apply concepts to typical problems" },
  { id: "hard", label: "Hard", description: "Tackle challenging, exam-level material" },
  { id: "mixed", label: "Mixed", description: "Adaptive — easy, medium, and hard" },
];

// Per-type configuration: title, item label, amount range
const TYPE_CONFIG = {
  practice_quiz: { title: "Practice Quiz Settings", itemLabel: "questions", min: 5, max: 15, defaultAmount: 10, supportsAmount: true, supportsQuestionTypes: true },
  flashcards:    { title: "Flashcard Settings",     itemLabel: "flashcards", min: 5, max: 20, defaultAmount: 10, supportsAmount: true },
  teach_it:      { title: "Teach It Settings",      itemLabel: "teach it cards", min: 3, max: 10, defaultAmount: 5, supportsAmount: true },
  notes:         { title: "Notes Settings",         itemLabel: "notes", supportsAmount: false },
};

const CUSTOM_INSTRUCTIONS_LIMIT = 200;

export default function CustomizeGenerationModal({ open, onOpenChange, type, lessonId, compressedContent, onGenerate, initialValues = {} }) {
  const { isDark } = useTheme();
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.flashcards;

  const [selectedTopics, setSelectedTopics] = useState(initialValues.topics || []);
  const [customInstructions, setCustomInstructions] = useState(initialValues.custom_instructions || "");
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState(
    initialValues.question_types || ["Multiple Choice", "Short Answer", "True/False"]
  );
  const [amount, setAmount] = useState(initialValues.amount || config.defaultAmount || 10);
  const [difficulty, setDifficulty] = useState(initialValues.difficulty || "mixed");

  // Reset state whenever the modal opens with new initialValues
  useEffect(() => {
    if (open) {
      setSelectedTopics(initialValues.topics || []);
      setCustomInstructions(initialValues.custom_instructions || "");
      setAmount(initialValues.amount || config.defaultAmount || 10);
      setDifficulty(initialValues.difficulty || "mixed");
      if (initialValues.question_types) setSelectedQuestionTypes(initialValues.question_types);
    }
  }, [open]);

  // Load topics from lesson entity or extract them
  useEffect(() => {
    if (!open || !lessonId) return;
    loadTopics();
  }, [open, lessonId]);

  const loadTopics = async () => {
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
                    items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } }
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
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== typeId);
      }
      return [...prev, typeId];
    });
  };

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
      difficulty,
    };
    if (config.supportsAmount) opts.amount = amount;
    if (config.supportsQuestionTypes) opts.question_types = selectedQuestionTypes;

    onGenerate(opts);
    onOpenChange(false);
  };

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

  const charCount = customInstructions.length;
  const charLimitColor = charCount > CUSTOM_INSTRUCTIONS_LIMIT * 0.9
    ? (isDark ? 'text-amber-400' : 'text-amber-600')
    : (isDark ? 'text-slate-500' : 'text-slate-400');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-y-auto rounded-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <DialogTitle className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {config.title}
            </DialogTitle>
            <DialogDescription className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pick topics, difficulty{config.supportsAmount ? `, and number of ${config.itemLabel}` : ''}
            </DialogDescription>
          </div>
          <button onClick={() => onOpenChange(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className={`p-5 space-y-5 ${isDark ? '' : 'bg-slate-50/50'}`}>
          {/* Topics Selector — always shown */}
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
                    : `All ${totalTopicCount} topics`
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

          {/* Difficulty — always shown */}
          <div className="space-y-2.5">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Difficulty
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => {
                const isSelected = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? isDark ? 'bg-purple-600/15 border-purple-500/50' : 'bg-purple-50 border-purple-400'
                        : isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`text-sm font-bold ${isSelected ? (isDark ? 'text-purple-300' : 'text-purple-700') : (isDark ? 'text-slate-200' : 'text-slate-800')}`}>
                      {d.label}
                    </span>
                    <span className={`text-[10px] leading-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {d.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Types — Practice Quiz only */}
          {config.supportsQuestionTypes && (
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
                        isSelected ? 'bg-purple-600 text-white' : isDark ? 'border border-white/20 bg-white/5' : 'border border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount — when supported */}
          {config.supportsAmount && (
            <div className="space-y-2">
              <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Number of {config.itemLabel}
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={config.min}
                  max={config.max}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value))}
                  className="flex-1 accent-purple-600"
                />
                <span className={`font-bold text-lg w-8 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{amount}</span>
              </div>
            </div>
          )}

          {/* Extra Notes (custom_instructions) — 200 char limit */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Extra Notes <span className={`font-normal normal-case ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>(optional)</span>
              </Label>
              <span className={`text-[10px] font-medium ${charLimitColor}`}>
                {charCount}/{CUSTOM_INSTRUCTIONS_LIMIT}
              </span>
            </div>
            <div className={`flex items-start gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
              <Sparkles className={`w-4 h-4 mt-1.5 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <Textarea
                value={customInstructions}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length <= CUSTOM_INSTRUCTIONS_LIMIT) setCustomInstructions(v);
                }}
                placeholder="E.g., 'Focus on conceptual understanding', 'Test dates and key figures', 'Avoid trick questions'"
                rows={2}
                className={`flex-1 bg-transparent border-none outline-none text-sm resize-none focus-visible:ring-0 p-0 min-h-[40px] ${isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex items-center gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`flex-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {config.supportsAmount
              ? `${amount} ${config.itemLabel} · ${DIFFICULTIES.find(d => d.id === difficulty)?.label || 'Mixed'}`
              : `${DIFFICULTIES.find(d => d.id === difficulty)?.label || 'Mixed'} difficulty`
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
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}