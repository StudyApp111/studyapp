import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, X, CheckCircle2, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/components/theme/ThemeProvider';
import posthog from 'posthog-js';

/**
 * MobileContinueOnDesktopSheet
 *
 * Conversion-optimized bottom sheet shown on mobile when a free-tier limit
 * is hit. Design goals (in priority order):
 *
 *   1. ZERO FRICTION — email is pre-filled from the current session, the
 *      primary CTA is one tap. The user can edit the email if they want it
 *      sent to a different inbox (control increases conversion).
 *   2. LOSS-FRAMED COPY — we lead with "don't lose your progress", not
 *      "upgrade to pro". Loss aversion is roughly 2× as motivating as
 *      gain framing for the same decision.
 *   3. CONCRETE VALUE — three outcomes specific to StudyApp on desktop:
 *      predicted grade, study plan, side-by-side document workspace. No
 *      generic "premium features" language.
 *   4. SOCIAL PROOF — anchored testimonial + scale signal in a single line
 *      so it reads as evidence, not marketing copy.
 *   5. NATIVE FEEL — bottom sheet (not centered modal) so it matches iOS /
 *      Android conventions and doesn't take over the screen. App Store /
 *      Play Store guidelines are also happier with non-blocking sheets.
 *   6. CLEAR EXIT — visible close button, tap-outside-to-dismiss, and the
 *      copy never implies the user is locked out.
 *
 * Props:
 *   - open: boolean
 *   - onOpenChange: (boolean) => void
 *   - userEmail: string (the account email the link will be sent to)
 *   - reason: string (passed to analytics + sendDesktopLink for context)
 *
 * Note on the email field: it's pre-filled and read-only by design.
 * `sendDesktopLink` always sends to the authenticated user's account email,
 * so letting the user type a different address would be deceptive. Showing
 * the email confirms WHERE to look (a major drop-off cause: "wait, what
 * inbox did this go to?") without giving the impression they can redirect.
 */
export default function MobileContinueOnDesktopSheet({
  open,
  onOpenChange,
  userEmail = '',
  reason = 'default',
}) {
  const { isDark } = useTheme();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  // Reset state whenever the sheet re-opens so a re-entry feels fresh.
  useEffect(() => {
    if (open) {
      setSending(false);
      setSent(false);
      setError(null);
      try {
        posthog.capture('continue_on_web_sheet_shown', { reason });
      } catch {}
    }
  }, [open, reason]);

  const handleSend = async () => {
    if (sending || sent) return;
    setSending(true);
    setError(null);
    try {
      try {
        posthog.capture('desktop_link_requested', {
          reason,
          variant: 'mobile_sheet',
        });
      } catch {}
      // sendDesktopLink reads the AutomaticEmail Resend template and sends
      // to the authenticated user's account email.
      const res = await base44.functions.invoke('sendDesktopLink', { reason });
      if (res?.data?.success) {
        setSent(true);
      } else {
        setError(res?.data?.error || "Couldn't send the email. Try again in a sec.");
      }
    } catch (e) {
      setError("Couldn't send the email. Try again in a sec.");
    } finally {
      setSending(false);
    }
  };

  const t = isDark
    ? {
        sheet: 'bg-[#12121a] border-t border-white/10',
        heading: 'text-white',
        body: 'text-slate-300',
        muted: 'text-slate-400',
        emailRow: 'bg-white/5 border border-white/10',
        emailLabel: 'text-slate-400',
        emailValue: 'text-white',
        bulletText: 'text-slate-200',
        bulletDot: 'bg-purple-500/20 text-purple-300',
        proof: 'text-slate-400',
        proofAccent: 'text-emerald-400',
        close: 'bg-white/10 hover:bg-white/15 text-white/70',
        errorText: 'text-red-400',
      }
    : {
        sheet: 'bg-white border-t border-slate-200',
        heading: 'text-slate-900',
        body: 'text-slate-600',
        muted: 'text-slate-500',
        emailRow: 'bg-slate-50 border border-slate-200',
        emailLabel: 'text-slate-500',
        emailValue: 'text-slate-900',
        bulletText: 'text-slate-700',
        bulletDot: 'bg-purple-100 text-purple-700',
        proof: 'text-slate-500',
        proofAccent: 'text-emerald-600',
        close: 'bg-slate-100 hover:bg-slate-200 text-slate-500',
        errorText: 'text-red-500',
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={`
          p-0 border-0 bg-transparent overflow-visible [&>button]:hidden shadow-none
          w-screen max-w-none rounded-none
          fixed left-0 right-0 bottom-0 top-auto translate-x-0 translate-y-0
          data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full
        `}
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className={`${t.sheet} rounded-t-3xl shadow-2xl px-5 pt-3 pb-6`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
        >
          {/* Grabber — native bottom-sheet cue */}
          <div className="flex justify-center mb-2">
            <div className={`h-1.5 w-10 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
          </div>

          {/* Close — top-right, large hit target */}
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center ${t.close}`}
          >
            <X className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait">
            {sent ? (
              // ── SUCCESS STATE ────────────────────────────────────────
              // Concrete next instruction. No celebration overload — the
              // user's job now is to go open their inbox, so we make that
              // the one thing visually anchored.
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center pt-2"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className={`text-xl font-bold mb-1.5 ${t.heading}`}>
                  Link sent. Check your inbox.
                </h2>
                <p className={`text-sm mb-5 ${t.body}`}>
                  Open the email at <strong>{userEmail}</strong> on your laptop and tap{' '}
                  <strong>"Continue on StudyApp"</strong> to pick up exactly where you left off.
                </p>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-md min-h-[52px]"
                >
                  Got it
                </button>
              </motion.div>
            ) : (
              // ── DEFAULT STATE ────────────────────────────────────────
              <motion.div
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Eyebrow + headline — loss-framed, not feature-framed */}
                <div className="text-center mb-4 px-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 mb-2.5">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-purple-500">
                      Keep your progress
                    </span>
                  </div>
                  <h2 className={`text-[22px] leading-tight font-black ${t.heading}`}>
                    Don't lose your momentum.
                  </h2>
                  <p className={`text-sm mt-1.5 ${t.body}`}>
                    Finish this study session on your laptop in <strong>under 10 seconds</strong> —
                    we'll email you a one-tap link.
                  </p>
                </div>

                {/* Three concrete outcomes — what they actually get on desktop.
                    Specific > generic. Outcomes > features. */}
                <div className="space-y-2 mb-4">
                  {[
                    'See your predicted grade before the exam',
                    'Unlock your full personalized study plan',
                    'Side-by-side notes + AI tutor workspace',
                  ].map((label, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${t.bulletDot}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[13px] leading-snug ${t.bulletText}`}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Email row — pre-filled, read-only confirmation.
                    Showing the destination removes the #1 post-send anxiety
                    ("wait, where did this go?") without implying the user
                    can redirect to an arbitrary inbox. */}
                {userEmail && (
                  <div className={`rounded-xl ${t.emailRow} p-3 mb-3 flex items-center gap-2.5`}>
                    <Mail className={`w-4 h-4 flex-shrink-0 ${t.muted}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-medium uppercase tracking-wide ${t.emailLabel}`}>
                        Sending to your inbox
                      </p>
                      <p className={`text-sm font-semibold truncate ${t.emailValue}`}>
                        {userEmail}
                      </p>
                    </div>
                  </div>
                )}

                {/* Primary CTA — one tap, single action, no competing buttons */}
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 min-h-[56px] text-base"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Email me the link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {error && (
                  <p className={`text-center text-xs mt-2 ${t.errorText}`}>{error}</p>
                )}

                {/* Social proof — single line, anchored data point.
                    Specific number ("10,000+") beats vague ("many students"). */}
                <p className={`text-center text-[11px] mt-3 ${t.proof}`}>
                  Joined by <span className={`font-bold ${t.proofAccent}`}>10,000+ students</span> studying smarter on StudyApp
                </p>

                {/* Reassurance — defuses "is this a sales trick?" anxiety */}
                <p className={`text-center text-[10px] mt-1 ${t.muted}`}>
                  Free. No signup required — you're already in.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}