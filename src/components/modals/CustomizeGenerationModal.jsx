import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, X, CheckCircle2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy", description: "Foundational concepts", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { id: "medium", label: "Medium", description: "Standard exam level", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { id: "hard", label: "Hard", description: "Challenging & deep", color: "bg-red-50 border-red-200 text-red-700" },
  { id: "mixed", label: "Mixed", description: "All difficulty levels", color: "bg-purple-50 border-purple-200 text-purple-700" },
];

export default function CustomizeGenerationModal({ open, onOpenChange, type, lessonId, compressedContent, onGenerate }) {
  const { isDark } = useTheme();
  const [amount, setAmount] = useState(type === "flashcards" ? 10 : 5);
  const [difficulty, setDifficulty] = useState("mixed");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const isFlashcards = type === "flashcards";
  const minAmount = isFlashcards ? 5 : 3;
  const maxAmount = isFlashcards ? 20 : 10;

  // Load topics from localStorage or extract them
  useEffect(() => {
    if (!open || !lessonId) return;

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
  }, [open, lessonId]);

  const extractTopics = async () => {
    if (!compressedContent || loadingTopics) return;
    setLoadingTopics(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract 6-8 key study topics from this educational content. For each topic, provide a clear name and a single sentence description.

Content:
${compressedContent.substring(0, 3000)}

Return ONLY a JSON object with a "topics" array.`,
        response_json_schema: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic_name: { type: "string" },
                  topic_description: { type: "string" }
                },
                required: ["topic_name", "topic_description"]
              }
            }
          },
          required: ["topics"]
        }
      });

      if (result?.topics) {
        setExtractedTopics(result.topics);
        localStorage.setItem(`topics_${lessonId}`, JSON.stringify(result.topics));
      }
    } catch (error) {
      console.error("Error extracting topics:", error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const toggleTopic = (topicName) => {
    setSelectedTopics(prev =>
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

  const addCustomTopic = () => {
    const trimmed = customTopicInput.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics(prev => [...prev, trimmed]);
      setCustomTopicInput("");
    }
  };

  const handleGenerate = () => {
    onGenerate({
      amount,
      difficulty,
      topics: selectedTopics.length > 0 ? selectedTopics : []
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[550px] max-h-[90vh] p-0 gap-0 overflow-y-auto rounded-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              Customize {isFlashcards ? 'Flashcards' : 'Teach It Cards'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-purple-100 text-sm">
            Choose what to focus on and how many to generate.
          </DialogDescription>
        </div>

        <div className={`p-5 space-y-5 ${isDark ? 'bg-[#12121a]' : 'bg-slate-50/50'}`}>
          {/* Amount */}
          <div className="space-y-2">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Number of Cards
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
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {minAmount}–{maxAmount} {isFlashcards ? 'flashcards' : 'cards'}
            </p>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Difficulty
            </Label>
            <RadioGroup
              value={difficulty}
              onValueChange={setDifficulty}
              className="grid grid-cols-2 gap-2"
            >
              {DIFFICULTY_OPTIONS.map((opt) => {
                const isSelected = difficulty === opt.id;
                return (
                  <div key={opt.id}>
                    <RadioGroupItem value={opt.id} id={`diff-${opt.id}`} className="peer sr-only" />
                    <Label
                      htmlFor={`diff-${opt.id}`}
                      className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                        isSelected
                          ? `${opt.color} ring-2 ring-offset-1 ring-purple-500 shadow-sm`
                          : isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-sm">{opt.label}</span>
                      <span className="text-[10px] opacity-80">{opt.description}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Topics */}
          <div className="space-y-2">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Focus Topics <span className={`font-normal normal-case ml-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(Optional – leave empty to cover all)</span>
            </Label>

            {/* Custom topic input */}
            <div className="flex gap-2">
              <Input
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                placeholder="Type your own topic..."
                className={`flex-1 text-sm ${isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : ''}`}
                onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
              />
              <Button onClick={addCustomTopic} disabled={!customTopicInput.trim()} size="sm" className="bg-purple-600 hover:bg-purple-700 px-3">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Selected topics */}
            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedTopics.map((t) => (
                  <Badge
                    key={t}
                    className={`cursor-pointer transition-all ${isDark ? 'bg-purple-600/30 text-purple-200 hover:bg-purple-600/50' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    onClick={() => toggleTopic(t)}
                  >
                    {t}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Extracted topics from material */}
            {loadingTopics ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Extracting topics from your material...</span>
              </div>
            ) : extractedTopics.length > 0 ? (
              <div className="space-y-1.5">
                <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  From your materials
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {extractedTopics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.topic_name);
                    return (
                      <button
                        key={topic.topic_name}
                        onClick={() => toggleTopic(topic.topic_name)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? (isDark ? 'bg-purple-600/30 border-purple-500/50 text-purple-200' : 'bg-purple-100 border-purple-400 text-purple-700')
                            : (isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:border-purple-500/30' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300')
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        {topic.topic_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className={`p-5 border-t flex-col sm:flex-row gap-2 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-100'}`}>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg rounded-xl px-6"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate {amount} {isFlashcards ? 'Flashcards' : 'Cards'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}