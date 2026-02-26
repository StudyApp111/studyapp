import React, { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Smartphone, Copy, CheckCircle2, ExternalLink } from "lucide-react";

/**
 * Full-screen gate shown in TikTok/Instagram in-app browsers
 * when the user needs to authenticate. Auth buttons are NOT shown here —
 * the user MUST open in their real browser first.
 */
export default function InAppBrowserGate({ title, subtitle }) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 text-center"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
        <Smartphone className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      </div>

      <div className="space-y-2">
        <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
          {title || "Open in your browser to sign in"}
        </h2>
        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          {subtitle || "This app browser doesn't support sign in. Open in Safari or Chrome — it takes 5 seconds!"}
        </p>
      </div>

      {/* Step-by-step instructions */}
      <div className={`rounded-2xl p-5 border space-y-3 text-left ${isDark ? 'bg-white/5 border-white/10' : 'bg-purple-50 border-purple-200'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>How to open:</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>1</span>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Tap the <strong>⋮</strong> or <strong>⋯</strong> menu at the top right
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>2</span>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Select <strong>"Open in browser"</strong> or <strong>"Open in Safari/Chrome"</strong>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>2</span>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Your progress will be there waiting for you!
            </p>
          </div>
        </div>
      </div>

      {/* Copy link as alternative */}
      <button
        onClick={handleCopyLink}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border ${
          copied
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            : isDark
              ? 'bg-white/5 hover:bg-white/10 text-white border-white/10'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm'
        }`}
      >
        {copied ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Link Copied! Paste in your browser
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" />
            Copy Link to Open in Browser
          </>
        )}
      </button>

      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Your lesson progress is automatically saved
      </p>
    </motion.div>
  );
}