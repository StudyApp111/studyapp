import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dialog, 
  DialogContent 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  ChevronRight,
  Upload,
  Lightbulb
} from "lucide-react";

const GOOD_EXAMPLES = [
  { icon: "📚", text: "Chapter 5 - Photosynthesis (Biology 101)" },
  { icon: "📖", text: "Lecture notes from Week 3: French Revolution" },
  { icon: "📄", text: "Uploaded PDF of my calculus textbook Ch. 7" },
  { icon: "📝", text: "Study guide for Psychology midterm - Memory & Learning" },
];

const BAD_EXAMPLES = [
  { icon: "❌", text: "I need help with my quiz" },
  { icon: "❌", text: "Math" },
  { icon: "❌", text: "Study for test" },
  { icon: "❌", text: "Science homework" },
];

const TIPS = [
  "Upload your actual notes or textbook chapters for best results",
  "Include the specific chapter or topic you're studying",
  "Mention your course name (e.g., CHEM 101, AP Biology)",
  "Be specific about what you want to learn",
];

export default function ContentGuideModal({ open, onOpenChange, onContinue }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleContinue = () => {
    if (currentStep < 1) {
      setCurrentStep(1);
    } else {
      onContinue?.();
      onOpenChange(false);
      setCurrentStep(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] max-h-[85vh] p-0 gap-0 rounded-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          {currentStep === 0 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-4 py-4 text-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Pro Tip</h2>
                    <p className="text-white/80 text-xs">Get better results with specific content</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Good Examples */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-semibold text-slate-900 text-sm">Great Examples</h3>
                  </div>
                  <div className="space-y-1.5">
                    {GOOD_EXAMPLES.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                        <span className="text-sm">{ex.icon}</span>
                        <span className="text-xs text-emerald-800">{ex.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bad Examples */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-slate-900 text-sm">Too Vague</h3>
                  </div>
                  <div className="space-y-1.5">
                    {BAD_EXAMPLES.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="text-sm">{ex.icon}</span>
                        <span className="text-xs text-amber-800 line-through opacity-70">{ex.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleContinue}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  Got it!
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Best Practice</h2>
                    <p className="text-white/80 text-xs">Upload your actual study materials</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Upload recommendation */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-0.5">Upload is Best!</h4>
                      <p className="text-xs text-slate-600">
                        PDFs or lecture slides give us the exact content you need.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-2">Quick Tips</h3>
                  <div className="space-y-1.5">
                    {TIPS.slice(0, 3).map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-slate-900">{idx + 1}</span>
                        </div>
                        <span className="text-xs text-slate-700">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleContinue}
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Creating
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}