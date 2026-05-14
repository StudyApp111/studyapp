import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "sonner";

/**
 * EditableNoteContent — Turbo-style WYSIWYG editor.
 *
 * One always-editable rich canvas (react-quill) with a toolbar for bold,
 * italic, underline, highlight, headers, lists, blockquotes. There is NO
 * separate view/edit mode — the user can click anywhere and start typing.
 *
 * Storage: notes are saved as HTML. Legacy notes saved in markdown are
 * converted to HTML on the fly when first loaded (and re-saved as HTML the
 * next time the user makes any edit).
 *
 * [[term]] hyperlinks: rendered as clickable purple links in view AND edit
 * mode. Clicking fires the `askAIFromContext` event which AITutorPanel
 * listens for. The links survive editing because they're a real <span class="ai-term">
 * inside the HTML.
 */

// ---------- Markdown → HTML (minimal, just for legacy note migration) ----------

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s) {
  // Order matters: term links first so their content doesn't get re-processed
  let out = escapeHtml(s);
  // [[term]] → clickable span
  out = out.replace(/\[\[([^\]]+?)\]\]/g, (_, term) => {
    const t = term.trim();
    return `<span class="ai-term" data-term="${t.replace(/"/g, "&quot;")}">${t}</span>`;
  });
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italic*
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // `code`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function markdownToHtml(md) {
  if (!md) return "";
  // If it already looks like HTML, pass through.
  if (/<\/(p|h[1-6]|ul|ol|li|blockquote|table)>/i.test(md)) return md;

  const lines = md.split("\n");
  const out = [];
  let i = 0;
  const flushList = (buf, ordered) => {
    if (!buf.length) return;
    out.push(`<${ordered ? "ol" : "ul"}>${buf.map(l => `<li>${inlineFormat(l)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
    buf.length = 0;
  };
  const ulBuf = [];
  const olBuf = [];

  while (i < lines.length) {
    const line = lines[i];
    // Tables
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[-:|\s]+\|?\s*$/.test(lines[i + 1])) {
      flushList(ulBuf, false); flushList(olBuf, true);
      const headerCells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => inlineFormat(c.trim()));
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => inlineFormat(c.trim())));
        i++;
      }
      out.push(
        `<table><thead><tr>${headerCells.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
          .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      );
      continue;
    }
    // Headings
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushList(ulBuf, false); flushList(olBuf, true);
      out.push(`<h${h[1].length}>${inlineFormat(h[2])}</h${h[1].length}>`);
      i++; continue;
    }
    // Blockquote
    if (/^>\s?/.test(line)) {
      flushList(ulBuf, false); flushList(olBuf, true);
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineFormat(quoteLines.join(" "))}</blockquote>`);
      continue;
    }
    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushList(ulBuf, false); flushList(olBuf, true);
      out.push("<hr>"); i++; continue;
    }
    // Unordered list
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) { flushList(olBuf, true); ulBuf.push(ul[1]); i++; continue; }
    // Ordered list
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) { flushList(ulBuf, false); olBuf.push(ol[1]); i++; continue; }
    // Blank line
    if (!line.trim()) { flushList(ulBuf, false); flushList(olBuf, true); i++; continue; }
    // Paragraph
    flushList(ulBuf, false); flushList(olBuf, true);
    out.push(`<p>${inlineFormat(line)}</p>`);
    i++;
  }
  flushList(ulBuf, false); flushList(olBuf, true);
  return out.join("\n");
}

// ---------- Component ----------

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", { background: ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff", false] }],
  [{ list: "ordered" }, { list: "bullet" }, "blockquote"],
  ["link", "clean"],
];

export default function EditableNoteContent({ content, onSave, isDark, toolbarActions = null }) {
  // Convert markdown → HTML once when content arrives. Re-runs when switching notes.
  const initialHtml = useMemo(() => markdownToHtml(content || ""), [content]);
  const [html, setHtml] = useState(initialHtml);
  const saveTimerRef = useRef(null);
  const isInitialRender = useRef(true);
  const containerRef = useRef(null);

  // Sync when switching between notes
  useEffect(() => {
    setHtml(initialHtml);
    isInitialRender.current = true;
  }, [initialHtml]);

  // Debounced autosave whenever the user edits
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await onSave(html);
      } catch (err) {
        console.error("Note autosave failed:", err);
        toast.error("Could not save changes");
      }
    }, 1200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [html]);

  // Delegate clicks on .ai-term spans → fire askAIFromContext.
  // Done at the container level so it works even after Quill rewrites the DOM.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      const target = e.target.closest(".ai-term");
      if (!target) return;
      const term = target.getAttribute("data-term") || target.textContent;
      if (!term) return;
      window.dispatchEvent(new CustomEvent("askAIFromContext", {
        detail: { initialPrompt: `Explain "${term}" in the context of this lesson. Keep it concise and use a simple example.` }
      }));
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  return (
    <div ref={containerRef} className={`turbo-editor ${isDark ? "dark" : ""}`}>
      <style>{`
        .turbo-editor { position: relative; }
        .turbo-editor .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgb(226 232 240)"};
          padding: 8px 130px 8px 4px;
          position: sticky;
          top: 0;
          background: ${isDark ? "#12121a" : "#fff"};
          z-index: 5;
          border-radius: 8px 8px 0 0;
        }
        .turbo-editor .toolbar-actions {
          position: sticky;
          top: 0;
          z-index: 6;
          float: right;
          margin-top: -50px;
          margin-right: 8px;
          height: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          pointer-events: none;
        }
        .turbo-editor .toolbar-actions > * { pointer-events: auto; }
        .turbo-editor .ql-container.ql-snow { border: none; font-family: inherit; }
        .turbo-editor .ql-editor {
          padding: 24px 8px;
          min-height: 60vh;
          font-size: 16px;
          line-height: 1.75;
          color: ${isDark ? "#e2e8f0" : "#0f172a"};
        }
        .turbo-editor .ql-editor h1 { font-size: 2rem; font-weight: 800; margin: 1.5rem 0 1rem; border-bottom: 1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgb(226 232 240)"}; padding-bottom: .5rem; }
        .turbo-editor .ql-editor h2 { font-size: 1.5rem; font-weight: 700; margin: 1.75rem 0 .75rem; color: ${isDark ? "#c4b5fd" : "#7c3aed"}; }
        .turbo-editor .ql-editor h3 { font-size: 1.15rem; font-weight: 600; margin: 1.25rem 0 .5rem; }
        .turbo-editor .ql-editor p { margin: .5rem 0; }
        .turbo-editor .ql-editor ul, .turbo-editor .ql-editor ol { padding-left: 1.5rem; margin: .5rem 0; }
        .turbo-editor .ql-editor li { margin: .25rem 0; }
        .turbo-editor .ql-editor li::marker { color: ${isDark ? "#a78bfa" : "#7c3aed"}; }
        .turbo-editor .ql-editor strong { font-weight: 700; color: ${isDark ? "#fff" : "#0f172a"}; }
        .turbo-editor .ql-editor em { font-style: italic; }
        .turbo-editor .ql-editor blockquote {
          border-left: 4px solid ${isDark ? "#a78bfa" : "#7c3aed"};
          padding: .5rem 1rem;
          margin: 1rem 0;
          background: ${isDark ? "rgba(167,139,250,0.08)" : "rgb(245 243 255)"};
          border-radius: 6px;
          font-style: italic;
        }
        .turbo-editor .ql-editor hr { border: none; border-top: 1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgb(226 232 240)"}; margin: 2rem 0; }
        .turbo-editor .ql-editor table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .turbo-editor .ql-editor th, .turbo-editor .ql-editor td {
          border: 1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgb(226 232 240)"};
          padding: .5rem .75rem;
          text-align: left;
        }
        .turbo-editor .ql-editor th { background: ${isDark ? "rgba(167,139,250,0.12)" : "rgb(245 243 255)"}; font-weight: 700; }
        .turbo-editor .ql-editor .ai-term {
          color: ${isDark ? "#c4b5fd" : "#7c3aed"};
          font-weight: 600;
          text-decoration: underline;
          text-decoration-color: ${isDark ? "rgba(167,139,250,0.4)" : "rgba(124,58,237,0.3)"};
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .turbo-editor .ql-editor .ai-term:hover { text-decoration-color: ${isDark ? "#a78bfa" : "#7c3aed"}; }
        .turbo-editor .ql-toolbar.ql-snow .ql-stroke { stroke: ${isDark ? "#cbd5e1" : "#475569"}; }
        .turbo-editor .ql-toolbar.ql-snow .ql-fill { fill: ${isDark ? "#cbd5e1" : "#475569"}; }
        .turbo-editor .ql-toolbar.ql-snow .ql-picker-label { color: ${isDark ? "#cbd5e1" : "#475569"}; }
        .turbo-editor .ql-toolbar.ql-snow button:hover .ql-stroke,
        .turbo-editor .ql-toolbar.ql-snow button.ql-active .ql-stroke { stroke: ${isDark ? "#a78bfa" : "#7c3aed"}; }
      `}</style>
      <ReactQuill
        theme="snow"
        value={html}
        onChange={setHtml}
        modules={{ toolbar: TOOLBAR }}
        placeholder="Start writing your notes…"
      />
      {toolbarActions && (
        <div className="toolbar-actions" style={{ position: "absolute", top: 8, right: 8, marginTop: 0, height: "auto" }}>
          {toolbarActions}
        </div>
      )}
    </div>
  );
}