import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, Sparkles, Plus, Brain, Copy, Zap, FileText, Loader2, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

const TASK_TYPES = [
  { 
    id: 'flashcards', 
    icon: Copy, 
    label: 'Flashcards',
    description: 'Master key terms',
    gradient: 'from-amber-500 to-orange-600',
    target_count: 10
  },
  { 
    id: 'teach_it', 
    icon: Brain, 
    label: 'Teach It',
    description: 'Explain concepts',
    gradient: 'from-violet-500 to-purple-600',
    target_count: 3
  },
  { 
    id: 'practice_exam', 
    icon: Zap, 
    label: 'Practice Quiz',
    description: 'Test knowledge',
    gradient: 'from-blue-500 to-indigo-600',
    target_count: 1
  }
];

export default function PracticeTopicsPanel({ 
  isOpen, 
  onClose, 
  lessonId,
  compressedContent,
  onCreateTask 
}) {
  const { isDark } = useTheme();
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [step, setStep] = useState(1); // 1 = topics, 2 = format

  useEffect(() => {
    if (isOpen && extractedTopics.length === 0 && compressedContent) {
      extractTopics();
    }
  }, [isOpen, compressedContent]);

  const extractTopics = async () => {
    if (!compressedContent) return;
    
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract 6-8 key study topics from this educational content. For each topic, provide a clear name and a single sentence description.

Content:
${compressedContent.substring(0, 3000)}

Return ONLY a JSON array with this exact format:
[
  {"topic_name": "Topic Name", "topic_description": "One sentence describing what this topic covers."},
  ...
]`,
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
      }
    } catch (error) {
      console.error("Error extracting topics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    setCustomTopic('');
    setStep(2);
  };

  const handleCustomTopicSubmit = () => {
    if (customTopic.trim()) {
      setSelectedTopic({ topic_name: customTopic.trim(), topic_description: '' });
      setStep(2);
    }
  };

  const handleTypeSelect = (type) => {
    onCreateTask({
      topic: selectedTopic,
      taskType: type.id,
      target_count: type.target_count
    });
    handleReset();
  };

  const handleReset = () => {
    setSelectedTopic(null);
    setCustomTopic('');
    setStep(1);
    onClose();
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className={`rounded-2xl border-2 p-4 mt-3 ${isDark ? 'bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Practice Your Topics</h4>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {step === 1 ? 'Select a topic or enter your own' : 'Choose how to practice'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
          >
            <X className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {/* Custom Topic Input - Always at top */}
              <div className="mb-3">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Enter your own topic..."
                    className={`flex-1 text-sm ${isDark ? 'bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500' : ''}`}
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomTopicSubmit()}
                  />
                  <Button
                    onClick={handleCustomTopicSubmit}
                    disabled={!customTopic.trim()}
                    className="bg-purple-600 hover:bg-purple-700 px-4"
                  >
                    Go
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Extracting topics...</p>
                </div>
              ) : extractedTopics.length > 0 ? (
                <>
                  <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Or select from your materials
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {extractedTopics.map((topic, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTopicSelect(topic)}
                        className={`text-left p-3 rounded-xl border transition-all group ${
                          isDark 
                            ? 'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10' 
                            : 'bg-white border-slate-200 hover:border-purple-400 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-600/30' : 'bg-purple-100'}`}>
                            <Sparkles className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-xs leading-tight mb-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {topic.topic_name}
                            </p>
                            <p className={`text-[10px] leading-tight line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {topic.topic_description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {/* Selected Topic Display */}
              <div className={`rounded-xl p-3 flex items-center gap-2 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
                <Lightbulb className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`text-sm font-medium flex-1 ${isDark ? 'text-purple-200' : 'text-purple-900'}`}>
                  {selectedTopic?.topic_name}
                </span>
                <button
                  onClick={handleBack}
                  className={`text-[10px] font-medium ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-800'}`}
                >
                  Change
                </button>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  How do you want to practice?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {TASK_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type)}
                      className={`p-3 rounded-xl border transition-all text-center group ${
                        isDark 
                          ? 'bg-white/5 border-white/10 hover:border-purple-500/50' 
                          : 'bg-white border-slate-200 hover:border-purple-400 hover:shadow-md'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform`}>
                        <type.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className={`font-semibold text-xs ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{type.label}</p>
                      <p className={`text-[9px] leading-tight mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}