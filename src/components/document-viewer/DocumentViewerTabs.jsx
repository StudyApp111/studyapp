import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Copy, Download, Search, Highlighter, StickyNote, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ReactMarkdown from "react-markdown";

export default function DocumentViewerTabs({ lesson }) {
  const [viewMode, setViewMode] = useState("pdf");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);

  // AI Chat state
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your AI tutor for ${lesson?.course_name || 'this course'}. Ask me anything about the material! 🎓`
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  React.useEffect(() => {
    if (lesson?.id) {
      loadAnnotations();
    }
  }, [lesson?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleDownloadTranscript = () => {
    if (!lesson?.extracted_content) return;
    
    const blob = new Blob([lesson.extracted_content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lesson.course_name}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded");
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: {
          course_name: lesson?.course_name,
          extracted_content: lesson?.extracted_content?.substring(0, 3000)
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.reply 
      }]);
    } catch (error) {
      console.error("Tutor error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsChatLoading(false);
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

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Main Document Area - 2/3 width */}
      <Card className="flex-[2] bg-white/90 border-purple-200 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="h-full flex flex-col">
        {/* Header with Controls */}
        <div className="border-b border-purple-200 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <FileText className="w-5 h-5 text-purple-600" />
              Document Viewer
            </div>

            <div className="flex items-center gap-2">
              {lesson?.extracted_content && (
                <>
                  <Button
                    variant={viewMode === "transcript" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(viewMode === "pdf" ? "transcript" : "pdf")}
                    className={viewMode === "transcript" ? "bg-purple-600 hover:bg-purple-700" : ""}
                  >
                    {viewMode === "transcript" ? "Show PDF" : "Show Transcript"}
                  </Button>
                  {viewMode === "transcript" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAnnotations(!showAnnotations)}
                    >
                      <Highlighter className="w-4 h-4 mr-2" />
                      {showAnnotations ? "Hide" : "Show"} Notes
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Search Bar - Only in transcript mode */}
          {viewMode === "transcript" && lesson?.extracted_content && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search within document..."
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-purple-50 p-2 rounded-lg border border-purple-200">
                <Highlighter className="w-4 h-4 text-purple-600" />
                <span>💡 Select any text to highlight and add notes</span>
              </div>
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
                  {isPDF ? (
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
                  <div className="border-b border-purple-200 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                      <FileText className="w-4 h-4 text-purple-600" />
                      Transcript
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyTranscript}
                      className="border-purple-200"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div 
                    className="flex-1 overflow-auto p-6"
                    onMouseUp={handleTextSelection}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div 
                        className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: highlightSearchTerm(lesson.extracted_content) }}
                      />
                    </div>

                    {/* Floating Annotation Button */}
                    {showAnnotationPopover && selectedText && (
                      <div 
                        className="fixed z-50"
                        style={{ 
                          left: `${selectionPosition.x}px`, 
                          top: `${selectionPosition.y}px`,
                          transform: 'translate(-50%, -100%)'
                        }}
                      >
                        <Popover open={showAnnotationPopover} onOpenChange={setShowAnnotationPopover}>
                          <PopoverTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-purple-600 hover:bg-purple-700 shadow-xl animate-in fade-in zoom-in duration-200"
                            >
                              <Highlighter className="w-4 h-4 mr-2" />
                              Annotate
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="center">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-600 mb-2">Selected Text:</p>
                                <p className="text-sm text-slate-700 bg-yellow-50 p-2 rounded border border-yellow-200 max-h-20 overflow-y-auto">
                                  {selectedText.substring(0, 150)}{selectedText.length > 150 ? '...' : ''}
                                </p>
                              </div>
                              
                              <div>
                                <label className="text-xs font-semibold text-slate-600 mb-2 block">Highlight Color:</label>
                                <div className="flex gap-2">
                                  {['yellow', 'green', 'blue', 'pink', 'purple'].map(color => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setHighlightColor(color)}
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
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
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
                                  onClick={handleAddAnnotation} 
                                  size="sm" 
                                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                                >
                                  <StickyNote className="w-4 h-4 mr-2" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Annotations Sidebar */}
            {viewMode === "transcript" && showAnnotations && annotations.length > 0 && (
              <div className="hidden lg:block lg:w-1/3 border-l border-purple-200 bg-white">
                <div className="h-full flex flex-col">
                  <div className="border-b border-purple-200 px-4 py-3">
                    <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-purple-600" />
                      Your Notes ({annotations.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {annotations.map((annotation) => (
                      <Card key={annotation.id} className="p-3 border-slate-200">
                        <div className="space-y-2">
                          <div 
                            className="p-2 rounded border"
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
                            <p className="text-xs font-medium text-slate-700">
                              "{annotation.highlight_text.substring(0, 80)}{annotation.highlight_text.length > 80 ? '...' : ''}"
                            </p>
                          </div>
                          {annotation.note && (
                            <p className="text-xs text-slate-600 italic">{annotation.note}</p>
                          )}
                          <div className="flex justify-between items-center pt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {annotation.color}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAnnotation(annotation.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
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

      {/* AI Chat Sidebar - 1/3 width */}
      <Card className="flex-1 flex flex-col bg-white/95 backdrop-blur-xl shadow-xl border-purple-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 flex items-center gap-2 flex-shrink-0">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">AI Tutor</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
              placeholder="Ask a question..."
              disabled={isChatLoading}
              className="flex-1"
            />
            <Button
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
              size="icon"
              className="bg-purple-600 hover:bg-purple-700 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}