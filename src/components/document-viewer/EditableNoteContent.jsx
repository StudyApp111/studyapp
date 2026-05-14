import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

/**
 * EditableNoteContent
 * --------------------
 * Renders a markdown note with two modes:
 *   - View mode: pretty Turbo-style render (ReactMarkdown) + clickable [[term]] hyperlinks
 *     that fire `askAIFromContext` (handled by AITutorPanel) so the user can ask Polly
 *     to explain that term.
 *   - Edit mode: a textarea with the raw markdown source. Save persists via onSave.
 *
 * The [[term]] hyperlink syntax is part of the note generation prompt — see
 * functions/generateLessonNotes.js.
 *
 * Inline editing replaces the previous "highlight / annotate" mode — users can
 * now directly correct, add, or remove content and changes persist to the
 * LessonNote entity.
 */
export default function EditableNoteContent({
  content,
  onSave,
  isDark,
  fontSize,
  isEditing,
  setIsEditing,
  extractText,
  slugify,
  ttsOpen,
  activeTTSSentence,
}) {
  const [draft, setDraft] = useState(content || "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  // Sync draft when content changes externally (e.g. switching between notes)
  useEffect(() => {
    setDraft(content || "");
  }, [content]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (draft === content) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Note saved");
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving note:", err);
      toast.error("Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(content || "");
    setIsEditing(false);
  };

  // Open AI Tutor with this term as context — wired to AITutorPanel's
  // existing `askAIFromContext` event listener.
  const askAboutTerm = (term) => {
    window.dispatchEvent(new CustomEvent("askAIFromContext", {
      detail: { initialPrompt: `Explain "${term}" in the context of this lesson. Keep it concise and use a simple example.` }
    }));
  };

  // Parse [[term]] into a clickable link inside any text node.
  const renderWithTermLinks = (text) => {
    if (typeof text !== "string" || !text.includes("[[")) return text;
    const parts = [];
    const regex = /\[\[([^\]]+?)\]\]/g;
    let lastIdx = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
      const term = match[1].trim();
      parts.push(
        <button
          key={`term-${key++}-${term}`}
          type="button"
          onClick={() => askAboutTerm(term)}
          className={`inline font-semibold underline decoration-2 underline-offset-2 transition-colors cursor-pointer ${
            isDark
              ? "text-purple-300 decoration-purple-500/40 hover:text-purple-200 hover:decoration-purple-400"
              : "text-purple-600 decoration-purple-300 hover:text-purple-700 hover:decoration-purple-500"
          }`}
          title={`Ask AI to explain "${term}"`}
        >
          {term}
        </button>
      );
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  // Walk children recursively so [[term]] links work inside <strong>, <em>, <li>, etc.
  const transformChildren = (children) => {
    return React.Children.map(children, (child) => {
      if (typeof child === "string") return renderWithTermLinks(child);
      if (React.isValidElement(child) && child.props?.children) {
        return React.cloneElement(child, {
          children: transformChildren(child.props.children),
        });
      }
      return child;
    });
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`w-full min-h-[60vh] p-4 rounded-xl border font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
            isDark
              ? "bg-[#0a0a12] border-white/10 text-slate-200 placeholder:text-slate-500"
              : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
          }`}
          placeholder="Edit your note in markdown…"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? "text-slate-300 hover:bg-white/5"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-md shadow-purple-500/30 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // View mode — Turbo-style pretty render with hyperlinks
  const proseSize =
    fontSize === "sm"
      ? "[&_h1]:!text-xl sm:[&_h1]:!text-3xl [&_h2]:!text-base sm:[&_h2]:!text-xl [&_h3]:!text-sm sm:[&_h3]:!text-lg [&_h4]:!text-sm sm:[&_h4]:!text-base [&_p]:!text-xs sm:[&_p]:!text-sm [&_li]:!text-xs sm:[&_li]:!text-sm"
      : fontSize === "lg"
      ? "[&_h1]:!text-3xl sm:[&_h1]:!text-5xl [&_h2]:!text-xl sm:[&_h2]:!text-3xl [&_h3]:!text-lg sm:[&_h3]:!text-2xl [&_h4]:!text-base sm:[&_h4]:!text-xl [&_p]:!text-base sm:[&_p]:!text-lg [&_li]:!text-base sm:[&_li]:!text-lg"
      : "[&_h1]:!text-2xl sm:[&_h1]:!text-4xl [&_h2]:!text-lg sm:[&_h2]:!text-2xl [&_h3]:!text-base sm:[&_h3]:!text-xl [&_h4]:!text-sm sm:[&_h4]:!text-lg [&_p]:!text-sm sm:[&_p]:!text-base [&_li]:!text-sm sm:[&_li]:!text-base";

  const proseStyles = `${proseSize} [&_h1]:!font-black [&_h1]:!border-b [&_h1]:!pb-3 sm:[&_h1]:!pb-4 [&_h1]:!mb-4 sm:[&_h1]:!mb-6 [&_h1]:!leading-tight [&_h2]:!font-bold [&_h2]:!mt-6 sm:[&_h2]:!mt-8 [&_h2]:!mb-2 sm:[&_h2]:!mb-3 [&_h2]:!leading-tight ${isDark ? "[&_h2]:!text-purple-400" : "[&_h2]:!text-purple-700"} [&_h3]:!font-semibold [&_h3]:!mt-4 sm:[&_h3]:!mt-6 [&_h3]:!mb-2 [&_p]:!leading-relaxed [&_p]:!my-2 sm:[&_p]:!my-3 [&_li]:!my-1 [&_strong]:!font-bold ${isDark ? "[&_strong]:!text-white" : "[&_strong]:!text-slate-900"} [&_ul]:!my-3 sm:[&_ul]:!my-4 [&_ol]:!my-3 sm:[&_ol]:!my-4 [&_ul]:!space-y-1 [&_ol]:!space-y-1`;

  return (
    <div className={`prose max-w-none ${isDark ? "prose-invert" : ""} ${proseStyles}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => {
            const text = extractText(children);
            return <h1 id={`heading-${slugify(text)}`}>{transformChildren(children)}</h1>;
          },
          h2: ({ children }) => {
            const text = extractText(children);
            return <h2 id={`heading-${slugify(text)}`}>{transformChildren(children)}</h2>;
          },
          h3: ({ children }) => {
            const text = extractText(children);
            return <h3 id={`heading-${slugify(text)}`}>{transformChildren(children)}</h3>;
          },
          p: ({ children }) => {
            const text = extractText(children);
            const isActive =
              ttsOpen &&
              activeTTSSentence &&
              text &&
              text.toLowerCase().includes(activeTTSSentence.toLowerCase().slice(0, 60));
            return (
              <p
                ref={(el) => {
                  if (el && isActive) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                style={
                  isActive
                    ? {
                        backgroundColor: isDark ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.12)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        margin: "2px -8px",
                        transition: "background-color 0.3s ease",
                      }
                    : undefined
                }
              >
                {transformChildren(children)}
              </p>
            );
          },
          li: ({ children }) => <li>{transformChildren(children)}</li>,
          strong: ({ children }) => <strong>{transformChildren(children)}</strong>,
          em: ({ children }) => <em>{transformChildren(children)}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}