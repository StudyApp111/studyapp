import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coffee, X } from "lucide-react";

export default function PomodoroTimer({ elapsedSeconds, onBreakComplete }) {
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes in seconds
  const [hasPromptedAt20, setHasPromptedAt20] = useState(false);

  useEffect(() => {
    // Show break prompt every 20 minutes
    if (elapsedSeconds > 0 && elapsedSeconds % 1200 === 0) {
      const currentInterval = Math.floor(elapsedSeconds / 1200);
      if (!hasPromptedAt20 || currentInterval !== Math.floor((elapsedSeconds - 1) / 1200)) {
        setShowBreakPrompt(true);
        setHasPromptedAt20(true);
      }
    }
  }, [elapsedSeconds]);

  useEffect(() => {
    let interval;
    if (isOnBreak && breakTimeLeft > 0) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            setIsOnBreak(false);
            setShowBreakPrompt(false);
            onBreakComplete?.();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOnBreak, breakTimeLeft, onBreakComplete]);

  const handleStartBreak = () => {
    setIsOnBreak(true);
    setBreakTimeLeft(300);
  };

  const handleSkipBreak = () => {
    setShowBreakPrompt(false);
    setIsOnBreak(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={showBreakPrompt || isOnBreak} onOpenChange={(open) => !open && handleSkipBreak()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-amber-600" />
            {isOnBreak ? "Break Time!" : "Time for a Break?"}
          </DialogTitle>
          <DialogDescription>
            {isOnBreak 
              ? "Take a quick break to refresh your mind and come back stronger!" 
              : "You've been studying for 20 minutes. A short break can help improve focus and retention."}
          </DialogDescription>
        </DialogHeader>

        {isOnBreak ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border-2 border-emerald-200 shadow-inner">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600 mb-2">Time Remaining</p>
                <div className="text-6xl font-bold text-emerald-600 font-mono tracking-tight">
                  {formatTime(breakTimeLeft)}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                💡 <strong>Break Tip:</strong> Stand up, stretch, hydrate, or take a short walk to maximize the benefit!
              </p>
            </div>

            <Button
              onClick={handleSkipBreak}
              variant="outline"
              className="w-full"
            >
              End Break Early
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleStartBreak}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                <Coffee className="w-4 h-4 mr-2" />
                Take Break (5 min)
              </Button>
              <Button
                onClick={handleSkipBreak}
                variant="outline"
              >
                Continue Studying
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}