import React, { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft } from "lucide-react";

export default function StepName({ user, onComplete, onBack }) {
  const { isDark } = useTheme();
  const [name, setName] = useState(() => {
    const saved = sessionStorage.getItem("onboarding_profile_name");
    if (saved) return saved;
    return user?.full_name?.split(" ")[0] || "";
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onComplete({ name: name.trim() || "" });
  };

  const handleSkip = async () => {
    setSubmitting(true);
    await onComplete({ name: "" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-2"
    >
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
          What should we call you? 👋
        </h2>
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          We'll use this to personalize your experience.
        </p>
      </div>

      <div className="space-y-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name (optional)"
          className={`h-12 text-base rounded-xl ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
          }`}
          autoFocus
        />
      </div>

      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="flex items-center gap-3 w-full">
          {onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue →"}
          </Button>
        </div>
        <button
          onClick={handleSkip}
          disabled={submitting}
          className={`text-sm font-medium ${isDark ? 'text-slate-400 hover:text-purple-400' : 'text-slate-500 hover:text-purple-600'} transition-colors disabled:opacity-50`}
        >
          Skip →
        </button>
      </div>
    </motion.div>
  );
}