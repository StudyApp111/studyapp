import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FORMAT_META = {
  flashcards: { label: 'Flashcards', active: 'bg-red-600 text-white border-red-500 shadow-md', activeLight: 'bg-red-600 text-white border-red-700 shadow-md' },
  teach_it: { label: 'Feynman', active: 'bg-red-600 text-white border-red-500 shadow-md', activeLight: 'bg-red-600 text-white border-red-700 shadow-md' },
  practice_exam: { label: 'Practice Questions', active: 'bg-red-600 text-white border-red-500 shadow-md', activeLight: 'bg-red-600 text-white border-red-700 shadow-md' },
};

export default function CramSetup({ settings, onChange, topicOptions, weakTopics, inventory, isDark, onStart }) {
  const toggle = (key, arr) => {
    const exists = arr.includes(key);
    const next = exists ? arr.filter(i => i !== key) : [...arr, key];
    return next.length ? next : [key];
  };

  const availableCounts = useMemo(() => {
    const sel = settings.topics.length ? settings.topics : topicOptions;
    const f = inventory.flashcards.filter(f => f.topics?.some(t => sel.includes(t)) || sel.includes('General Concepts')).length;
    const t = inventory.teachIt.filter(t => sel.includes(t.topic) || sel.includes('General Concepts')).length;
    let p = 0;
    inventory.exams.forEach(ex => {
      if (sel.includes(ex.focus_competency) || sel.includes('General Concepts')) p += ex.questions?.length || 0;
    });
    return { flashcards: f, teach_it: t, practice_exam: p };
  }, [settings.topics, topicOptions, inventory]);

  const recommendedTopics = topicOptions.filter(t => weakTopics.includes(t));
  const otherTopics = topicOptions.filter(t => !weakTopics.includes(t));

  let totalItemsAvailable = 0;
  settings.formats.forEach(f => { totalItemsAvailable += availableCounts[f] || 0; });

  return (
    <Card className={`p-5 md:p-6 border-2 shadow-sm ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-6 border-b pb-4 border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Sprint Configuration</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Customize your focused study session</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-black ${totalItemsAvailable > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>{totalItemsAvailable} items</div>
          <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Available</div>
        </div>
      </div>

      <div className="space-y-6">
        <Section label="Study Formats" description="Select the types of materials to pull from your inventory." isDark={isDark}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMAT_META).map(([key, meta]) => {
              const on = settings.formats.includes(key);
              const count = availableCounts[key];
              return (
                <button key={key}
                  onClick={() => onChange({ ...settings, formats: toggle(key, settings.formats) })}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${on ? (isDark ? meta.active : meta.activeLight) : (isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}`}
                >
                  {meta.label}
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${on ? 'bg-white/20 text-white hover:bg-white/20' : ''}`}>{count}</Badge>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section label="Session Length" isDark={isDark}>
            <div className="flex gap-2">
              {[5, 10, 15].map((m) => (
                <Chip key={m} active={settings.durationMinutes === m} isDark={isDark} onClick={() => onChange({ ...settings, durationMinutes: m })}>{m} min</Chip>
              ))}
            </div>
          </Section>
          <Section label="Items to Serve" isDark={isDark}>
            <div className="flex gap-2">
              {[6, 12, 18, 30].map((c) => (
                <Chip key={c} active={settings.itemCount === c} isDark={isDark} onClick={() => onChange({ ...settings, itemCount: c })}>{c} items</Chip>
              ))}
            </div>
          </Section>
        </div>

        {recommendedTopics.length > 0 && (
          <Section label="Recommended Topics" description="Based on your weak areas" isDark={isDark}>
            <div className="flex flex-wrap gap-2">
              {recommendedTopics.map(topic => (
                <TopicBtn key={topic} topic={topic} on={settings.topics.includes(topic)} isWeak={true} isDark={isDark} onClick={() => onChange({ ...settings, topics: toggle(topic, settings.topics) })} />
              ))}
            </div>
          </Section>
        )}

        {otherTopics.length > 0 && (
          <Section label={recommendedTopics.length > 0 ? "Other Topics" : "Select Topics"} isDark={isDark}>
            <div className="flex flex-wrap gap-2">
              {otherTopics.map(topic => (
                <TopicBtn key={topic} topic={topic} on={settings.topics.includes(topic)} isWeak={false} isDark={isDark} onClick={() => onChange({ ...settings, topics: toggle(topic, settings.topics) })} />
              ))}
            </div>
          </Section>
        )}
      </div>

      <Button 
        onClick={onStart} 
        disabled={totalItemsAvailable === 0}
        className="w-full mt-8 h-14 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:via-rose-700 hover:to-red-800 text-white font-bold text-lg rounded-xl shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
      >
        <Zap className="w-5 h-5 mr-2" />
        {totalItemsAvailable === 0 ? 'No Items Available to Cram' : 'Start Cram Sprint'}
      </Button>
      {totalItemsAvailable === 0 && (
        <p className={`text-xs text-center mt-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Generate more Flashcards or Feynman cards in their tabs first.</p>
      )}
    </Card>
  );
}

function TopicBtn({ topic, on, isWeak, isDark, onClick }) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2 rounded-full border text-xs md:text-sm font-medium transition-all ${on ? (isDark ? 'bg-red-600 text-white border-red-500 shadow-md' : 'bg-red-600 text-white border-red-700 shadow-md') : (isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}`}>
      {topic}
      {isWeak && !on && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-[#12121a] rounded-full animate-pulse" title="Weak Topic" />}
    </button>
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
  const activeClass = isDark ? 'bg-red-600 text-white border-red-500 shadow-md' : 'bg-red-600 text-white border-red-700 shadow-md';
  const inactiveClass = isDark ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  return <button onClick={onClick} className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${active ? activeClass : inactiveClass}`}>{children}</button>;
}