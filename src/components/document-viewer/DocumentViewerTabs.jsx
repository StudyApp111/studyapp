import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileType, ExternalLink, Copy, Download } from "lucide-react";
import { toast } from "sonner";

export default function DocumentViewerTabs({ lesson }) {
  const [activeDocTab, setActiveDocTab] = useState("viewer");

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
      <div className="h-full grid grid-cols-2 divide-x divide-purple-200">
        {/* Left: Your Document */}
        <div className="flex flex-col">
          <div className="border-b border-purple-200 px-4 py-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <FileText className="w-4 h-4" />
                Your Document
              </div>
              {lesson?.file_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-slate-600 hover:text-slate-900 h-7 w-7 p-0"
                >
                  <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          
          <Tabs value={activeDocTab} onValueChange={setActiveDocTab} className="flex-1 flex flex-col">
            <TabsList className="w-full bg-slate-100 p-1 mx-4 mt-2 rounded-lg">
              {lesson?.file_url && (
                <TabsTrigger value="viewer" className="flex-1 data-[state=active]:bg-white text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  Viewer
                </TabsTrigger>
              )}
              {lesson?.extracted_content && (
                <TabsTrigger value="transcript" className="flex-1 data-[state=active]:bg-white text-xs">
                  <FileType className="w-3 h-3 mr-1" />
                  Transcript
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {lesson?.file_url && (
                <TabsContent value="viewer" className="h-full m-0 p-0">
                  {isPDF ? (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.file_url)}&embedded=true`}
                      className="w-full h-full border-0"
                      title="Course Document"
                    />
                  ) : isImage ? (
                    <div className="w-full h-full overflow-auto bg-slate-50 p-4">
                      <img 
                        src={lesson.file_url} 
                        alt="Course Material" 
                        className="max-w-full h-auto mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full p-6 text-center">
                      <div>
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600 mb-3 text-xs">Preview not available</p>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-purple-200 text-slate-700"
                        >
                          <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Open File
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

              {lesson?.extracted_content && (
                <TabsContent value="transcript" className="h-full m-0 p-0">
                  <div className="h-full flex flex-col">
                    <div className="border-b border-purple-200 px-3 py-2 bg-slate-50 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyTranscript}
                        className="text-xs h-7"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTranscript}
                        className="text-xs h-7"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <div className="prose prose-sm prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono">
                          {lesson.extracted_content}
                        </pre>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>

        {/* Right: Viewer Content */}
        <div className="flex flex-col bg-slate-50/50">
          <div className="border-b border-purple-200 px-4 py-3 bg-white">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <FileText className="w-4 h-4" />
              Viewer
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isPDF ? (
              <div className="bg-white rounded-lg border border-slate-200 h-full">
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(lesson.file_url)}&embedded=true`}
                  className="w-full h-full border-0 rounded-lg"
                  title="Document Preview"
                />
              </div>
            ) : isImage ? (
              <div className="bg-white rounded-lg border border-slate-200 p-4 h-full overflow-auto">
                <img 
                  src={lesson.file_url} 
                  alt="Course Material" 
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            ) : lesson?.file_url ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 mb-3 text-sm">Preview not available</p>
                  <Button
                    variant="outline"
                    asChild
                    className="border-purple-200 text-slate-700"
                  >
                    <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open File
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-slate-500">
                <div>
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No document available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}