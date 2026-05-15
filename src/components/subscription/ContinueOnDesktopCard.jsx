import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, Monitor, CheckCircle2, LineChart, Sparkles, LayoutDashboard } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/components/theme/ThemeProvider';
import posthog from 'posthog-js';

/**
 * ContinueOnDesktopCard
 *
 * Reusable card that lets a mobile user request a one-tap email link to
 * continue their StudyApp session on a computer. Used in two places:
 *   1. UpgradeModal (when a daily free-tier limit is hit)
 *   2. ExamTab on mobile (next to the diagnostic explainer, since predicted
 *      grade + study plan only render on desktop)
 *
 * Messaging is intentionally framed around the product experience — the
 * desktop has the full predicted-grade dashboard, custom study plan editor,
 * and side-by-side document workspace that don't fit a phone form factor.
 * This is product copy, not subscription/payment copy.
 *
 * Props:
 *   - reason: 'limit_reached' | 'desktop_features' | 'default'
 *   - variant: 'modal' | 'inline'  (visual density)
 *   - userEmail: shown in the success state ("we sent it to you@x.com")
 */
export default function ContinueOnDesktopCard({
  reason = 'default',
  variant = 'inline',
  userEmail,
}) {
  const { isDark } = useTheme();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSendLink = async () => {
    if (sending || sent) return;
    setSending(true);
    setError(null);
    try {
      try {
        posthog.capture('desktop_link_requested', {
          reason,
          variant,
          device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
        });
      } catch {}

      const res = await base44.functions.invoke('sendDesktopLink', { reason });
      if (res?.data?.success) {
        setSent(true);
      } else {
        setError(res?.data?.error || 'Could not send the email. Try again in a moment.');
      }
    } catch (e) {
      setError('Could not send the email. Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  // Reason-specific heading copy. Each variant is App Store / Play Store safe:
  // we talk about features and product experience, never about subscriptions,
  // pricing, or "buy on the web". The email handles the actual continuation.
  const copy = {
    limit_reached: {
      eyebrow: "You've hit today's free limit",
      title: 'Pick up where you left off on your computer',
      body: 'The full StudyApp experience — your predicted grade dashboard, customizable study plan, and side-by-side document workspace — lives on desktop. We can email you a link to continue your session there.',
    },
    desktop_features: {
      eyebrow: 'See your full study dashboard',
      title: 'Your Predicted Grade + Study Plan are on desktop',
      body: 'The interactive predicted-grade chart and customizable study plan are built for a larger screen. Send yourself a link to open StudyApp on your laptop or tablet whenever you have one nearby.',
    },
    default: {
      eyebrow: 'Continue on your computer',
      title: 'The full study workspace lives on desktop',
      body: 'Get the interactive predicted-grade chart, custom study plan editor, and side-by-side document view. We can email you a one-tap link to open it on your computer.',
    },
  }[reason] || {};

  const bullets = [
    { icon: LineChart,       label: 'Predicted grade dashboard' },
    { icon: LayoutDashboard, label: 'Custom study plan editor' },
    { icon: Sparkles,        label: 'Side-by-side document workspace' },
  ];

  // ── Visual tokens ──────────────────────────────────────────────────
  const cardClass = variant === 'modal'
    ? (isDark
        ? 'bg-white/5 border border-white/10 rounded-2xl p-5'
        : 'bg-slate-50 border border-slate-200 rounded-2xl p-5')
    : (isDark
        ? 'bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30 rounded-2xl p-4'
        : 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4');

  const titleClass    = isDark ? 'text-white' : 'text-slate-900';
  const eyebrowClass  = isDark ? 'text-purple-300' : 'text-purple-700';
  const bodyClass     = isDark ? 'text-slate-300' : 'text-slate-600';
  const bulletClass   = isDark ? 'text-slate-200' : 'text-slate-700';

  // ── Success state ──────────────────────────────────────────────────
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cardClass}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wide mb-1 text-emerald-500`}>
              Email sent
            </p>
            <h3 className={`text-base font-bold mb-1 leading-tight ${titleClass}`}>
              Check your inbox{userEmail ? ` at ${userEmail}` : ''}
            </h3>
            <p className={`text-xs leading-relaxed ${bodyClass}`}>
              Open the email on your laptop, tablet, or desktop and tap the button to continue your StudyApp session there. The link goes to <strong>app.studyappai.com</strong>.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Default state ──────────────────────────────────────────────────
  return (
    <div className={cardClass}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-md">
          <Monitor className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {copy.eyebrow && (
            <p className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${eyebrowClass}`}>
              {copy.eyebrow}
            </p>
          )}
          <h3 className={`text-base font-bold leading-tight ${titleClass}`}>
            {copy.title}
          </h3>
        </div>
      </div>

      <p className={`text-xs leading-relaxed mb-3 ${bodyClass}`}>
        {copy.body}
      </p>

      <ul className="space-y-1.5 mb-4">
        {bullets.map(({ icon: Icon, label }) => (
          <li key={label} className={`flex items-center gap-2 text-xs ${bulletClass}`}>
            <Icon className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSendLink}
        disabled={sending}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white text-sm font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]"
      >
        {sending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending link…
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" />
            Email me the desktop link
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}