import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Clean, modern CTA card for Generate Notes / Flashcards / Teach It
 * Replaces the old heavy purple gradient blocks.
 */
export default function GenerateToolCTA({ 
  icon: Icon, 
  title, 
  description, 
  features = [],
  buttonLabel, 
  onGenerate, 
  onCustomize,
  accentColor = "purple" // purple, amber, violet
}) {
  const { isDark } = useTheme();

  const colorMap = {
    purple: { 
      iconBg: isDark ? 'bg-purple-500/15' : 'bg-purple-50', 
      iconText: isDark ? 'text-purple-400' : 'text-purple-600',
      btnGradient: 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700',
      featureDot: isDark ? 'bg-purple-400' : 'bg-purple-500',
      ring: isDark ? 'border-purple-500/20' : 'border-purple-100'
    },
    amber: { 
      iconBg: isDark ? 'bg-amber-500/15' : 'bg-amber-50', 
      iconText: isDark ? 'text-amber-400' : 'text-amber-600',
      btnGradient: 'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700',
      featureDot: isDark ? 'bg-amber-400' : 'bg-amber-500',
      ring: isDark ? 'border-amber-500/20' : 'border-amber-100'
    },
    violet: { 
      iconBg: isDark ? 'bg-violet-500/15' : 'bg-violet-50', 
      iconText: isDark ? 'text-violet-400' : 'text-violet-600',
      btnGradient: 'from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700',
      featureDot: isDark ? 'bg-violet-400' : 'bg-violet-500',
      ring: isDark ? 'border-violet-500/20' : 'border-violet-100'
    }
  };

  const c = colorMap[accentColor] || colorMap.purple;

  return (
    <div className={`flex items-center justify-center p-4 pb-8 w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className={`rounded-2xl border p-6 md:p-8 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} shadow-sm`}>
          {/* Icon + Title */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center mb-4`}>
              <Icon className={`w-7 h-7 ${c.iconText}`} />
            </div>
            <h3 className={`text-xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            <p className={`text-sm leading-relaxed max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {description}
            </p>
          </div>

          {/* Features */}
          {features.length > 0 && (
            <div className={`rounded-xl border p-3 mb-5 space-y-2 ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.featureDot}`} />
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{f}</span>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <Button
            onClick={onGenerate}
            className={`w-full h-12 bg-gradient-to-r ${c.btnGradient} text-white font-semibold rounded-xl shadow-lg`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {buttonLabel}
          </Button>
          
          {onCustomize && (
            <button
              onClick={onCustomize}
              className={`w-full mt-2 text-sm font-medium py-2 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              Customize options
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}