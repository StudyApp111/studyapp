import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Copy, Highlighter, StickyNote, Search } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function DocumentViewerTabs({ lesson }) {
  const [viewMode, setViewMode] = useState("pdf");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);

  React.useEffect(() => {
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
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPosition({ 
        x: rect.left + rect.width / 2, 
        y: rect.top - 10 
      });
      setSelectedText(text);
      setShowAnnotationPopover(true);
    } else {
      setShowAnnotationPopover(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!selectedText) return;
    
    try {
      await base44.entities.Annotation.create({
        lesson_id: lesson.id,
        highlight_text: selectedText,
        note: noteText,
        color: highlightColor,
        position: { start: 0, end: 0 }
      });
      
      await loadAnnotations();
      setSelectedText("");
      setNoteText("");
      setShowAnnotationPopover(false);
      window.getSelection().removeAllRanges();
      toast.success("Annotation saved");
    } catch (error) {
      console.error("Error adding annotation:", error);
      toast.error("Failed to save annotation");
    }
  };

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      await base44.entities.Annotation.delete(annotationId);
      await loadAnnotations();
      toast.success("Annotation deleted");
    } catch (error) {
      console.error("Error deleting annotation:", error);
      toast.error("Failed to delete annotation");
    }
  };

  const highlightSearchTerm = (text) => {
    if (!searchQuery || !text) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-300 px-1">$1</mark>');
  };

  const handleCopyTranscript = () => {
    if (lesson?.extracted_content) {
      navigator.clipboard.writeText(lesson.extracted_content);
      toast.success("Transcript copied to clipboard");
    }
  };





  if (!lesson?.file_url && !lesson?.extracted_content) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] shadow-xl">
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No document uploaded</p>
            <p className="text-xs text-slate-400 mt-2">This lesson was created from a description</p>
          </div>
        </div>
      </Card>
    );
  }

  const isPDF = lesson?.file_url?.toLowerCase().includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(lesson?.file_url || '');
  const isOfficeDoc = /\.(docx?|pptx?|xlsx?)$/i.test(lesson?.file_url || '');

  return (
    <div className="h-full">
      {/* Main Document Area - Full width */}
      <Card className="h-full bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="h-full flex flex-col">
        {/* Header with Controls */}
        <div className="border-b border-purple-200 px-2 py-2 space-y-2">
          <div className="flex flex-col gap-2">
            {lesson?.extracted_content && (
              <div className="flex items-center gap-2 flex-wrap">
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
                    <Search className="w-3 h-3 mr-1" />
                    Searchable Text
                  </Button>
                </div>
                {viewMode === "transcript" && (
                  <Button
                    variant={annotationMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setAnnotationMode(!annotationMode);
                      setShowAnnotations(!annotationMode);
                    }}
                    className={`text-xs h-8 ${annotationMode ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : ""}`}
                  >
                    <Highlighter className="w-3 h-3 mr-1" />
                    {annotationMode ? "Exit" : "Annotate"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Search Bar - Only in transcript mode */}
          {viewMode === "transcript" && lesson?.extracted_content && !annotationMode && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-7 h-8 text-xs"
              />
            </div>
          )}
          
          {annotationMode && (
            <div className="flex items-center gap-1 text-xs text-slate-700 bg-yellow-50 p-2 rounded border border-yellow-300">
              <Highlighter className="w-3 h-3 text-yellow-600 flex-shrink-0" />
              <span className="font-medium">Select text to annotate</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="h-full flex">
            {/* Main Content */}
            <div className={`flex-1 ${viewMode === "transcript" && showAnnotations && annotations.length > 0 ? 'lg:w-2/3' : 'w-full'}`}>
              {viewMode === "pdf" && lesson?.file_url ? (
                <div className="h-full bg-slate-50">
                  {isPDF || isOfficeDoc ? (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.file_url)}&embedded=true`}
                      className="w-full h-full border-0"
                      title="Course Document"
                    />
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
                        <Button
                          variant="outline"
                          asChild
                          className="border-purple-200"
                        >
                          <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open File
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : viewMode === "transcript" && lesson?.extracted_content ? (
                <div className="h-full flex flex-col bg-slate-50">
                  <div className="border-b border-purple-200 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs">
                      <FileText className="w-3 h-3 text-purple-600" />
                      Transcript
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyTranscript}
                      className="border-purple-200 h-7 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div 
                    className="flex-1 overflow-auto p-3"
                    onMouseUp={annotationMode ? handleTextSelection : undefined}
                  >
                    <div className="w-full max-w-full overflow-hidden">
                      <div 
                        className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere"
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        dangerouslySetInnerHTML={{ __html: highlightSearchTerm(lesson.extracted_content) }}
                      />
                    </div>

                    {/* Floating Annotation Modal */}
                    {annotationMode && showAnnotationPopover && selectedText && (
                      <div 
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                          if (e.target === e.currentTarget) {
                            setShowAnnotationPopover(false);
                            setSelectedText("");
                            setNoteText("");
                            window.getSelection().removeAllRanges();
                          }
                        }}
                      >
                        <div 
                          className="bg-white rounded-xl shadow-2xl w-[calc(100vw-2rem)] max-w-sm p-4 animate-in fade-in zoom-in duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Highlighter className="w-4 h-4 text-purple-600" />
                                Add Annotation
                              </h3>
                            </div>
                            
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-2">Selected Text:</p>
                              <p className="text-sm text-slate-700 bg-yellow-50 p-2 rounded border border-yellow-200 max-h-20 overflow-y-auto">
                                "{selectedText.substring(0, 150)}{selectedText.length > 150 ? '...' : ''}"
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-2 block">Highlight Color:</label>
                              <div className="flex gap-2">
                                {['yellow', 'green', 'blue', 'pink', 'purple'].map(color => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setHighlightColor(color);
                                    }}
                                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                                      highlightColor === color ? 'border-slate-900 scale-110 ring-2 ring-purple-300' : 'border-slate-200'
                                    }`}
                                    style={{ 
                                      backgroundColor: color === 'yellow' ? '#fef08a' : 
                                                      color === 'green' ? '#bbf7d0' : 
                                                      color === 'blue' ? '#bfdbfe' : 
                                                      color === 'pink' ? '#fbcfe8' : '#e9d5ff' 
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-xs font-semibold text-slate-600 mb-1 block">Note (optional):</label>
                              <Textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add your thoughts..."
                                className="min-h-[60px] text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowAnnotationPopover(false);
                                  setSelectedText("");
                                  setNoteText("");
                                  window.getSelection().removeAllRanges();
                                }}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddAnnotation();
                                }}
                                size="sm" 
                                className="flex-1 bg-purple-600 hover:bg-purple-700"
                              >
                                <StickyNote className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Annotations Sidebar - Hidden on mobile */}
            {viewMode === "transcript" && showAnnotations && annotations.length > 0 && (
              <div className="hidden md:block md:w-1/3 border-l border-purple-200 bg-white">
                <div className="h-full flex flex-col">
                  <div className="border-b border-purple-200 px-3 py-2">
                    <h3 className="font-semibold text-xs text-slate-900 flex items-center gap-1">
                      <StickyNote className="w-3 h-3 text-purple-600" />
                      Notes ({annotations.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {annotations.map((annotation) => (
                      <Card key={annotation.id} className="p-2 border-slate-200">
                        <div className="space-y-1">
                          <div 
                            className="p-1.5 rounded border"
                            style={{
                              backgroundColor: annotation.color === 'yellow' ? '#fef9c3' : 
                                            annotation.color === 'green' ? '#dcfce7' : 
                                            annotation.color === 'blue' ? '#dbeafe' : 
                                            annotation.color === 'pink' ? '#fce7f3' : '#f3e8ff',
                              borderColor: annotation.color === 'yellow' ? '#fde047' : 
                                          annotation.color === 'green' ? '#86efac' : 
                                          annotation.color === 'blue' ? '#93c5fd' : 
                                          annotation.color === 'pink' ? '#f9a8d4' : '#d8b4fe'
                            }}
                          >
                            <p className="text-[10px] font-medium text-slate-700">
                              "{annotation.highlight_text.substring(0, 60)}{annotation.highlight_text.length > 60 ? '...' : ''}"
                            </p>
                          </div>
                          {annotation.note && (
                            <p className="text-[10px] text-slate-600 italic">{annotation.note}</p>
                          )}
                          <div className="flex justify-between items-center pt-0.5">
                            <Badge variant="outline" className="text-[9px] capitalize h-5">
                              {annotation.color}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAnnotation(annotation.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 px-1.5 text-[10px]"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </Card>
    </div>
  );
}