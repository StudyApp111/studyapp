import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Zap, BookMarked, Brain, Target, Trophy, ChevronRight, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

  useEffect(() => {
    if (!open || !lesson?.id) return;

    const loadStats = async () => {
      setLoading(true);
      try {
        const [flashcards, teachItCards, exams, plans] = await Promise.all([
          base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
          base44.entities.TeachItCard.filter({ lesson_id: lesson.id }),
          base44.entities.Exam.filter({ lesson_id: lesson.id }),
          base44.entities.StudyPlan.filter({ lesson_id: lesson.id, status: "active" }),
        ]);

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`max-w-[380px] w-[calc(100%-2rem)] mx-auto rounded-2xl p-0 border-0 overflow-hidden ${isDark ? "bg-[#12121a]" : "bg-white"}`}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 px-5 pt-6 pb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: `${20 + i * 15}%`, top: `${30 + (i % 3) * 20}%` }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
              />
            ))}
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3"
          >
            <Trophy className="w-7 h-7 text-yellow-300" />
          </motion.div>
          <h2 className="text-xl font-bold text-white mb-1">Session Complete!</h2>
          <p className="text-white/70 text-sm">{lesson?.course_name}</p>
        </div>

        {/* Study time badge */}
        <div className="px-5 -mt-5 relative z-10">
          <div className={`rounded-xl p-3 flex items-center justify-center gap-3 shadow-lg border ${isDark ? "bg-[#1a1a2e] border-white/10" : "bg-white border-purple-100"}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
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
                  transition={{ delay: i * 0.1 }}
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

        {/* Actions */}
        <div className="px-5 pb-5 pt-2 space-y-2">
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
  );
}