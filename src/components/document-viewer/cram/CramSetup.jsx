import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FORMAT_META = {
  flashcards: { label: 'Flashcards', active: 'bg-amber-500/20 text-amber-300 border-amber-500/30', activeLight: 'bg-amber-50 text-amber-700 border-amber-200' },
  teach_it: { label: 'Feynman', active: 'bg-violet-500/20 text-violet-300 border-violet-500/30', activeLight: 'bg-violet-50 text-violet-700 border-violet-200' },
  practice_exam: { label: 'Practice Questions', active: 'bg-blue-500/20 text-blue-300 border-blue-500/30', activeLight: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function CramSetup({ settings, onChange, topicOptions, isDark, onStart }) {
  const toggle = (key, arr) => {
    const exists = arr.includes(key);
    const next = exists ? arr.filter(i => i !== key) : [...arr, key];
    return next.length ? next : [key];
  };

  return (
    <Card className={`p-4 border ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="mb-4">
        <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Customize your sprint</h3>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Choose formats, length, and topics.</p>
      </div>

      <div className="space-y-4">
        <Section label="Formats" isDark={isDark}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMAT_META).map(([key, meta]) => {
              const on = settings.formats.includes(key);
              return (
                <button key={key}
                  onClick={() => onChange({ ...settings, formats: toggle(key, settings.formats) })}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold ${on ? (isDark ? meta.active : meta.activeLight) : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200')}`}
                >{meta.label}</button>
              );
            })}
          </div>
        </Section>

        <Section label="Session length" isDark={isDark}>
          <div className="flex gap-2">
            {[5, 10, 15].map((m) => (
              <Chip key={m} active={settings.durationMinutes === m} isDark={isDark}
                color="orange" onClick={() => onChange({ ...settings, durationMinutes: m })}
              >{m} min</Chip>
            ))}
          </div>
        </Section>

        <Section label="Items served" isDark={isDark}>
          <div className="flex gap-2">
            {[6, 12, 18].map((c) => (
              <Chip key={c} active={settings.itemCount === c} isDark={isDark}
                color="blue" onClick={() => onChange({ ...settings, itemCount: c })}
              >{c} items</Chip>
            ))}
          </div>
        </Section>

        {topicOptions.length > 0 && (
          <Section label="Weak topics to target" isDark={isDark}>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map((topic) => {
                const on = settings.topics.includes(topic);
                return (
                  <button key={topic}
                    onClick={() => onChange({ ...settings, topics: on ? settings.topics.filter(t => t !== topic) : [...settings.topics, topic] })}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium ${on ? (isDark ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-violet-50 text-violet-700 border-violet-200') : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200')}`}
                  >{topic}</button>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      <Button onClick={onStart} className="w-full mt-4 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 hover:from-orange-600 hover:via-red-600 hover:to-pink-700 text-white font-bold">
        Start sprint
      </Button>
    </Card>
  );
}

function Section({ label, isDark, children }) {
  return (
    <div>
      <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</p>
      {children}
    </div>
  );
}

const COLOR_MAP = {
  orange: { dark: 'bg-orange-500/20 text-orange-300 border-orange-500/30', light: 'bg-orange-50 text-orange-700 border-orange-200' },
  blue: { dark: 'bg-blue-500/20 text-blue-300 border-blue-500/30', light: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function Chip({ active, isDark, color, onClick, children }) {
  const c = COLOR_MAP[color] || COLOR_MAP.orange;
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-xs font-semibold ${active ? (isDark ? c.dark : c.light) : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200')}`}
    >{children}</button>
  );
}