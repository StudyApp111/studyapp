import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Copy, Brain, Zap, Sparkles } from "lucide-react";

export default function LiveProgressCounts({ lessonId }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!lessonId) return;
    loadCounts();

    // Subscribe to real-time updates
    const unsubs = [
      base44.entities.Flashcard.subscribe(() => loadCounts()),
      base44.entities.TeachItCard.subscribe(() => loadCounts()),
      base44.entities.Exam.subscribe(() => loadCounts()),
    ];
    return () => unsubs.forEach(u => u());
  }, [lessonId]);

  const loadCounts = async () => {
    try {
      const [flashcards, teachItCards, exams] = await Promise.all([
        base44.entities.Flashcard.filter({ lesson_id: lessonId }),
        base44.entities.TeachItCard.filter({ lesson_id: lessonId }),
        base44.entities.Exam.filter({ lesson_id: lessonId }),
      ]);

      const practiceExams = exams.filter(e => e.exam_type === 'practice');

      setCounts({
        flashcards: { total: flashcards.length, mastered: flashcards.filter(c => c.mastered).length },
        feynman: { total: teachItCards.length, mastered: teachItCards.filter(c => c.mastered).length },
        questions: { 
          total: practiceExams.reduce((sum, e) => sum + (e.questions?.length || 0), 0),
          mastered: practiceExams.reduce((sum, e) => sum + (e.questions?.filter(q => q.is_correct)?.length || 0), 0)
        },
      });
    } catch (err) {
      console.warn('Error loading progress counts:', err);
    }
  };

  if (!counts) {
    return (
      <div className="relative mt-2 pt-2 border-t border-white/20">
        <p className="text-white/70 text-[10px] leading-relaxed">
          <Sparkles className="w-3 h-3 inline mr-0.5 text-yellow-300" />
          Complete tasks below to improve your predicted grade.
        </p>
      </div>
    );
  }

  const items = [
    { icon: Copy, label: "Flashcards", ...counts.flashcards },
    { icon: Zap, label: "Questions", ...counts.questions },
    { icon: Brain, label: "Feynman", ...counts.feynman },
  ].filter(i => i.total > 0);

  if (items.length === 0) {
    return (
      <div className="relative mt-2 pt-2 border-t border-white/20">
        <p className="text-white/70 text-[10px] leading-relaxed">
          <Sparkles className="w-3 h-3 inline mr-0.5 text-yellow-300" />
          Start study tasks below to improve your predicted grade.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-2 pt-2 border-t border-white/20 flex items-center gap-3 flex-wrap">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <item.icon className="w-3 h-3 text-white/60" />
          <span className="text-white font-bold text-[11px]">{item.mastered}</span>
          <span className="text-white/50 text-[10px]">/ {item.total}</span>
          <span className="text-white/40 text-[9px]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}