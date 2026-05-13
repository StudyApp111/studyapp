import React from "react";
import { FileText } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Horizontal pill switcher for multi-document lessons.
 * Renders nothing when there's 0 or 1 document.
 * Each pill displays a derived filename label (Doc 1, Doc 2, ...) plus the
 * filename from the URL when available.
 */
export default function DocumentSwitcher({ fileUrls = [], activeIndex = 0, onChange }) {
  const { isDark } = useTheme();

  if (!fileUrls || fileUrls.length <= 1) return null;

  // Derive a short display label from each file URL
  const getLabel = (url, idx) => {
    try {
      const path = new URL(url).pathname;
      const filename = decodeURIComponent(path.split('/').pop() || '');
      // Strip the random base44 prefix (e.g. "abc123_originalname.pdf" -> "originalname.pdf")
      const cleaned = filename.replace(/^[a-f0-9]+_/i, '');
      return cleaned || `Document ${idx + 1}`;
    } catch {
      return `Document ${idx + 1}`;
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2 border-b ${
        isDark ? 'bg-[#0a0a12] border-white/10' : 'bg-slate-50 border-purple-200'
      }`}
    >
      <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mr-1 ${
        isDark ? 'text-slate-500' : 'text-slate-500'
      }`}>
        {fileUrls.length} Docs
      </span>
      {fileUrls.map((url, idx) => {
        const isActive = idx === activeIndex;
        const label = getLabel(url, idx);
        return (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => onChange(idx)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              isActive
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : isDark
                  ? 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                  : 'bg-white text-slate-700 hover:bg-purple-50 border border-purple-200'
            }`}
            title={label}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="max-w-[120px] truncate">
              {label.length > 22 ? `Doc ${idx + 1}` : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}