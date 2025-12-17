import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Copy, Download } from "lucide-react";
import { toast } from "sonner";

export default function DocumentViewerTabs({ lesson }) {
  const [viewMode, setViewMode] = useState("pdf");

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
    <Card className="bg-white/90 border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] shadow-xl overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header with Transcript Toggle */}
        <div className="border-b border-purple-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <FileText className="w-5 h-5 text-purple-600" />
            Document Viewer
          </div>

          {/* Transcript Toggle */}
          {lesson?.extracted_content && (
            <Button
              variant={viewMode === "transcript" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "pdf" ? "transcript" : "pdf")}
              className={viewMode === "transcript" ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {viewMode === "transcript" ? "Show PDF" : "Show Transcript"}
            </Button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
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
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Transcript
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTranscript}
                  className="border-purple-200"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">
                    {lesson.extracted_content}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}