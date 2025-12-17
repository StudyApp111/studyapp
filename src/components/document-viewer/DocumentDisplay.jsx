import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocumentDisplay({ lesson }) {
  if (!lesson?.file_url) {
    return (
      <Card className="sticky top-6 bg-slate-900/50 border-purple-800/30 backdrop-blur-xl h-[600px]">
        <CardHeader className="border-b border-purple-800/30">
          <CardTitle className="text-purple-100 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Course Material
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[calc(100%-80px)]">
          <div className="text-center text-purple-300">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No document uploaded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if it's a PDF
  const isPDF = lesson.file_url.toLowerCase().endsWith('.pdf');

  return (
    <Card className="sticky top-6 bg-slate-900/50 border-purple-800/30 backdrop-blur-xl h-[600px] overflow-hidden">
      <CardHeader className="border-b border-purple-800/30">
        <CardTitle className="text-purple-100 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Document
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-purple-300 hover:text-purple-100 hover:bg-purple-900/30"
          >
            <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4" />
            </a>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-80px)]">
        {isPDF ? (
          <iframe
            src={lesson.file_url}
            className="w-full h-full"
            title="Course Document"
          />
        ) : (
          <div className="flex items-center justify-center h-full p-6 text-center">
            <div>
              <FileText className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <p className="text-purple-300 mb-4">Preview not available for this file type</p>
              <Button
                variant="outline"
                asChild
                className="border-purple-700/30 text-purple-300 hover:bg-purple-900/30"
              >
                <a href={lesson.file_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}