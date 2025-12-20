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
      <DialogContent className="sm:max-w-md mx-4 rounded-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Coffee className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">
              {isOnBreak ? "Break Time!" : "Time for a Break?"}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {isOnBreak 
                ? "Take a quick break to refresh your mind!" 
                : "You've been studying for 20 minutes. A short break can help improve focus."}
            </p>
          </div>
        </div>

        {isOnBreak ? (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
              <div className="text-center">
                <p className="text-xs font-medium text-slate-600 mb-2">Time Remaining</p>
                <div className="text-4xl font-bold text-emerald-600 font-mono tracking-tight">
                  {formatTime(breakTimeLeft)}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900">
                💡 <strong>Tip:</strong> Stand up, stretch, or take a short walk!
              </p>
            </div>

            <Button
              onClick={handleSkipBreak}
              variant="outline"
              className="w-full h-11"
            >
              End Break Early
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleStartBreak}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 h-11"
            >
              <Coffee className="w-4 h-4 mr-2" />
              Take Break (5 min)
            </Button>
            <Button
              onClick={handleSkipBreak}
              variant="outline"
              className="w-full h-11"
            >
              Continue Studying
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}