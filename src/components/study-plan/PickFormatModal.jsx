import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Copy, Brain, Zap, Check, X, Sparkles, ChevronRight, BookOpen, Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { base44 } from "@/api/base44Client";
import TopicPickerView from "@/components/modals/TopicPickerView";

const FORMAT_TYPES = [
  { id: "review_notes", label: "Notes", description: "AI-generated study notes", icon: FileText, gradient: "from-emerald-500 to-teal-600" },
  { id: "practice_exam", label: "Practice Test", description: "10-question quiz", icon: Zap, gradient: "from-blue-500 to-indigo-600" },
  { id: "teach_it", label: "Feynman Technique", description: "Explain concepts deeply", icon: Brain, gradient: "from-violet-500 to-purple-600" },
  { id: "flashcards", label: "Flashcards", description: "Master key terms", icon: Copy, gradient: "from-amber-500 to-orange-600" },
];

export default function PickFormatModal({ open, onOpenChange, lessonId, sectionTitle, onGenerate }) {
  const { isDark } = useTheme();
  const [selectedFormats, setSelectedFormats] = useState(["practice_exam"]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

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
        // Pre-select topics matching the section title
        if (sectionTitle) {
          const matching = lesson.topics.find(t => t.title === sectionTitle);
          if (matching) {
            const titles = [matching.title, ...(matching.subtopics || []).map(st => st.title)];
            setSelectedTopics(titles);
          }
        }
        return;
      }
    } catch (e) {
      console.warn("Could not load topics:", e);
    }

    // Fallback: try localStorage
    const saved = localStorage.getItem(`topics_${lessonId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExtractedTopics(parsed);
        }
      } catch (e) { /* ignore */ }
    }
  };

  const toggleFormat = (id) => {
    setSelectedFormats(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== id);
      }
      return [...prev, id];
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

  const handleGenerate = () => {
    onGenerate({
      formats: selectedFormats,
      topics: selectedTopics.length > 0 ? selectedTopics : [],
      custom_instructions: customInstructions.trim() || undefined,
      section_title: sectionTitle
    });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[500px] max-h-[85vh] p-0 gap-0 overflow-y-auto rounded-2xl ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <DialogTitle className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Pick Your Format
            </DialogTitle>
            <DialogDescription className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {sectionTitle || 'Choose how you want to study'}
            </DialogDescription>
          </div>
          <button onClick={() => onOpenChange(false)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className={`p-5 space-y-5 ${isDark ? '' : 'bg-slate-50/50'}`}>
          {/* Format Selection */}
          <div className="space-y-2.5">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pick Your Format
            </Label>
            <div className="space-y-2">
              {FORMAT_TYPES.map((ft) => {
                const isSelected = selectedFormats.includes(ft.id);
                const Icon = ft.icon;
                return (
                  <button
                    key={ft.id}
                    onClick={() => toggleFormat(ft.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? isDark ? 'bg-purple-600/15 border-purple-500/40' : 'bg-purple-50 border-purple-300'
                        : isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${ft.gradient}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{ft.label}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ft.description}</p>
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

          {/* Topics Selector */}
          <div className="space-y-2.5">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Topics
            </Label>
            {extractedTopics.length > 0 ? (
              <button
                onClick={() => setShowTopicPicker(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <BookOpen className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={`flex-1 text-left text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {selectedTopics.length > 0
                    ? `${selectedTopics.length} of ${getTotalTopicCount()} topics selected`
                    : `${getTotalTopicCount()} topics available`
                  }
                </span>
                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>
            ) : (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                All content will be used.
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
                placeholder="E.g., 'Focus on key definitions', 'Include examples'"
                className={`flex-1 bg-transparent border-none outline-none text-sm ${isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex items-center gap-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`flex-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {selectedFormats.length} format{selectedFormats.length !== 1 ? 's' : ''} selected
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