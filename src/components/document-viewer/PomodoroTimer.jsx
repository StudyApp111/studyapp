import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coffee, Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function PomodoroTimer({ elapsedSeconds, onBreakComplete }) {
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes
  const [isOnBreak, setIsOnBreak] = useState(false);

  useEffect(() => {
    // Check if 20 minutes have passed
    if (elapsedSeconds > 0 && elapsedSeconds % 1200 === 0 && !isOnBreak) {
      setShowBreakModal(true);
      setBreakTimeLeft(300);
    }
  }, [elapsedSeconds, isOnBreak]);

  useEffect(() => {
    if (isOnBreak && breakTimeLeft > 0) {
      const interval = setInterval(() => {
        setBreakTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (isOnBreak && breakTimeLeft === 0) {
      setIsOnBreak(false);
      setShowBreakModal(false);
      onBreakComplete();
    }
  }, [isOnBreak, breakTimeLeft, onBreakComplete]);

  const handleTakeBreak = () => {
    setIsOnBreak(true);
  };

  const handleSkipBreak = () => {
    setShowBreakModal(false);
  };

  const formatBreakTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={showBreakModal} onOpenChange={setShowBreakModal}>
      <DialogContent className="max-w-md">
        {!isOnBreak ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Time for a Break! ☕</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-6 py-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto"
              >
                <Coffee className="w-12 h-12 text-white" />
              </motion.div>
              <div>
                <p className="text-slate-700 text-lg mb-2">You've been studying for 20 minutes</p>
                <p className="text-slate-600">Taking a 5-minute break helps improve focus and retention</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSkipBreak}
                  variant="outline"
                  className="flex-1"
                >
                  Continue Studying
                </Button>
                <Button
                  onClick={handleTakeBreak}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
                >
                  Take Break
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Break Time 🌟</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-6 py-6">
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl font-bold text-white">{formatBreakTime(breakTimeLeft)}</span>
              </div>
              <div>
                <p className="text-slate-700 text-lg mb-2">Relax and recharge</p>
                <p className="text-slate-600 text-sm">
                  Stand up, stretch, grab water, or step outside for fresh air
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div className="p-3 bg-slate-50 rounded-lg">💧 Hydrate</div>
                <div className="p-3 bg-slate-50 rounded-lg">🧘 Stretch</div>
                <div className="p-3 bg-slate-50 rounded-lg">🚶 Walk</div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}