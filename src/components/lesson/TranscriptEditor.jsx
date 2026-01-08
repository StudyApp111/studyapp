import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Highlighter, Save, Eraser, Sparkles } from "lucide-react";

export default function TranscriptEditor({ lesson, onSaved }) {
  const [html, setHtml] = useState(lesson.extracted_content || "");
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setHtml(lesson.extracted_content || "");
  }, [lesson.extracted_content]);

  const wrapSelection = (tag = "mark") => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!ref.current || !ref.current.contains(range.commonAncestorContainer)) return;
    const el = document.createElement(tag);
    range.surroundContents(el);
  };

  const clearMarks = () => {
    if (!ref.current) return;
    const marks = ref.current.querySelectorAll("mark");
    marks.forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Lesson.update(lesson.id, { extracted_content: ref.current?.innerHTML || "" });
      onSaved?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden shadow-lg">
      <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-purple-50 to-yellow-50/50 border-b border-purple-100">
        <Button 
          size="sm" 
          onClick={() => wrapSelection("mark")} 
          className="gap-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 shadow-sm"
        >
          <Highlighter className="w-4 h-4" /> Highlight
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={clearMarks} 
          className="gap-2 border-purple-200 text-slate-600 hover:bg-purple-50"
        >
          <Eraser className="w-4 h-4" /> Clear
        </Button>
        <div className="ml-auto" />
        <Button 
          size="sm" 
          onClick={save} 
          disabled={saving} 
          className="gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-600/30"
        >
          {saving ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save
            </>
          )}
        </Button>
      </div>

      <div
        ref={ref}
        className="min-h-[65vh] p-6 focus:outline-none prose max-w-none text-slate-800"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setHtml(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: html || '<p class="text-slate-400 italic">Start typing or paste your notes here...</p>' }}
        style={{ caretColor: '#7c3aed' }}
      />
    </div>
  );
}