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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-200">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => wrapSelection("mark")} 
          className="gap-2"
        >
          <Highlighter className="w-4 h-4" /> Highlight
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={clearMarks} 
          className="gap-2"
        >
          <Eraser className="w-4 h-4" /> Clear
        </Button>
        <div className="ml-auto" />
        <Button 
          size="sm" 
          onClick={save} 
          disabled={saving} 
          className="gap-2 bg-purple-600 hover:bg-purple-700"
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
        className="min-h-[60vh] p-6 focus:outline-none prose max-w-none text-gray-800"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setHtml(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: html || '<p class="text-gray-400 italic">Start typing or paste your notes here...</p>' }}
        style={{ caretColor: '#7c3aed' }}
      />
    </div>
  );
}