import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

export default function DocumentDisplay({ lesson }) {
  if (!lesson?.file_url) {
    return (
      <Card className="bg-white/90 border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] shadow-xl">
        <CardHeader className="border-b border-purple-200 py-3">
          <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Your Document
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-60px)]">
          <div className="text-center text-slate-500 p-4">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No document uploaded</p>
            <p className="text-xs text-slate-400 mt-2">This lesson was created from a description</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPDF = lesson.file_url?.toLowerCase().includes('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(lesson.file_url);

  return (
    <Card className="bg-white/90 border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] overflow-hidden shadow-xl">
      <CardHeader className="border-b border-purple-200 py-3">
        <CardTitle className="text-slate-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Your Document</span>
            <span className="sm:hidden">Document</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-600 hover:text-slate-900 h-8"
          >
            <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-56px)]">
        {isPDF ? (
          <iframe
            src={lesson.file_url}
            className="w-full h-full border-0"
            title="Course Document"
            style={{ minHeight: '100%' }}
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
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4 text-sm">Preview not available</p>
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
        )}
      </CardContent>
    </Card>
  );
}