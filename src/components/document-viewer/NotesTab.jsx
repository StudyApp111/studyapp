import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Sparkles, Download, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";

export default function NotesTab({ lesson, extractedContent }) {
  const [notes, setNotes] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateNotes = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implement notes generation backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Placeholder notes
      setNotes(`# Course Notes: ${lesson.course_name}

## Key Concepts

1. **Core Topic 1**
   - Important point about the topic
   - Supporting details and examples
   
2. **Core Topic 2**
   - Key learning objective
   - Related concepts and applications

## Summary

Comprehensive notes will be generated based on your course material using AI. The notes will be structured, easy to understand, and highlight the most important concepts.

## Study Tips

- Focus on understanding core concepts
- Review examples and practice problems
- Connect new knowledge with previous learning`);
    } catch (error) {
      console.error("Error generating notes:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!notes) return;
    
    const blob = new Blob([notes], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lesson.course_name}-notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white/90 border border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] rounded-xl shadow-xl overflow-hidden">
      <div className="border-b border-purple-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <FileText className="w-5 h-5" />
            AI-Generated Notes
          </div>
          {notes && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="border-purple-200 text-slate-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      <div className="h-[calc(100%-70px)] overflow-auto">
        {!notes ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 p-6">
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
              <FileText className="w-10 h-10 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Generate AI-Powered Notes</h3>
              <p className="text-slate-600 text-sm max-w-md">
                Our AI will analyze your course material and create comprehensive, structured notes highlighting the most important concepts and topics.
              </p>
            </div>
            <Alert className="max-w-md bg-purple-50 border-purple-200">
              <AlertDescription className="text-xs text-slate-600">
                Note: Notes generation prompt will be configured. This is a UI placeholder.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleGenerateNotes}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Notes...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Notes
                </>
              )}
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full p-6">
            <div className="prose prose-slate max-w-none">
              <ReactMarkdown>{notes}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}