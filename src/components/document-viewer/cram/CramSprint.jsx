import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock3, Sparkles, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MathText from "@/components/math/MathText";
import { base44 } from "@/api/base44Client";
import { awardDailyXP } from "@/components/utils/dailyReset";

export default function CramSprint({ lesson, settings, topicOptions, weakTopics, inventory, isDark, onFinish, onExit }) {
  const [secondsLeft, setSecondsLeft] = useState(settings.durationMinutes * 60);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    let items = [];
    const sel = settings.topics.length ? settings.topics : topicOptions;
    
    if (settings.formats.includes('flashcards')) {
      const validF = inventory.flashcards.filter(f => f.topics?.some(t => sel.includes(t)) || sel.includes('General Concepts'));
      items.push(...validF.map(f => ({ type: 'flashcard', data: f, topic: f.topics?.[0] || 'General Concepts' })));
    }
    if (settings.formats.includes('teach_it')) {
      const validT = inventory.teachIt.filter(t => sel.includes(t.topic) || sel.includes('General Concepts'));
      items.push(...validT.map(t => ({ type: 'teach_it', data: t, topic: t.topic })));
    }
    if (settings.formats.includes('practice_exam')) {
      inventory.exams.forEach(ex => {
        if (sel.includes(ex.focus_competency) || sel.includes('General Concepts')) {
          ex.questions?.forEach(q => { items.push({ type: 'practice_question', data: q, topic: ex.focus_competency, examId: ex.id }); });
        }
      });
    }

    // Shuffle and cap
    items = items.sort(() => Math.random() - 0.5).slice(0, settings.itemCount);
    setQueue(items);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { setSecondsLeft(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; }); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const finished = secondsLeft === 0 || (queue.length > 0 && currentIndex >= queue.length) || (queue.length === 0 && secondsLeft < settings.durationMinutes * 60);
  useEffect(() => { if (finished) onFinish(completed); }, [finished]);

  if (queue.length === 0) return null;
  if (finished) return null;

  const item = queue[currentIndex];
  const progress = (currentIndex / queue.length) * 100;

  const handleNext = () => {
    setCompleted(c => c + 1);
    setCurrentIndex(i => i + 1);
  };

  return (
    <div className={`px-3 py-4 pb-8 w-full max-w-lg mx-auto space-y-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit} className={`text-xs h-8 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
          <X className="w-4 h-4 mr-1"/> Exit
        </Button>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm ${isDark ? 'bg-red-600/20 text-red-300 border border-red-500/30' : 'bg-white text-red-700 border border-red-200'}`}>
          <Clock3 className="w-4 h-4" />
          <span className="text-sm font-bold tabular-nums">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Sprint Progress</span>
          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{currentIndex} / {queue.length}</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
          <motion.div className="h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
          {item.type === 'flashcard' && <SprintFlashcard item={item} onNext={handleNext} isDark={isDark} />}
          {item.type === 'teach_it' && <SprintTeachIt item={item} onNext={handleNext} isDark={isDark} />}
          {item.type === 'practice_question' && <SprintPracticeQuestion item={item} onNext={handleNext} isDark={isDark} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SprintFlashcard({ item, onNext, isDark }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const card = item.data;

  const handleRating = async (rating) => {
    const currentEase = card.ease_factor || 2.5;
    let newEase = currentEase;
    let intervalDays = 0;
    switch (rating) {
      case 'bad': newEase = Math.max(1.3, currentEase - 0.2); intervalDays = 0; break;
      case 'okay': newEase = Math.max(1.3, currentEase - 0.15); intervalDays = 1; break;
      case 'good': intervalDays = Math.round(((card.review_count || 0) + 1) * currentEase); break;
      case 'excellent': newEase = currentEase + 0.15; intervalDays = Math.round(((card.review_count || 0) + 1) * currentEase * 1.5); break;
    }
    const newReviewCount = (card.review_count || 0) + 1;
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
    const newStatus = newReviewCount >= 1 ? 'learning' : 'new';
    const isMastered = (rating === 'excellent' || rating === 'good') && newReviewCount >= 2;

    try {
      await base44.entities.Flashcard.update(card.id, { status: newStatus, review_count: newReviewCount, ease_factor: newEase, next_review: nextReviewDate.toISOString(), last_reviewed: new Date().toISOString(), mastered: isMastered });
      if (rating === 'good' || rating === 'excellent') await awardDailyXP(5, "Flashcard Reviewed");
    } catch(e) { console.error(e); }
    onNext();
  };

  return (
    <div className="w-full relative mt-6" style={{ perspective: '1000px' }}>
      <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: "spring", stiffness: 100 }} style={{ transformStyle: 'preserve-3d' }} className="relative min-h-[300px] cursor-pointer select-none" onClick={() => !isFlipped && setIsFlipped(true)}>
        <Card className={`absolute inset-0 border-0 shadow-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`} style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}>
          <div className="bg-gradient-to-r from-red-500 to-red-700 p-3 flex items-center justify-between">
            <span className="font-semibold text-sm text-white flex items-center gap-2"><Sparkles className="w-4 h-4"/> Flashcard</span>
            <Badge className="bg-white/20 text-white border-transparent text-[10px]">{item.topic}</Badge>
          </div>
          <div className="p-6 flex flex-col items-center justify-center min-h-[240px]">
            <MathText className={`text-lg font-medium leading-relaxed text-center mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.question}</MathText>
            <p className={`text-sm font-bold mt-auto ${isDark ? 'text-red-400' : 'text-red-600'}`}>Tap to reveal answer →</p>
          </div>
        </Card>
        <Card className={`absolute inset-0 border-0 shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gradient-to-br from-emerald-900 to-teal-900' : 'bg-gradient-to-br from-emerald-50 to-teal-50'}`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', transformStyle: 'preserve-3d' }}>
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 flex items-center justify-between">
            <span className="font-semibold text-sm text-white">Answer</span>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center justify-center overflow-y-auto">
            <MathText className={`text-base font-medium leading-relaxed text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.answer}</MathText>
          </div>
        </Card>
      </motion.div>
      {isFlipped && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <p className={`text-xs text-center mb-3 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>How well did you know this?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleRating('bad')} className="h-14 bg-red-500 hover:bg-red-600 text-white flex flex-col"><span className="text-base">❌</span><span className="text-xs">Bad</span></Button>
            <Button onClick={() => handleRating('okay')} className="h-14 bg-orange-500 hover:bg-orange-600 text-white flex flex-col"><span className="text-base">😐</span><span className="text-xs">Okay</span></Button>
            <Button onClick={() => handleRating('good')} className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white flex flex-col"><span className="text-base">✅</span><span className="text-xs">Good</span></Button>
            <Button onClick={() => handleRating('excellent')} className="h-14 bg-blue-500 hover:bg-blue-600 text-white flex flex-col"><span className="text-base">⭐</span><span className="text-xs">Excellent</span></Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function SprintTeachIt({ item, onNext, isDark }) {
  const [userAnswer, setUserAnswer] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const card = item.data;

  const handleGrade = async () => {
    if (!userAnswer.trim()) return;
    setIsGrading(true);
    try {
      const prompt = `You are grading a student's explanation of a concept.
QUESTION: ${card.question}
MODEL ANSWER: ${card.model_answer}
STUDENT'S ANSWER: ${userAnswer}
GRADING CRITERIA: 1. Conceptual Understanding (40%) 2. Explanation Quality (30%) 3. Completeness (30%)
OUTPUT JSON: { "score": number, "feedback": "string", "strengths": ["string"], "gaps": ["string"] }`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: "object", properties: { score: { type: "number" }, feedback: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, gaps: { type: "array", items: { type: "string" } } } } });
      const isMastered = result.score >= 70;
      await base44.entities.TeachItCard.update(card.id, { user_answer: userAnswer, score: result.score, feedback: result.feedback, strengths: result.strengths, gaps: result.gaps, completed: true, mastered: isMastered });
      if (result.score >= 60) await awardDailyXP(15, "Feynman Mastered");
      setFeedback(result);
    } catch(e) { console.error(e); }
    setIsGrading(false);
  };

  if (feedback) {
    return (
      <Card className={`mt-6 p-5 border shadow-xl ${isDark ? 'bg-[#12121a] border-red-500/30' : 'bg-white border-red-200'}`}>
        <div className={`p-4 rounded-xl mb-4 text-center ${feedback.score >= 70 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-orange-500/10 text-orange-600 dark:text-orange-300'}`}>
          <div className="text-2xl font-black mb-1">{feedback.score}/100</div>
          <p className="text-sm font-medium">{feedback.feedback}</p>
        </div>
        <Button onClick={onNext} className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl">Next Item</Button>
      </Card>
    );
  }

  return (
    <Card className={`mt-6 backdrop-blur-xl border shadow-xl overflow-hidden w-full ${isDark ? 'bg-[#12121a]/95 border-red-500/30' : 'bg-white border-red-200/50'}`}>
      <div className={`px-4 py-5 w-full ${isDark ? 'bg-gradient-to-br from-red-900/40 to-rose-900/40' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
        <div className="flex items-center justify-between mb-4">
          <Badge className={isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}>Feynman</Badge>
          <Badge className={isDark ? 'bg-white/5 text-slate-300 border-transparent' : 'bg-slate-200 text-slate-700 border-transparent'}>{item.topic}</Badge>
        </div>
        <MathText className={`text-lg font-bold leading-relaxed break-words ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.question}</MathText>
      </div>
      <div className="p-4 w-full">
        <Textarea value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Explain it simply in your own words..." disabled={isGrading} className={`w-full min-h-[140px] mb-4 text-sm border-2 rounded-xl p-3 resize-none focus:border-red-400 focus:outline-none ${isDark ? 'bg-[#0a0a12] border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-red-100 text-slate-900 placeholder:text-slate-400'}`} />
        <Button onClick={handleGrade} disabled={!userAnswer.trim() || isGrading} className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg">
          {isGrading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Grade Answer'}
        </Button>
      </div>
    </Card>
  );
}

function SprintPracticeQuestion({ item, onNext, isDark }) {
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const q = item.data;

  const handleSelect = async (opt) => {
    if (showAnswer) return;
    setSelectedOpt(opt);
    setShowAnswer(true);
    if (opt === q.correct_answer) await awardDailyXP(10, "Practice Question Correct");
  };

  return (
    <Card className={`mt-6 backdrop-blur-xl border shadow-xl overflow-hidden w-full ${isDark ? 'bg-[#12121a]/95 border-red-500/30' : 'bg-white border-red-200/50'}`}>
      <div className={`px-4 py-5 w-full ${isDark ? 'bg-gradient-to-br from-red-900/40 to-rose-900/40' : 'bg-gradient-to-br from-red-50 to-rose-50'}`}>
        <div className="flex items-center justify-between mb-4">
          <Badge className={isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}>Practice Question</Badge>
          <Badge className={isDark ? 'bg-white/5 text-slate-300 border-transparent' : 'bg-slate-200 text-slate-700 border-transparent'}>{item.topic}</Badge>
        </div>
        <MathText className={`text-base font-bold leading-relaxed break-words ${isDark ? 'text-white' : 'text-slate-900'}`}>{q.question_text}</MathText>
      </div>
      <div className="p-4 space-y-2">
        {q.options?.map((opt, i) => {
          let btnClass = isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800';
          if (showAnswer) {
            if (opt === q.correct_answer) btnClass = 'bg-emerald-500 text-white border-emerald-600 font-bold';
            else if (opt === selectedOpt) btnClass = 'bg-rose-500 text-white border-rose-600';
            else btnClass = isDark ? 'bg-white/5 opacity-50 text-white border-white/10' : 'bg-slate-50 opacity-50 text-slate-800 border-slate-200';
          }
          return <button key={i} onClick={() => handleSelect(opt)} disabled={showAnswer} className={`w-full text-left p-3.5 rounded-xl border transition-all text-sm ${btnClass}`}><MathText>{opt}</MathText></button>;
        })}
        {showAnswer && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="pt-4">
            <div className={`p-4 rounded-xl text-sm mb-4 ${selectedOpt === q.correct_answer ? (isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700')}`}>
              <strong>{selectedOpt === q.correct_answer ? 'Correct!' : 'Incorrect.'}</strong> {q.explanation}
            </div>
            <Button onClick={onNext} className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl">Next Item</Button>
          </motion.div>
        )}
      </div>
    </Card>
  );
}