import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import {
  FileText, BookMarked, Zap, Brain, Target, Headphones, FlameKindling
} from "lucide-react";

/**
 * LessonSideNav — Replaces the global sidebar items when user is inside a lesson.
 * Same rail width (w-20). Clicks update `?tab=` to switch the active activity
 * inside DocumentViewer without remounting (Option A: URL param tab switching).
 */
export default function LessonSideNav({
  isDark,
  hasDocument,
  showStudyPlanDot,
  showFlashcardsDot,
  showTeachItDot,
  showExamDot,
  isCramActive,
  showCramTab,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(location.search);
  const lessonId = urlParams.get('id') || urlParams.get('lessonId');
  const currentTab = urlParams.get('tab') || 'notes';

  const setTab = (tab) => {
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    if (lessonId && !params.get('id')) params.set('id', lessonId);
    navigate(`${createPageUrl("DocumentViewer")}?${params.toString()}`, { replace: true });
  };

  // Notes is the primary landing surface. The source document is reachable
  // via a "Document" button inside the notes toolbar — no dedicated tab needed.
  const items = [
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'flashcards', label: 'Flashcards', icon: BookMarked, dot: showFlashcardsDot },
    { id: 'exam', label: 'Quizzes', icon: Zap, dot: showExamDot },
    { id: 'teachit', label: 'Teach It', icon: Brain, dot: showTeachItDot },
    { id: 'studyplan', label: 'Plan', icon: Target, dot: showStudyPlanDot },
    { id: 'learn', label: 'Learn', icon: Headphones },
    ...(showCramTab ? [{ id: 'cram', label: 'Cram', icon: FlameKindling, activePulse: isCramActive }] : []),
  ];

  return (
    <motion.div
      key="lesson-nav"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col h-full flex-1"
    >
      {/* Lesson activities — logo at top of sidebar (in Layout) handles Home navigation */}
      <nav className="flex-1 flex flex-col items-center gap-1 px-2 py-3">
        {items.map((item, idx) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 + idx * 0.03 }}
              onClick={() => setTab(item.id)}
              className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'bg-purple-600/20 text-purple-400 shadow-sm'
                  : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">{item.label}</span>
              {item.dot && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {item.activePulse && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </motion.button>
          );
        })}
      </nav>
    </motion.div>
  );
}