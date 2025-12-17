import React, { useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col h-[600px]">
      <CardHeader className="border-b border-purple-800/30">
        <CardTitle className="text-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            AI-Generated Notes
          </div>
          {notes && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="border-purple-700/30 text-purple-300 hover:bg-purple-900/30"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6">
        {!notes ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-10 h-10 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-purple-100 mb-2">Generate AI-Powered Notes</h3>
              <p className="text-purple-300 text-sm max-w-md">
                Our AI will analyze your course material and create comprehensive, structured notes highlighting the most important concepts and topics.
              </p>
            </div>
            <Alert className="max-w-md bg-purple-900/20 border-purple-700/30">
              <AlertDescription className="text-xs text-purple-300">
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
          <ScrollArea className="flex-1">
            <div className="prose prose-invert prose-purple max-w-none">
              <ReactMarkdown>{notes}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </div>
  );
}