import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock3 } from "lucide-react";

const FORMAT_LABELS = { flashcards: 'Flashcards', teach_it: 'Feynman', practice_exam: 'Practice Questions' };
const FORMAT_BADGE = {
  flashcards: { dark: 'bg-amber-500/20 text-amber-300 border-amber-500/30', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  teach_it: { dark: 'bg-violet-500/20 text-violet-300 border-violet-500/30', light: 'bg-violet-50 text-violet-700 border-violet-200' },
  practice_exam: { dark: 'bg-blue-500/20 text-blue-300 border-blue-500/30', light: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function buildPrompt(format, topic) {
  if (format === 'flashcards') return { title: `Flashcard recall: ${topic}`, body: `State the core idea behind ${topic} in one or two lines.`, hint: `Focus on the definition or mechanism.` };
  if (format === 'teach_it') return { title: `Teach it simply: ${topic}`, body: `Explain ${topic} as if teaching a beginner.`, hint: null };
  return { title: `Practice question: ${topic}`, body: `What matters most about ${topic}, and how would you use it on a test?`, hint: `Connect it to an exam-style use case.` };
}

export default function CramSprint({ lesson, settings, topicOptions, isDark, onFinish, onExit }) {
  const [secondsLeft, setSecondsLeft] = useState(settings.durationMinutes * 60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [completed, setCompleted] = useState(0);

  const queue = useMemo(() => {
    const fmts = settings.formats.length ? settings.formats : ['flashcards'];
    return Array.from({ length: settings.itemCount }, (_, i) => ({ format: fmts[i % fmts.length], order: i + 1 }));
  }, [settings]);

  const activeTopics = settings.topics.length ? settings.topics : topicOptions;

  useEffect(() => {
    const timer = setInterval(() => { setSecondsLeft((prev) => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; }); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const finished = secondsLeft === 0 || currentIndex >= queue.length;
  useEffect(() => { if (finished) onFinish(completed); }, [finished]);

  if (finished) return null;

  const item = queue[currentIndex];
  const topic = activeTopics[currentIndex % Math.max(activeTopics.length, 1)] || lesson?.course_name || 'General';
  const prompt = buildPrompt(item.format, topic);
  const badge = FORMAT_BADGE[item.format] || FORMAT_BADGE.flashcards;

  const handleNext = () => { setCompleted((c) => c + 1); setResponse(""); setCurrentIndex((i) => i + 1); };

  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-2xl mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <Card className={`p-4 border ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Timed sprint</p>
            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Item {currentIndex + 1} of {queue.length}</h3>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
            <Clock3 className="w-4 h-4" />
            <span className="text-sm font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
          </div>
        </div>
      </Card>

      <Card className={`p-5 border ${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Badge className={isDark ? badge.dark : badge.light}>{FORMAT_LABELS[item.format]}</Badge>
          <Badge className={isDark ? 'bg-white/5 text-slate-300 border-white/10' : 'bg-slate-50 text-slate-700 border-slate-200'}>{topic}</Badge>
        </div>

        <h4 className={`font-bold text-base mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{prompt.title}</h4>
        <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{prompt.body}</p>

        {item.format === 'flashcards' && prompt.hint ? (
          <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Quick recall target</p>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{prompt.hint}</p>
          </div>
        ) : (
          <textarea
            value={response} onChange={(e) => setResponse(e.target.value)}
            placeholder="Write your answer..."
            className={`w-full min-h-[140px] mb-4 rounded-xl border p-3 text-sm resize-none ${isDark ? 'bg-[#0a0a12] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
          />
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onExit} className="flex-1">Exit</Button>
          <Button onClick={handleNext} className="flex-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white font-bold">Next item</Button>
        </div>
      </Card>
    </div>
  );
}