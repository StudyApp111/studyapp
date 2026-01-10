import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Settings2, RefreshCw, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import NoteSettingsModal from "@/components/modals/NoteSettingsModal";
import { toast } from "sonner";
import EducationalLoader from "@/components/ui/EducationalLoader";

export default function NotesTab({ lesson }) {
  const [note, setNote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    noteType: "Detailed Notes",
    customInstructions: ""
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (lesson?.id) {
      loadNotes();
    }
  }, [lesson?.id]);

  const loadNotes = async () => {
    try {
      const notes = await base44.entities.LessonNote.filter({ lesson_id: lesson.id }, '-created_date', 1);
      if (notes && notes.length > 0) {
        setNote(notes[0]);
        setSettings({
          noteType: notes[0].note_type,
          customInstructions: notes[0].custom_instructions || ""
        });
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const generateNotes = async (currentSettings = settings) => {
    setIsLoading(true);
    try {
      const content = lesson.compressed_content || lesson.extracted_content || lesson.description;
      
      if (!content) {
        toast.error("No lesson content available to generate notes.");
        setIsLoading(false);
        return;
      }

      const { data } = await base44.functions.invoke('generateLessonNotes', {
        lesson_content: content,
        note_type: currentSettings.noteType,
        custom_instructions: currentSettings.customInstructions
      });

      if (data?.content) {
        // Save to DB
        const newNote = await base44.entities.LessonNote.create({
          lesson_id: lesson.id,
          note_type: currentSettings.noteType,
          content: data.content,
          custom_instructions: currentSettings.customInstructions
        });
        setNote(newNote);
        toast.success(`${currentSettings.noteType} generated!`);
      }
    } catch (error) {
      console.error("Error generating notes:", error);
      toast.error("Failed to generate notes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsSave = (newSettings) => {
    setSettings(newSettings);
    // Optionally trigger regeneration immediately if user wants, 
    // but typically we wait for them to click "Generate" or "Regenerate"
    // For better UX, let's just save settings and let user trigger generation explicitly
    // unless there are no notes yet, then maybe auto-generate? 
    // Let's stick to explicit action.
  };

  const copyToClipboard = () => {
    if (note?.content) {
      navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Notes copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <EducationalLoader 
        title="Generating Notes" 
        description={`Creating your ${settings.noteType.toLowerCase()}...`} 
      />
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <NoteSettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        settings={settings} 
        onSave={handleSettingsSave} 
      />

      {note ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-purple-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">{note.note_type}</h3>
              {note.custom_instructions && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Custom</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="text-slate-600">
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="gap-2">
                <Settings2 className="w-4 h-4" />
                Customize
              </Button>
              <Button size="sm" onClick={() => generateNotes(settings)} className="bg-purple-600 hover:bg-purple-700 gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white/80">
            <div className="prose prose-purple max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:marker:text-purple-500">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-2">
            <Settings2 className="w-10 h-10 text-purple-600" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">AI Study Notes</h2>
            <p className="text-slate-600">
              Generate personalized study materials from your lesson content. Choose from detailed notes, cheat sheets, summaries, or exam prep guides.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
             <Button 
              variant="outline" 
              onClick={() => setSettingsOpen(true)}
              className="flex-1 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Customize
            </Button>
            <Button 
              onClick={() => generateNotes(settings)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200"
            >
              <Zap className="w-4 h-4 mr-2" />
              Generate {settings.noteType}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}