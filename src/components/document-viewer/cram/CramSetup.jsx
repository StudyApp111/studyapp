import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings2, Zap, AlertTriangle } from "lucide-react";

const FORMAT_META = {
  flashcards: { label: 'Flashcards', active: 'bg-purple-600 text-white border-purple-500 shadow-md', activeLight: 'bg-purple-600 text-white border-purple-700 shadow-md' },
  teach_it: { label: 'Feynman', active: 'bg-purple-600 text-white border-purple-500 shadow-md', activeLight: 'bg-purple-600 text-white border-purple-700 shadow-md' },
  practice_exam: { label: 'Practice Questions', active: 'bg-purple-600 text-white border-purple-500 shadow-md', activeLight: 'bg-purple-600 text-white border-purple-700 shadow-md' },
};

export default function CramSetup({ settings, onChange, topicOptions, weakTopics, isDark, onStart }) {
  const toggle = (key, arr) => {
    const exists = arr.includes(key);
    const next = exists ? arr.filter(i => i !== key) : [...arr, key];
    return next.length ? next : [key];
  };

  return (
    <Card className={`p-5 md:p-6 border-2 shadow-sm ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-6 border-b pb-4 border-slate-200 dark:border-white/10">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
          <Settings2 className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
        </div>
        <div>
          <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Sprint Configuration</h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Customize your focused study session</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Formats */}
        <Section label="Study Formats" description="Select the types of questions you want to encounter." isDark={isDark}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMAT_META).map(([key, meta]) => {
              const on = settings.formats.includes(key);
              return (
                <button key={key}
                  onClick={() => onChange({ ...settings, formats: toggle(key, settings.formats) })}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${on ? (isDark ? meta.active : meta.activeLight) : (isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}`}
                >{meta.label}</button>
              );
            })}
          </div>
        </Section>

        {/* Duration and Item Count Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section label="Session Length" isDark={isDark}>
            <div className="flex gap-2">
              {[5, 10, 15].map((m) => (
                <Chip key={m} active={settings.durationMinutes === m} isDark={isDark}
                  onClick={() => onChange({ ...settings, durationMinutes: m })}
                >{m} min</Chip>
              ))}
            </div>
          </Section>

          <Section label="Items Served" isDark={isDark}>
            <div className="flex gap-2">
              {[6, 12, 18].map((c) => (
                <Chip key={c} active={settings.itemCount === c} isDark={isDark}
                  onClick={() => onChange({ ...settings, itemCount: c })}
                >{c} items</Chip>
              ))}
            </div>
          </Section>
        </div>

        {/* Topics */}
        {topicOptions.length > 0 && (
          <Section label="Target Topics" description="Select specific topics. Weak areas are highlighted with a red dot." isDark={isDark}>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map((topic) => {
                const on = settings.topics.includes(topic);
                const isWeak = weakTopics?.includes(topic);
                
                return (
                  <button key={topic}
                    onClick={() => onChange({ ...settings, topics: toggle(topic, settings.topics) })}
                    className={`relative px-4 py-2 rounded-full border text-xs md:text-sm font-medium transition-all ${
                      on 
                        ? (isDark ? 'bg-purple-600 text-white border-purple-500 shadow-md' : 'bg-purple-600 text-white border-purple-700 shadow-md') 
                        : (isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')
                    }`}
                  >
                    {topic}
                    {isWeak && !on && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-[#12121a] rounded-full animate-pulse" title="Weak Topic" />
                    )}
                  </button>
                );
              })}
            </div>
            {settings.topics.length === 0 && (
              <p className={`text-xs mt-2 italic ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
                No topics selected. We will cycle through all topics.
              </p>
            )}
          </Section>
        )}
      </div>

      <Button 
        onClick={onStart} 
        className="w-full mt-8 h-14 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold text-lg rounded-xl shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02]"
      >
        <Zap className="w-5 h-5 mr-2" />
        Start Cram Sprint
      </Button>
    </Card>
  );
}

function Section({ label, description, isDark, children }) {
  return (
    <div>
      <p className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}</p>
      {description && <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>}
      {children}
    </div>
  );
}

function Chip({ active, isDark, onClick, children }) {
  const activeClass = isDark ? 'bg-purple-600 text-white border-purple-500 shadow-md' : 'bg-purple-600 text-white border-purple-700 shadow-md';
  const inactiveClass = isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${active ? activeClass : inactiveClass}`}
    >
      {children}
    </button>
  );
}