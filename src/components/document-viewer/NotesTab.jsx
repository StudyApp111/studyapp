import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Settings2, RefreshCw, Copy, Check, Zap, Sparkles, BookOpen, GraduationCap, FileText, Download, Notebook, Eye, EyeOff, Highlighter, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
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
  const { canDoTask, incrementTaskCount, triggerUpgradeModal, isPro } = useSubscription();
  const [note, setNote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    noteType: "Detailed Notes",
    customInstructions: ""
  });
  const [copied, setCopied] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [fontSize, setFontSize] = useState('base'); // 'sm', 'base', 'lg'
  const [tocCollapsed, setTocCollapsed] = useState(false);

  // Track if notes have been loaded to prevent redundant calls
  const [notesLoaded, setNotesLoaded] = useState(false);
  
  useEffect(() => {
    if (lesson?.id && !notesLoaded) {
      loadNotes();
      setNotesLoaded(true);
    }
  }, [lesson?.id, notesLoaded]);

  const [allNotes, setAllNotes] = useState([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  
  const loadNotes = async () => {
    try {
      const notes = await base44.entities.LessonNote.filter({ lesson_id: lesson.id }, '-created_date', 50);
      if (notes && notes.length > 0) {
        setAllNotes(notes);
        setNote(notes[0]);
        setCurrentNoteIndex(0);
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
    // Check task limit - notes counts as a task
    const taskCheck = await canDoTask('review_notes');
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
        await incrementTaskCount('review_notes');
        const newNote = await base44.entities.LessonNote.create({
          lesson_id: lesson.id,
          note_type: currentSettings.noteType,
          content: data.content,
          custom_instructions: currentSettings.customInstructions
        });
        // Reload all notes and show the new one
        const freshNotes = await base44.entities.LessonNote.filter({ lesson_id: lesson.id }, '-created_date', 50);
        setAllNotes(freshNotes);
        setNote(newNote);
        setCurrentNoteIndex(0);
        toast.success(`${currentSettings.noteType} generated!`);
        
        // Mark review_notes task as complete in study plan
        try {
          const studyPlans = await base44.entities.StudyPlan.filter({ 
            lesson_id: lesson.id, 
            status: 'active' 
          });
          if (studyPlans.length > 0) {
            const plan = studyPlans[0];
            let markedOne = false;
            const updatedTasks = plan.tasks?.map(task => {
              if (task.task_type === 'review_notes' && !task.completed && !markedOne) {
                markedOne = true;
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
            
            // Trigger Polly engine after notes task completion
            base44.functions.invoke('runPollyEngine', {
              trigger_event: 'review_notes_completed',
              lesson_id: lesson.id
            }).catch(err => console.warn('Polly trigger failed:', err.message));
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

  const slugify = (text) => {
    return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };

  const extractTableOfContents = (content) => {
    if (!content) return [];
    const lines = content.split('\n');
    const toc = [];
    lines.forEach((line) => {
      const h1Match = line.match(/^#\s+(.+)$/);
      const h2Match = line.match(/^##\s+(.+)$/);
      const h3Match = line.match(/^###\s+(.+)$/);
      
      if (h1Match) toc.push({ level: 1, text: h1Match[1], id: `heading-${slugify(h1Match[1])}` });
      else if (h2Match) toc.push({ level: 2, text: h2Match[1], id: `heading-${slugify(h2Match[1])}` });
      else if (h3Match) toc.push({ level: 3, text: h3Match[1], id: `heading-${slugify(h3Match[1])}` });
    });
    return toc;
  };

  const tableOfContents = note ? extractTableOfContents(note.content) : [];

  const downloadAsMarkdown = () => {
    if (note?.content) {
      const blob = new Blob([note.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lesson.course_name || 'notes'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Notes downloaded");
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
            
            <div className="flex items-center gap-2 sm:self-auto self-end flex-wrap">
              {/* Font Size Controls */}
              <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <button 
                  onClick={() => setFontSize('sm')} 
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${fontSize === 'sm' ? (isDark ? 'bg-purple-600 text-white' : 'bg-purple-600 text-white') : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
                <button 
                  onClick={() => setFontSize('base')} 
                  className={`px-2 py-1 rounded text-sm font-medium transition-colors ${fontSize === 'base' ? (isDark ? 'bg-purple-600 text-white' : 'bg-purple-600 text-white') : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
                <button 
                  onClick={() => setFontSize('lg')} 
                  className={`px-2 py-1 rounded text-base font-medium transition-colors ${fontSize === 'lg' ? (isDark ? 'bg-purple-600 text-white' : 'bg-purple-600 text-white') : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setHighlightMode(!highlightMode)}
                className={`${highlightMode ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-600' : (isDark ? 'text-slate-300 border-white/20 hover:bg-white/10' : 'text-slate-600 border-slate-200 hover:bg-slate-50')}`}
              >
                <Highlighter className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard} 
                className={`${isDark ? 'text-slate-300 border-white/20 hover:bg-white/10 hover:text-white' : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSettingsOpen(true)} 
                className={`${isDark ? 'text-purple-300 border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-200' : 'text-purple-700 border-purple-200 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300'} transition-all`}
              >
                <Settings2 className="w-4 h-4" />
              </Button>
              {allNotes.length > 1 && (
                <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                  <button 
                    onClick={() => {
                      const newIdx = Math.min(currentNoteIndex + 1, allNotes.length - 1);
                      setCurrentNoteIndex(newIdx);
                      setNote(allNotes[newIdx]);
                    }}
                    disabled={currentNoteIndex >= allNotes.length - 1}
                    className={`p-1 rounded disabled:opacity-30 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {currentNoteIndex + 1}/{allNotes.length}
                  </span>
                  <button 
                    onClick={() => {
                      const newIdx = Math.max(currentNoteIndex - 1, 0);
                      setCurrentNoteIndex(newIdx);
                      setNote(allNotes[newIdx]);
                    }}
                    disabled={currentNoteIndex <= 0}
                    className={`p-1 rounded disabled:opacity-30 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <Button 
                size="sm" 
                onClick={() => generateNotes(settings)} 
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/30 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex gap-0 overflow-hidden">
            {/* Table of Contents - Desktop Only, Collapsible */}
            {tableOfContents.length > 0 && (
              <div className={`hidden lg:flex flex-col border-r transition-all duration-300 ${tocCollapsed ? 'w-10' : 'w-64'} ${isDark ? 'bg-[#0a0a12] border-white/10' : 'bg-slate-50 border-slate-200'}`} style={{ maxHeight: 'calc(100vh - 140px)' }}>
                <div className="p-2 flex items-center justify-between">
                  {!tocCollapsed && (
                    <h3 className={`text-xs font-bold uppercase tracking-wider px-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contents</h3>
                  )}
                  <button
                    onClick={() => setTocCollapsed(!tocCollapsed)}
                    className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                    title={tocCollapsed ? 'Expand contents' : 'Collapse contents'}
                  >
                    {tocCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                </div>
                {!tocCollapsed && (
                  <nav className="space-y-1 px-4 pb-4 overflow-y-auto">
                    {tableOfContents.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const element = document.getElementById(item.id);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                          item.level === 1 ? 'font-bold' : item.level === 2 ? 'font-semibold pl-3' : 'pl-5'
                        } ${isDark ? 'text-slate-300 hover:bg-purple-500/10 hover:text-purple-300' : 'text-slate-700 hover:bg-purple-50 hover:text-purple-700'}`}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 overflow-y-auto p-3 sm:p-6 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', overflowX: 'hidden', maxHeight: 'calc(100vh - 140px)' }}>
              <div className="w-full max-w-full md:max-w-4xl mx-auto" style={{ boxSizing: 'border-box' }}>
                <Card className={`p-6 sm:p-12 shadow-sm ${isDark ? 'border-purple-500/30 bg-[#12121a]' : 'border-slate-200 bg-white'} ${highlightMode ? 'highlight-active' : ''}`} style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: highlightMode ? 'text' : 'auto' }}>
                  <div className={`prose max-w-none ${isDark ? 'prose-invert' : ''} ${
                    fontSize === 'sm' ? '[&_h1]:text-3xl [&_h2]:text-xl [&_h3]:text-lg [&_h4]:text-base [&_p]:text-sm [&_li]:text-sm' :
                    fontSize === 'lg' ? '[&_h1]:!text-5xl [&_h2]:!text-3xl [&_h3]:!text-2xl [&_h4]:!text-xl [&_p]:!text-lg [&_li]:!text-lg' :
                    '[&_h1]:!text-4xl [&_h2]:!text-2xl [&_h3]:!text-xl [&_h4]:!text-lg [&_p]:!text-base [&_li]:!text-base'
                  } [&_h1]:!font-black [&_h1]:!border-b [&_h1]:!pb-4 [&_h1]:!mb-6 [&_h2]:!font-bold [&_h2]:!mt-8 [&_h2]:!mb-3 ${isDark ? '[&_h2]:!text-purple-400' : '[&_h2]:!text-purple-700'} [&_h3]:!font-semibold [&_h3]:!mt-6 [&_h3]:!mb-2 [&_p]:!leading-relaxed [&_p]:!my-3 [&_li]:!my-1 [&_strong]:!font-bold ${isDark ? '[&_strong]:!text-white' : '[&_strong]:!text-slate-900'} [&_ul]:!my-4 [&_ol]:!my-4 [&_ul]:!space-y-1 [&_ol]:!space-y-1`}>
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => {
                          const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : String(children || ''));
                          return <h1 id={`heading-${slugify(text)}`}>{children}</h1>;
                        },
                        h2: ({ children }) => {
                          const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : String(children || ''));
                          return <h2 id={`heading-${slugify(text)}`}>{children}</h2>;
                        },
                        h3: ({ children }) => {
                          const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : String(children || ''));
                          return <h3 id={`heading-${slugify(text)}`}>{children}</h3>;
                        },
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