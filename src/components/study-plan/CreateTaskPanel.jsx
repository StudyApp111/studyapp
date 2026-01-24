import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Layers, Brain, FileText, Zap, X, Sparkles, ChevronRight, Lightbulb
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TASK_TYPES = [
  { 
    id: 'flashcards', 
    icon: Layers, 
    label: 'Flashcards',
    description: 'Master key terms and concepts',
    gradient: 'from-amber-500 to-orange-600',
    target_count: 10
  },
  { 
    id: 'teach_it', 
    icon: Brain, 
    label: 'Teach It',
    description: 'Explain concepts in your own words',
    gradient: 'from-violet-500 to-purple-600',
    target_count: 3
  },
  { 
    id: 'practice_exam', 
    icon: Zap, 
    label: 'Practice Quiz',
    description: 'Test your knowledge with questions',
    gradient: 'from-blue-500 to-indigo-600',
    target_count: 1
  },
  { 
    id: 'review_notes', 
    icon: FileText, 
    label: 'Review Notes',
    description: 'Re-read and highlight key sections',
    gradient: 'from-emerald-500 to-teal-600',
    target_count: 1
  }
];

export default function CreateTaskPanel({ 
  isOpen, 
  onClose, 
  suggestedTopics = [], 
  onCreateTask 
}) {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [step, setStep] = useState(1); // 1 = topic, 2 = format

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    setCustomTopic('');
    setStep(2);
  };

  const handleCustomTopicSubmit = () => {
    if (customTopic.trim()) {
      setSelectedTopic({ topic_name: customTopic.trim(), topic_description: '', topic_reason: 'Custom topic' });
      setStep(2);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    // Create the task immediately
    onCreateTask({
      topic: selectedTopic,
      taskType: type.id,
      target_count: type.target_count
    });
    // Reset and close
    handleReset();
  };

  const handleReset = () => {
    setSelectedTopic(null);
    setCustomTopic('');
    setSelectedType(null);
    setStep(1);
    onClose();
  };

  const handleBack = () => {
    setSelectedType(null);
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
      <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-2xl border-2 border-purple-200 p-4 mt-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Create Custom Task</h4>
              <p className="text-[10px] text-slate-500">
                {step === 1 ? 'Step 1: Choose a topic' : 'Step 2: Choose format'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
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
              {/* Suggested Topics */}
              {suggestedTopics.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">
                      AI Suggested Topics
                    </span>
                  </div>
                  <div className="space-y-2">
                    {suggestedTopics.map((topic, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTopicSelect(topic)}
                        className="w-full text-left p-3 bg-white rounded-xl border border-purple-200 hover:border-purple-400 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:from-purple-200 group-hover:to-indigo-200 transition-colors">
                            <Lightbulb className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm leading-tight">
                              {topic.topic_name}
                            </p>
                            {topic.topic_description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {topic.topic_description}
                              </p>
                            )}
                            {topic.topic_reason && (
                              <Badge className="mt-1.5 bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0">
                                {topic.topic_reason}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Topic Input */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Or enter your own topic
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g., Cell Division, Quadratic Equations..."
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomTopicSubmit()}
                  />
                  <Button
                    onClick={handleCustomTopicSubmit}
                    disabled={!customTopic.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl"
                  >
                    Next
                  </Button>
                </div>
              </div>
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
              <div className="bg-purple-100 rounded-xl p-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900 flex-1">
                  {selectedTopic?.topic_name}
                </span>
                <button
                  onClick={handleBack}
                  className="text-[10px] text-purple-600 hover:text-purple-800 font-medium"
                >
                  Change
                </button>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Choose how you want to learn it
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type)}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                        <type.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{type.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
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