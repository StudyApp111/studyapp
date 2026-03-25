import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Zap, BookMarked, Brain, Target, Trophy, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";

const formatDuration = (seconds) => {
  if (!seconds || seconds < 60) return "< 1 min";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
};

export default function PostSessionSummary({ open, onClose, lesson, studyTimeSeconds, onContinue }) {
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!open || !lesson?.id) return;

    setShowConfetti(true);

    const loadStats = async () => {
      setLoading(true);
      try {
        const [flashcards, teachItCards, exams, plans, user] = await Promise.all([
          base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
          base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
          base44.entities.Exam.filter({ lesson_id: lesson.id }),
          base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: "active" }),
          base44.auth.me(),
        ]);

        setStreak(user?.current_streak || 0);

        const fcMastered = flashcards.filter((f) => f.mastered).length;
        const ticCompleted = teachItCards.filter((t) => t.completed).length;
        const examsCompleted = exams.filter((e) => e.completed).length;
        const plan = plans?.[0];
        const tasksCompleted = plan?.tasks?.filter((t) => t.completed).length || 0;
        const totalTasks = plan?.tasks?.length || 0;

        const latestExam = exams
          .filter((e) => e.completed && e.predicted_grade)
          .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];

        setStats({
          flashcardsReviewed: flashcards.length,
          flashcardsMastered: fcMastered,
          teachItCompleted: ticCompleted,
          teachItTotal: teachItCards.length,
          examsCompleted,
          predictedGrade: latestExam?.predicted_grade,
          tasksCompleted,
          totalTasks,
          currentScore: latestExam?.total_score,
        });
      } catch (err) {
        console.error("Error loading session stats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [open, lesson?.id]);

  const statItems = stats
    ? [
        stats.flashcardsReviewed > 0 && {
          icon: BookMarked,
          label: "Flashcards",
          value: `${stats.flashcardsMastered}/${stats.flashcardsReviewed} mastered`,
          color: "from-blue-500 to-blue-600",
        },
        stats.teachItTotal > 0 && {
          icon: Brain,
          label: "Feynman Cards",
          value: `${stats.teachItCompleted}/${stats.teachItTotal} completed`,
          color: "from-pink-500 to-pink-600",
        },
        stats.examsCompleted > 0 && {
          icon: Zap,
          label: "Exams Completed",
          value: `${stats.examsCompleted}`,
          color: "from-amber-500 to-amber-600",
        },
        stats.totalTasks > 0 && {
          icon: Target,
          label: "Study Plan",
          value: `${stats.tasksCompleted}/${stats.totalTasks} tasks done`,
          color: "from-emerald-500 to-emerald-600",
        },
      ].filter(Boolean)
    : [];

  return (
    <>
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />

      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className={`max-w-[380px] w-[calc(100%-2rem)] mx-auto rounded-2xl p-0 border-0 overflow-hidden ${isDark ? "bg-[#12121a]" : "bg-white"}`}
        >
          {/* Header gradient with sparkles */}
          <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 px-5 pt-6 pb-8 text-center relative overflow-hidden">
            {/* Animated sparkle particles */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-yellow-300"
                style={{
                  left: `${8 + (i * 7.5) % 85}%`,
                  top: `${10 + (i * 13) % 70}%`,
                  fontSize: `${10 + (i % 3) * 4}px`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.2, 0],
                  y: [0, -8, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5 + (i % 3) * 0.5,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              >
                ✦
              </motion.div>
            ))}

            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 10, stiffness: 200 }}
              className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3"
            >
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              >
                <Trophy className="w-8 h-8 text-yellow-300" />
              </motion.div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-bold text-white mb-1"
            >
              Session Complete! 🎉
            </motion.h2>
            <p className="text-white/70 text-sm">{lesson?.course_name}</p>
          </div>

          {/* Study time + streak badge */}
          <div className="px-5 -mt-5 relative z-10">
            <div className={`rounded-xl p-3 flex items-center justify-center gap-3 shadow-lg border ${isDark ? "bg-[#1a1a2e] border-white/10" : "bg-white border-purple-100"}`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Time Studied</p>
                <p className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {formatDuration(studyTimeSeconds)}
                </p>
              </div>
              {stats?.predictedGrade && (
                <>
                  <div className={`h-8 w-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                  <div>
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Grade</p>
                    <p className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {stats.predictedGrade}
                    </p>
                  </div>
                </>
              )}
              {streak > 0 && (
                <>
                  <div className={`h-8 w-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                  <div className="text-center">
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Streak</p>
                    <motion.p
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.3 }}
                      className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      🔥 {streak}
                    </motion.p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="px-5 pt-4 pb-2">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : statItems.length > 0 ? (
              <div className="space-y-2">
                {statItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${isDark ? "bg-white/5" : "bg-slate-50"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>{item.label}</p>
                      <p className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>{item.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className={`text-center text-sm py-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Great start! Keep studying to see your progress here.
              </p>
            )}
          </div>

          {/* Streak encouragement */}
          {streak > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className={`mx-5 rounded-lg p-2.5 text-center ${isDark ? "bg-orange-500/10 border border-orange-500/20" : "bg-orange-50 border border-orange-200"}`}
            >
              <p className={`text-xs font-medium ${isDark ? "text-orange-300" : "text-orange-700"}`}>
                🔥 {streak} day streak! Come back tomorrow to keep it going!
              </p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="px-5 pb-5 pt-3 space-y-2">
            <Button
              onClick={onContinue}
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-xl shadow-md"
            >
              <Flame className="w-4 h-4 mr-2" />
              Keep Studying
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              className={`w-full h-9 text-xs ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              End Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}