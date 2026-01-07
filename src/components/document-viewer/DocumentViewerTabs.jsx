import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Copy, Highlighter, StickyNote, Search, Sparkles, X, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const HIGHLIGHT_COLORS = {
  yellow: { bg: '#fef08a', border: '#fde047', name: 'Yellow' },
  green: { bg: '#bbf7d0', border: '#86efac', name: 'Green' },
  blue: { bg: '#bfdbfe', border: '#93c5fd', name: 'Blue' },
  pink: { bg: '#fbcfe8', border: '#f9a8d4', name: 'Pink' },
  purple: { bg: '#e9d5ff', border: '#d8b4fe', name: 'Purple' }
};

export default function DocumentViewerTabs({ lesson }) {
  const [viewMode, setViewMode] = useState("transcript");
  const [searchQuery, setSearchQuery] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [pendingHighlightColor, setPendingHighlightColor] = useState(null);
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const contentRef = useRef(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (lesson?.id) {
      loadAnnotations();
    }
  }, [lesson?.id]);

  const loadAnnotations = async () => {
    try {
      const annots = await base44.entities.Annotation.filter({ lesson_id: lesson.id });
      setAnnotations(annots);
    } catch (error) {
      console.error("Error loading annotations:", error);
    }
  };

  const handleTextSelection = () => {
    if (showNoteInput) return;
    
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const start = extractedContent.indexOf(text);
      const end = start + text.length;
      
      setToolbarPosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.top - 10 
      });
      setSelectedText(text);
      setSelectionRange({ start, end });
      setShowToolbar(true);
    }
  };

  const handleHighlight = async (color) => {
    if (!selectedText || !selectionRange) return;
    
    try {
      await base44.entities.Annotation.create({
        lesson_id: lesson.id,
        highlight_text: selectedText,
        note: "",
        color: color,
        position: selectionRange
      });
      
      await loadAnnotations();
      closeToolbar();
      toast.success("Highlighted!");
    } catch (error) {
      console.error("Error adding highlight:", error);
      toast.error("Failed to save highlight");
    }
  };

  const handleAddNote = () => {
    setPendingHighlightColor('yellow');
    setShowNoteInput(true);
    window.getSelection().removeAllRanges();
  };

  const handleSaveNote = async () => {
    if (!selectedText || !selectionRange) return;
    
    try {
      await base44.entities.Annotation.create({
        lesson_id: lesson.id,
        highlight_text: selectedText,
        note: noteText,
        color: pendingHighlightColor || 'yellow',
        position: selectionRange
      });
      
      await loadAnnotations();
      closeToolbar();
      toast.success("Note saved!");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to save note");
    }
  };

  const handleAskAI = () => {
    // Dispatch event to AI tutor with selected text
    window.dispatchEvent(new CustomEvent('askAIFromContext', { 
      detail: { initialPrompt: `Explain this: "${selectedText}"` }
    }));
    closeToolbar();
    toast.success("Sent to AI Tutor!");
  };

  const closeToolbar = () => {
    setShowToolbar(false);
    setShowNoteInput(false);
    setSelectedText("");
    setSelectionRange(null);
    setNoteText("");
    setPendingHighlightColor(null);
    window.getSelection().removeAllRanges();
  };

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      await base44.entities.Annotation.delete(annotationId);
      await loadAnnotations();
      setActiveAnnotation(null);
      toast.success("Annotation deleted");
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete annotation");
    }
  };

  const handleCopyTranscript = () => {
    if (extractedContent) {
      navigator.clipboard.writeText(extractedContent);
      toast.success("Transcript copied to clipboard");
    }
  };

  const renderHighlightedContent = () => {
    if (!extractedContent) {
      return (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No transcript available</p>
          <p className="text-xs mt-1">Content is being processed...</p>
        </div>
      );
    }
    
    if (searchQuery && searchQuery.length > 0) {
      try {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const parts = extractedContent.split(regex);
        
        return (
          <>
            {parts.map((part, idx) => 
              regex.test(part) ? (
                <mark key={idx} className="bg-yellow-300 px-0.5 rounded">{part}</mark>
              ) : (
                <span key={idx}>{part}</span>
              )
            )}
          </>
        );
      } catch (e) {
        // Invalid regex, just show content
      }
    }
    
    const annotationsWithPositions = annotations.map(a => {
      const textToFind = a.highlight_text;
      const idx = extractedContent.indexOf(textToFind);
      return {
        ...a,
        resolvedStart: idx >= 0 ? idx : (a.position?.start ?? -1),
        resolvedEnd: idx >= 0 ? idx + textToFind.length : (a.position?.end ?? -1)
      };
    }).filter(a => a.resolvedStart >= 0);
    
    const sortedAnnotations = annotationsWithPositions.sort((a, b) => a.resolvedStart - b.resolvedStart);
    
    if (sortedAnnotations.length === 0) {
      return <>{extractedContent}</>;
    }
    
    const elements = [];
    let lastIndex = 0;
    
    sortedAnnotations.forEach((annotation, idx) => {
      const start = annotation.resolvedStart;
      const end = annotation.resolvedEnd;
      
      // Skip if overlapping with previous
      if (start < lastIndex) return;
      
      if (start > lastIndex) {
        const beforeText = extractedContent.substring(lastIndex, start);
        elements.push(
          <span key={`text-${idx}`}>{beforeText}</span>
        );
      }
      
      const highlightedText = extractedContent.substring(start, end);
      const colorConfig = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.yellow;
      
      elements.push(
        <span
          key={`highlight-${annotation.id}`}
          className={`cursor-pointer rounded px-0.5 transition-all hover:ring-2 hover:ring-purple-400 ${
            activeAnnotation?.id === annotation.id ? 'ring-2 ring-purple-500' : ''
          }`}
          style={{ backgroundColor: colorConfig.bg }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveAnnotation(activeAnnotation?.id === annotation.id ? null : annotation);
          }}
        >
          {highlightedText}
          {annotation.note && (
            <StickyNote className="inline w-3 h-3 ml-0.5 text-slate-500" />
          )}
        </span>
      );
      
      lastIndex = end;
    });
    
    if (lastIndex < extractedContent.length) {
      elements.push(
        <span key="text-end">{extractedContent.substring(lastIndex)}</span>
      );
    }
    
    return <>{elements}</>;
  };

  // Click outside to close toolbar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        if (showToolbar && !showNoteInput) {
          closeToolbar();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showToolbar, showNoteInput]);

  const extractedContent = lesson?.extracted_content || "";
  const hasFile = !!lesson?.file_url;

  const isPDF = lesson?.file_url?.toLowerCase().includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(lesson?.file_url || '');
  const isOfficeDoc = /\.(docx?|pptx?|xlsx?)$/i.test(lesson?.file_url || '');

  return (
    <div className="h-full">
      <Card className="h-full bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header with Controls */}
          <div className="border-b border-purple-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              {hasFile && (
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <Button
                    variant={viewMode === "pdf" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("pdf")}
                    className={`text-xs h-7 px-3 ${viewMode === "pdf" ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant={viewMode === "transcript" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("transcript")}
                    className={`text-xs h-7 px-3 ${viewMode === "transcript" ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    <Highlighter className="w-3 h-3 mr-1" />
                    Annotate
                  </Button>
                </div>
              )}
              
              {viewMode === "transcript" && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="pl-7 h-7 text-xs w-32 md:w-48"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyTranscript}
                    className="h-7 text-xs"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            
            {viewMode === "transcript" && (
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                <Highlighter className="w-3 h-3" />
                Select text to highlight, add notes, or ask AI
              </p>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {viewMode === "pdf" && hasFile ? (
              <div className="h-full bg-slate-50 relative">
                {isPDF || isOfficeDoc ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10" id="pdf-loader">
                      <div className="text-center">
                        <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-slate-600">Loading document...</p>
                      </div>
                    </div>
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.file_url)}&embedded=true`}
                      className="w-full h-full border-0 relative z-20"
                      title="Course Document"
                      onLoad={() => {
                        const loader = document.getElementById('pdf-loader');
                        if (loader) loader.style.display = 'none';
                      }}
                    />
                  </>
                ) : isImage ? (
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <img 
                      src={lesson.file_url} 
                      alt="Course Material" 
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 mb-3">Preview not available</p>
                      <Button variant="outline" asChild className="border-purple-200">
                        <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open File
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : viewMode === "transcript" ? (
              <div className="h-full flex">
                {/* Main Content */}
                <div 
                  ref={contentRef}
                  className={`flex-1 overflow-auto p-4 bg-slate-50 ${activeAnnotation ? 'md:w-2/3' : 'w-full'}`}
                  onMouseUp={handleTextSelection}
                >
                  <div 
                    className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-w-none prose prose-sm"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {renderHighlightedContent()}
                  </div>
                </div>
                
                {/* Active Annotation Panel */}
                {activeAnnotation && (
                  <div className="hidden md:block w-1/3 border-l border-purple-200 bg-white p-4 overflow-auto">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900">Annotation</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveAnnotation(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div 
                        className="p-2 rounded-lg text-xs"
                        style={{ 
                          backgroundColor: HIGHLIGHT_COLORS[activeAnnotation.color]?.bg,
                          borderColor: HIGHLIGHT_COLORS[activeAnnotation.color]?.border,
                          borderWidth: 1
                        }}
                      >
                        "{activeAnnotation.highlight_text.substring(0, 200)}{activeAnnotation.highlight_text.length > 200 ? '...' : ''}"
                      </div>
                      
                      {activeAnnotation.note ? (
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <p className="text-xs font-medium text-slate-600 mb-1">Note:</p>
                          <p className="text-sm text-slate-700">{activeAnnotation.note}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No note added</p>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('askAIFromContext', { 
                              detail: { initialPrompt: `Explain this: "${activeAnnotation.highlight_text}"` }
                            }));
                            toast.success("Sent to AI Tutor!");
                          }}
                          className="flex-1 text-xs h-8"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Ask AI
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAnnotation(activeAnnotation.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Floating Selection Toolbar */}
      {showToolbar && selectedText && (
        <div 
          ref={toolbarRef}
          className="fixed z-50 animate-in fade-in zoom-in duration-150"
          style={{ 
            left: `${toolbarPosition.x}px`, 
            top: `${toolbarPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {!showNoteInput ? (
            <div className="bg-slate-900 rounded-lg shadow-2xl p-1.5 flex items-center gap-1">
              {/* Color buttons */}
              {Object.entries(HIGHLIGHT_COLORS).map(([color, config]) => (
                <button
                  key={color}
                  onClick={() => handleHighlight(color)}
                  className="w-6 h-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: config.bg }}
                  title={`Highlight ${config.name}`}
                />
              ))}
              
              <div className="w-px h-5 bg-slate-700 mx-1" />
              
              {/* Add Note */}
              <button
                onClick={handleAddNote}
                className="p-1.5 rounded hover:bg-slate-800 text-white transition-colors"
                title="Add Note"
              >
                <StickyNote className="w-4 h-4" />
              </button>
              
              {/* Ask AI */}
              <button
                onClick={handleAskAI}
                className="p-1.5 rounded hover:bg-slate-800 text-purple-400 transition-colors"
                title="Ask AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-2xl p-3 w-72 border border-slate-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Add a note</span>
                  <button onClick={closeToolbar} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded truncate">
                  "{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}"
                </p>
                
                <div className="flex gap-1">
                  {Object.entries(HIGHLIGHT_COLORS).map(([color, config]) => (
                    <button
                      key={color}
                      onClick={() => setPendingHighlightColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        pendingHighlightColor === color ? 'border-slate-900 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: config.bg }}
                    />
                  ))}
                </div>
                
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Your note..."
                  className="min-h-[60px] text-sm resize-none"
                  autoFocus
                />
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={closeToolbar} className="flex-1 h-8 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNote} className="flex-1 h-8 text-xs bg-purple-600 hover:bg-purple-700">
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}