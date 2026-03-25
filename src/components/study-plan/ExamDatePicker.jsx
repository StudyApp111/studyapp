import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, X } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";

export default function ExamDatePicker({ lesson, onUpdate }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const examDate = lesson?.exam_date ? new Date(lesson.exam_date) : null;

  const handleSelect = async (date) => {
    if (!lesson?.id || saving) return;
    setSaving(true);
    const dateStr = date ? format(date, "yyyy-MM-dd") : null;
    await base44.entities.Lesson.update(lesson.id, { exam_date: dateStr });
    onUpdate?.({ ...lesson, exam_date: dateStr });
    setSaving(false);
    setOpen(false);
  };

  const handleClear = async (e) => {
    e.stopPropagation();
    if (!lesson?.id || saving) return;
    setSaving(true);
    await base44.entities.Lesson.update(lesson.id, { exam_date: null });
    onUpdate?.({ ...lesson, exam_date: null });
    setSaving(false);
  };

  const getCountdownText = () => {
    if (!examDate) return null;
    if (isToday(examDate)) return "Today!";
    const days = differenceInCalendarDays(examDate, new Date());
    if (days < 0) return "Passed";
    if (days === 1) return "Tomorrow";
    return `${days}d left`;
  };

  const countdown = getCountdownText();
  const isUrgent = examDate && differenceInCalendarDays(examDate, new Date()) <= 3 && !isPast(examDate);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            examDate
              ? isUrgent
                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : isDark
                  ? "bg-white/10 text-white/80 hover:bg-white/15"
                  : "bg-white/20 text-white/90 hover:bg-white/30"
              : isDark
                ? "bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/70"
                : "bg-white/15 text-white/60 hover:bg-white/25 hover:text-white/80"
          }`}
        >
          <Calendar className="w-3 h-3" />
          {examDate ? (
            <>
              <span>{format(examDate, "MMM d")}</span>
              {countdown && (
                <span className={`${isUrgent ? "text-red-300" : "text-white/50"}`}>
                  · {countdown}
                </span>
              )}
              <button
                onClick={handleClear}
                className="ml-0.5 rounded-full hover:bg-white/20 p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </>
          ) : (
            <span>Set exam date</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarWidget
          mode="single"
          selected={examDate}
          onSelect={handleSelect}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}