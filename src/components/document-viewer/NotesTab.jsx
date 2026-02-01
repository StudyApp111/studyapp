import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Settings2, RefreshCw, Copy, Check, Zap, Sparkles, BookOpen, GraduationCap, FileText, Download, Notebook } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { renderMathText } from "@/components/math/MathText";
import NoteSettingsModal from "@/components/modals/NoteSettingsModal";
import { toast } from "sonner";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

const TYPE_CONFIG = {
  "Detailed Notes": { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  "Cheat Sheet": { icon: Zap, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  "Short Summary": { icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  "Exam Prep": { icon: GraduationCap, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
  "default": { icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" }
};

export default function NotesTab({ lesson }) {
  const { isDark } = useTheme();
  const { canDoTask, incrementTaskCount, triggerUpgradeModal } = useSubscription();
  const [note, setNote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    noteType: "Detailed Notes",
    customInstructions: ""
  });
  const [copied, setCopied] = useState(false);

  // Track if notes have been loaded to prevent redundant calls
  const [notesLoaded, setNotesLoaded] = useState(false);
  
  useEffect(() => {
    if (lesson?.id && !notesLoaded) {
      loadNotes();
      setNotesLoaded(true);
    }
  }, [lesson?.id, notesLoaded]);

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
    // Check task limit
    const taskCheck = await canDoTask();
    if (!taskCheck.allowed) {
      triggerUpgradeModal('tasks');
      return;
    }
    
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
        const newNote = await base44.entities.LessonNote.create({
          lesson_id: lesson.id,
          note_type: currentSettings.noteType,
          content: data.content,
          custom_instructions: currentSettings.customInstructions
        });
        setNote(newNote);
        toast.success(`${currentSettings.noteType} generated!`);
        
        // Mark review_notes task as complete in study plan
        try {
          const studyPlans = await base44.entities.StudyPlan.filter({ 
            lesson_id: lesson.id, 
            status: 'active' 
          });
          if (studyPlans.length > 0) {
            const plan = studyPlans[0];
            const updatedTasks = plan.tasks?.map(task => {
              if (task.task_type === 'review_notes' && !task.completed) {
                return {
                  ...task,
                  completed_count: (task.completed_count || 0) + 1,
                  completed: true,
                  completed_date: new Date().toISOString()
                };
              }
              return task;
            });
            
            const allComplete = updatedTasks?.every(t => t.completed);
            await base44.entities.StudyPlan.update(plan.id, { 
              tasks: updatedTasks,
              all_tasks_completed: allComplete,
              official_exam_unlocked: allComplete
            });
          }
        } catch (planError) {
          console.error("Error updating study plan for notes:", planError);
        }
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
  };

  const copyToClipboard = () => {
    if (note?.content) {
      navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Notes copied to clipboard");
    }
  };

  const activeConfig = TYPE_CONFIG[note?.note_type] || TYPE_CONFIG["default"];
  const ActiveIcon = activeConfig.icon;

  if (isLoading) {
    return (
      <EducationalLoader 
        title="Crafting Your Notes" 
        description={`Our AI is synthesizing a perfect ${settings.noteType.toLowerCase()} for you...`} 
      />
    );
  }

  return (
    <div className={`flex flex-col relative ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <NoteSettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        settings={settings} 
        onSave={handleSettingsSave} 
      />

      {note ? (
        <div className="flex flex-col">
          {/* Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 border-b sticky top-0 z-10 gap-2 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${isDark ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-600 border-purple-200'}`}>
                <Notebook className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-bold text-lg leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{note.note_type}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Generated by AI Tutor</span>
                  {note.custom_instructions && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${isDark ? 'bg-violet-600/20 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>Custom</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:self-auto self-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard} 
                className={`${isDark ? 'text-slate-300 border-white/20 hover:bg-white/10 hover:text-white' : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                {copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSettingsOpen(true)} 
                className={`${isDark ? 'text-purple-300 border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-200' : 'text-purple-700 border-purple-200 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300'} transition-all`}
              >
                <Settings2 className="w-4 h-4 mr-1.5" />
                Customize
              </Button>
              <Button 
                size="sm" 
                onClick={() => generateNotes(settings)} 
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/30 transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Regenerate
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className={`overflow-y-auto p-3 sm:p-6 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div className="w-full max-w-full md:max-w-4xl mx-auto" style={{ boxSizing: 'border-box' }}>
              <Card className={`p-4 sm:p-8 shadow-sm ${isDark ? 'border-purple-500/30 bg-[#12121a]' : 'border-slate-200 bg-white'}`}>
                <div className="prose prose-slate max-w-none 
                  prose-headings:font-bold prose-headings:text-slate-900 
                  prose-h1:text-3xl prose-h1:border-b prose-h1:border-slate-100 prose-h1:pb-4 prose-h1:mb-6
                  prose-h2:text-2xl prose-h2:text-violet-700 prose-h2:mt-8 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:text-slate-800 prose-h3:mt-6 prose-h3:mb-3
                  prose-p:text-slate-700 prose-p:leading-relaxed prose-p:text-base
                  prose-li:text-slate-700 prose-li:marker:text-violet-400 prose-li:text-base
                  prose-strong:text-slate-900 prose-strong:font-bold
                  prose-em:text-slate-700 prose-em:italic
                  prose-ul:my-4 prose-ol:my-4
                  prose-blockquote:border-l-4 prose-blockquote:border-violet-500 prose-blockquote:bg-violet-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:text-violet-800 prose-blockquote:not-italic
                  prose-code:bg-slate-100 prose-code:text-slate-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-sm
                  prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-pre:rounded-xl prose-pre:shadow-lg prose-pre:p-4
                  prose-hr:border-slate-200 prose-hr:my-8
                  prose-table:text-sm
                ">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => {
                        const text = typeof children === 'string' ? children : 
                          (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                        return <p dangerouslySetInnerHTML={{ __html: renderMathText(text) }} />;
                      },
                      li: ({ children }) => {
                        const text = typeof children === 'string' ? children : 
                          (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                        return <li dangerouslySetInnerHTML={{ __html: renderMathText(text) }} />;
                      }
                    }}
                  >
                    {note.content}
                  </ReactMarkdown>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className={`overflow-y-auto p-4 ${isDark ? 'bg-[#12121a]' : 'bg-white'}`}>
          <div className="max-w-md mx-auto text-center py-8">
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-3xl rotate-3 flex items-center justify-center mb-6 mx-auto shadow-xl ${isDark ? 'bg-violet-600/20 shadow-violet-900/50' : 'bg-violet-100 shadow-violet-100'}`}>
              <Sparkles className={`w-10 h-10 md:w-12 md:h-12 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
            </div>
            
            <h2 className={`text-2xl md:text-3xl font-bold mb-2 tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Note Generator</h2>
            <p className={`text-sm md:text-base mb-6 leading-relaxed px-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Transform your lesson content into structured study materials in seconds.
            </p>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className={`p-3 rounded-xl border text-left ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`flex items-center gap-1.5 mb-1 font-bold text-xs ${isDark ? 'text-violet-400' : 'text-violet-700'}`}>
                  <BookOpen className="w-3.5 h-3.5" /> Detailed Notes
                </div>
                <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full topic coverage</p>
              </div>
              <div className={`p-3 rounded-xl border text-left ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`flex items-center gap-1.5 mb-1 font-bold text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  <Zap className="w-3.5 h-3.5" /> Cheat Sheets
                </div>
                <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quick exam references</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={() => generateNotes(settings)}
                className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Notes
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSettingsOpen(true)}
                className={`w-full h-10 ${isDark ? 'border-white/10 hover:bg-white/5 hover:text-slate-200 text-slate-300' : 'border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-slate-600'}`}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Customize Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}