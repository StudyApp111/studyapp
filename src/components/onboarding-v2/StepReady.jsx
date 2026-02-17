import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function StepReady({ displayName, onComplete, onBack }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleUpload = async () => {
    await onComplete();
    navigate(createPageUrl("CreateLesson"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="text-center space-y-6 py-6"
    >
      {/* Celebration emoji */}
      <motion.div
        className="text-6xl"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        🧠
      </motion.div>

      <div className="space-y-2">
        <h2
          className={`text-2xl md:text-3xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          You're all set, {displayName || "there"}!
        </h2>
        <p
          className={`text-lg font-semibold ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          Are you ready to lock in? 🧠
        </p>
        <p
          className={`text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Click 'Upload Notes' to get started
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className={`${
            isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleUpload}
          className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/20"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload Notes
        </Button>
      </div>
    </motion.div>
  );
}