import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { motion } from "framer-motion";

export default function NameInput({ value, onChange, onNext, onBack }) {
  const [name, setName] = useState(value || '');

  const handleInputChange = (e) => {
    const val = e.target.value;
    setName(val);
    onChange(val);
  };

  const handleNext = () => {
    if (name.trim()) {
      onNext(name);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && name.trim()) {
      handleNext();
    }
  };

  return (
    <div className="relative p-6 md:p-8 space-y-6 bg-white rounded-2xl shadow-2xl overflow-hidden">
      {/* Floating animated element — lightweight idle motion */}
      <motion.div
        className="absolute top-4 right-4 text-3xl select-none pointer-events-none z-0"
        animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        ✏️
      </motion.div>
      
      {/* Header */}
      <div className="text-center space-y-3 relative z-10">
        <motion.div
          className="text-6xl mb-2"
          animate={{ rotate: [0, 14, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
        >
          👋
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">What's your name?</h2>
        <p className="text-slate-600 text-sm">We'll predict your grade in 5 quick questions — let's start with your name.</p>
      </div>

      {/* Input */}
      <div className="space-y-3 relative z-10">
        <Input
          type="text"
          placeholder="Enter your first name"
          value={name}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          className="h-14 text-base bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-100 rounded-xl"
          autoFocus
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 justify-center pt-2 relative z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors font-medium rounded-lg"
          >
            ← Back
          </button>
        )}
        <Button
          onClick={handleNext}
          disabled={!name.trim()}
          className="h-12 px-10 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30 rounded-xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}