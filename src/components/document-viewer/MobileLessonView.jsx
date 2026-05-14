import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Clock, X, MessageSquare, BookMarked, Zap, Brain
} from "lucide-react";
import NotesTab from "./NotesTab";
import FlashcardsTab from "./FlashcardsTab";
import TeachItTab from "./TeachItTab";
import ExamTab from "./ExamTab";
import AITutorPanel from "./AITutorPanel";

/**
 * MobileLessonView — Mobile-only lesson shell.
 *
 * Architecture:
 *  - Notes is the persistent base view (always mounted, no horizontal scroll).
 *  - The 4 bottom-nav items (Chat, Flashcards, Quizzes, Teach It) open as
 *    full-screen overlays with an X in the top-right.
 *  - Overlays use forceMount + hidden so their internal state (progress,
 *    selected card, chat history) is preserved across opens — the user can
 *    leave a quiz mid-way, jump to flashcards, and come back to the same
 *    question.
 *  - The top-left chevron always navigates back to Home.
 *
 * The global mobile bottom nav (Home/History/Settings) is hidden via the
 * `lessonNavStateUpdate` event so the lesson bottom nav owns the bottom rail.
 */

const OVERLAY_TABS = [
  { id: 'chat',       label: 'Chat',       icon: MessageSquare },
  { id: 'flashcards', label: 'Flashcards', icon: BookMarked    },
  { id: 'exam',       label: 'Quizzes',    icon: Zap           },
  { id: 'teachit',    label: 'Teach It',   icon: Brain         },
];

export default function MobileLessonView({
  lesson,
  activeTab,
  setActiveTab,
  studyTime,
  formatStudyTime,
  hasDocument,
  exams,
  extractedContent,
  handleExamComplete,
  isDark,
  // AI chat state (lifted from DocumentViewer)
  messages,
  setMessages,
  aiInput,
  setAiInput,
  aiLoading,
  setAiLoading,
}) {
  const navigate = useNavigate();

  // "notes" is the base view; any other activeTab is shown as an overlay.
  const overlayId = activeTab && activeTab !== 'notes' && OVERLAY_TABS.some(t => t.id === activeTab)
    ? activeTab
    : null;

  const openOverlay = (id) => setActiveTab(id);
  const closeOverlay = () => setActiveTab('notes');

  // Close overlay on Android hardware back (popstate). The full lesson page
  // remains; only the overlay dismisses, matching native app expectations.
  useEffect(() => {
    if (!overlayId) return;
    const onPop = () => closeOverlay();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [overlayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerBg = isDark
    ? 'bg-[#12121a]/95 border-white/10'
    : 'bg-white/95 border-slate-200';

  return (
    <div className="md:hidden flex flex-col w-full min-w-0 overflow-x-hidden">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div
        className={`fixed left-0 right-0 z-40 backdrop-blur-md border-b ${headerBg}`}
        style={{ top: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 px-2 py-2 min-w-0">
          <button
            onClick={() => navigate(createPageUrl("Home"))}
            aria-label="Back to Home"
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'text-slate-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lesson?.course_name || 'Loading...'}
            </p>
          </div>

          <div className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
            isDark ? 'bg-white/10' : 'bg-slate-100'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`} />
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
              {formatStudyTime(studyTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Spacer for fixed top bar */}
      <div style={{ height: 'calc(env(safe-area-inset-top, 0px) + 52px)' }} />

      {/* ── Notes (base view, always visible underneath) ──────────────── */}
      <div className="w-full min-w-0 overflow-x-hidden pb-24" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
        <NotesTab lesson={lesson} onViewDocument={hasDocument ? () => {} : undefined} />
      </div>

      {/* ── Bottom nav (4 items, compact height) ──────────────────────── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t ${headerBg}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      >
        <div className="grid grid-cols-4 gap-1 px-2 pt-1.5">
          {OVERLAY_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => openOverlay(t.id)}
                aria-label={t.label}
                data-tour={t.id === 'exam' ? 'exam-tab' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'text-purple-500'
                    : isDark ? 'text-slate-400 active:bg-white/5' : 'text-slate-600 active:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Full-screen overlays (mounted persistently for state retention) ── */}
      {OVERLAY_TABS.map((t) => (
        <Overlay
          key={t.id}
          open={overlayId === t.id}
          title={t.label}
          onClose={closeOverlay}
          isDark={isDark}
        >
          {t.id === 'chat' && (
            <div className="h-full w-full min-w-0 overflow-x-hidden">
              <AITutorPanel
                messages={messages}
                setMessages={setMessages}
                input={aiInput}
                setInput={setAiInput}
                isLoading={aiLoading}
                setIsLoading={setAiLoading}
                lesson={lesson}
              />
            </div>
          )}
          {t.id === 'flashcards' && (
            <FlashcardsTab lesson={lesson} extractedContent={extractedContent} />
          )}
          {t.id === 'exam' && (
            <ExamTab
              lesson={lesson}
              exams={exams}
              onExamComplete={handleExamComplete}
              extractedContent={extractedContent}
            />
          )}
          {t.id === 'teachit' && (
            <TeachItTab lesson={lesson} />
          )}
        </Overlay>
      ))}
    </div>
  );
}

/**
 * Persistent full-screen overlay. Stays mounted at all times so internal
 * component state (quiz progress, selected flashcard, chat history) survives
 * close/reopen. We use a `motion.div` with `animate` driven by `open` — this
 * way the slide-up animation plays correctly without unmounting children,
 * and `pointer-events`/`visibility` ensure it's truly inert when closed.
 */
function Overlay({ open, title, onClose, isDark, children }) {
  const surfaceBg = isDark ? 'bg-[#0a0a12]' : 'bg-white';
  return (
    <motion.div
      initial={false}
      animate={{
        y: open ? 0 : '100%',
        opacity: open ? 1 : 0,
      }}
      transition={{
        type: 'tween',
        ease: open ? [0.22, 1, 0.36, 1] : 'easeIn', // easeOutExpo on open, snappy on close
        duration: 0.28,
      }}
      style={{
        pointerEvents: open ? 'auto' : 'none',
        visibility: open ? 'visible' : 'hidden',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className={`fixed inset-0 z-50 flex flex-col ${surfaceBg}`}
      aria-hidden={!open}
    >
      {/* Overlay header — z-10 keeps it above scrolling body; large hit-area X */}
      <div
        className={`relative z-10 flex-shrink-0 flex items-center justify-between gap-2 px-3 h-14 border-b ${
          isDark ? 'border-white/10' : 'border-slate-200'
        } ${surfaceBg}`}
      >
        <p className={`font-bold text-base truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {title}
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          type="button"
          // 44×44 hit area, icon centered. Explicit type="button" + relative z-index
          // guarantees the click lands on this button (not the scrolling content beneath).
          className={`relative z-10 w-11 h-11 -mr-2 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            isDark ? 'text-slate-200 hover:bg-white/10 active:bg-white/15' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
          }`}
        >
          <X className="w-6 h-6 pointer-events-none" />
        </button>
      </div>

      {/* Overlay body — single surface (no grey/white split), single scroll context */}
      <div className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden ${surfaceBg}`}>
        {children}
      </div>
    </motion.div>
  );
}