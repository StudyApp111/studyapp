import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Target, TrendingUp, Zap, X, ArrowRight } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import posthog from "posthog-js";

/**
 * LessonOnboardingTour
 * ---------------------
 * Minimal, non-intrusive guided coachmark tour that fires ONCE per user
 * (gated via localStorage) the first time they land in DocumentViewer.
 *
 * Goals:
 *  - Showcase the high-value, often-undiscovered features:
 *      • Study Plan tab (desktop)
 *      • Predicted Grade badge (desktop)
 *      • Quizzes tab → diagnostic (mobile, since Study Plan isn't on mobile)
 *  - Stay minimal: one tooltip + spotlight at a time, no weird animations.
 *  - Work on both desktop and mobile by anchoring to DOM elements tagged
 *    with `data-tour="<key>"` attributes.
 *
 * Anchors (added in the existing components):
 *  - data-tour="grade-badge"   → AnimatedGradeBadge in DocumentViewer header
 *  - data-tour="studyplan-tab" → LessonSideNav "Plan" button (desktop only)
 *  - data-tour="exam-tab"      → Quizzes button (mobile overlay nav)
 */

const STORAGE_KEY = "lesson_tour_completed_v1";

export default function LessonOnboardingTour({ lessonReady }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect viewport once (and on resize) — different anchors per layout.
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Decide tour steps based on layout. Desktop highlights Study Plan + Grade
  // (the two premium features the user almost never finds). Mobile highlights
  // the Quizzes tab — because that's the path to unlocking predictions, and
  // Study Plan isn't reachable on mobile by design.
  const steps = isMobile
    ? [
        {
          anchor: "exam-tab",
          icon: Zap,
          title: "Unlock your predicted grade",
          body: "Take a quick diagnostic quiz to get your AI-predicted exam score and personalized study plan.",
          placement: "top",
        },
      ]
    : [
        {
          anchor: "studyplan-tab",
          icon: Target,
          title: "Your AI Study Plan",
          body: "Personalized tasks generated from your weakest topics — built to take you from your current grade to an A+.",
          placement: "right",
        },
        {
          anchor: "grade-badge",
          icon: TrendingUp,
          title: "Predicted exam grade",
          body: "After your diagnostic, see exactly what you'd score on the real exam — and watch it climb as you study.",
          placement: "bottom",
        },
      ];

  // Trigger the tour once the lesson is mounted and DOM is ready.
  useEffect(() => {
    if (!lessonReady) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Delay so anchors mount (sidebar morph, header render) before measuring.
    const t = setTimeout(() => {
      setActive(true);
      try {
        posthog?.capture("lesson_tour_started", { is_mobile: isMobile });
      } catch {}
    }, 900);

    return () => clearTimeout(t);
  }, [lessonReady, isMobile]);

  // Measure the current anchor whenever step changes or window resizes.
  const measure = useCallback(() => {
    if (!active) return;
    const current = steps[step];
    if (!current) return;
    const el = document.querySelector(`[data-tour="${current.anchor}"]`);
    if (!el) {
      // Anchor missing — skip this step gracefully.
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [active, step, steps]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, measure]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setActive(false);
    try {
      posthog?.capture("lesson_tour_completed", { steps_seen: step + 1 });
    } catch {}
  }, [step]);

  const next = () => {
    if (step + 1 >= steps.length) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  if (!active) return null;

  const current = steps[step];
  if (!current) return null;

  // Compute tooltip position relative to the anchor rect. If the anchor isn't
  // found (rect = null), render a centered fallback so we never trap the user.
  const tooltip = computeTooltipPosition(rect, current.placement, isMobile);

  const Icon = current.icon;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={`tour-${step}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9998] pointer-events-auto"
        onClick={next}
      >
        {/* Dim backdrop with cutout for the anchor (spotlight effect) */}
        <SpotlightBackdrop rect={rect} />

        {/* Tooltip card — stops propagation so clicks on it don't advance */}
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute rounded-2xl shadow-2xl border max-w-[320px] w-[calc(100vw-32px)] ${
            isDark
              ? "bg-[#161620] border-white/10 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
          style={tooltip.style}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close (skip whole tour) */}
          <button
            onClick={finish}
            aria-label="Skip tour"
            className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-white/10"
                : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-4 pr-10">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-[15px] leading-tight">{current.title}</h3>
            </div>
            <p
              className={`text-sm leading-relaxed mb-3 ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              {current.body}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-medium ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {step + 1} of {steps.length}
              </span>
              <button
                onClick={next}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {step + 1 >= steps.length ? "Got it" : "Next"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Caret pointing at the anchor */}
          {rect && tooltip.caret && (
            <span
              className={`absolute w-3 h-3 rotate-45 border ${
                isDark
                  ? "bg-[#161620] border-white/10"
                  : "bg-white border-slate-200"
              }`}
              style={tooltip.caret}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/**
 * SpotlightBackdrop — semi-transparent dim layer with a soft "cutout" ring
 * around the anchor element. Uses two stacked divs (no SVG mask) for
 * maximum browser compatibility and zero layout cost.
 */
function SpotlightBackdrop({ rect }) {
  // If we have no rect, just dim the whole screen.
  if (!rect) {
    return <div className="absolute inset-0 bg-black/55" />;
  }

  const pad = 8;
  const ringStyle = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
    borderRadius: 14,
    pointerEvents: "none",
  };

  return (
    <>
      <div className="absolute" style={ringStyle} />
      {/* Subtle pulsing ring for emphasis (purely visual) */}
      <motion.div
        className="absolute pointer-events-none rounded-2xl"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 2px rgba(168, 85, 247, 0.7)",
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

/**
 * Compute tooltip position + caret offset given an anchor rect and desired
 * placement. Falls back to centered if no rect is available, and clamps to
 * the viewport so the card never overflows the edge of the screen.
 */
function computeTooltipPosition(rect, placement, isMobile) {
  const margin = 12;
  const tooltipW = isMobile ? Math.min(320, window.innerWidth - 32) : 320;
  const tooltipH = 160; // approximate; only used for clamping
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    return {
      style: {
        top: vh / 2 - tooltipH / 2,
        left: vw / 2 - tooltipW / 2,
      },
      caret: null,
    };
  }

  let top, left, caret;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  switch (placement) {
    case "right":
      top = cy - 60;
      left = rect.left + rect.width + margin;
      caret = { left: -6, top: 60 - 6 };
      // If overflowing right, fall back to bottom placement.
      if (left + tooltipW > vw - 8) {
        top = rect.top + rect.height + margin;
        left = Math.min(cx - tooltipW / 2, vw - tooltipW - 8);
        caret = { left: cx - left - 6, top: -6 };
      }
      break;
    case "left":
      top = cy - 60;
      left = rect.left - tooltipW - margin;
      caret = { left: tooltipW - 6, top: 60 - 6 };
      break;
    case "top":
      top = rect.top - tooltipH - margin;
      left = cx - tooltipW / 2;
      caret = { left: tooltipW / 2 - 6, top: tooltipH - 6 };
      break;
    case "bottom":
    default:
      top = rect.top + rect.height + margin;
      left = cx - tooltipW / 2;
      caret = { left: tooltipW / 2 - 6, top: -6 };
      break;
  }

  // Clamp to viewport.
  left = Math.max(8, Math.min(left, vw - tooltipW - 8));
  top = Math.max(8, Math.min(top, vh - tooltipH - 8));

  return {
    style: { top, left, width: tooltipW },
    caret,
  };
}