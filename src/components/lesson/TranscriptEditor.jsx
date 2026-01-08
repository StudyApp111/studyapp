import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Highlighter, Save, Eraser } from "lucide-react";

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
    <div>
      <div className="flex items-center gap-2 mb-2 bg-purple-50/60 border border-purple-100 rounded-lg p-2">
        <Button size="sm" variant="outline" onClick={() => wrapSelection("mark")} className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-100">
          <Highlighter className="w-4 h-4" /> Highlight
        </Button>
        <Button size="sm" variant="outline" onClick={clearMarks} className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-100">
          <Eraser className="w-4 h-4" /> Clear Highlights
        </Button>
        <div className="ml-auto" />
        <Button size="sm" onClick={save} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-2 ring-2 ring-yellow-400/0 hover:ring-yellow-400/40">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Transcript'}
        </Button>
      </div>

      <div
        ref={ref}
        className="min-h-[60vh] p-4 bg-white rounded-lg border prose max-w-none focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setHtml(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: html || '<p class="text-slate-500">No transcript yet. Paste or type here...</p>' }}
      />
    </div>
  );
}