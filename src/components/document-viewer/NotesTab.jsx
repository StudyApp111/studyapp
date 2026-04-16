import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Settings2, RefreshCw, Copy, Check, Zap, Sparkles, BookOpen, GraduationCap, FileText, Download, Notebook, Eye, EyeOff, Highlighter, ChevronLeft, ChevronRight as ChevronRightIcon, Headphones } from "lucide-react";
import ReactMarkdown from "react-markdown";
import NoteSettingsModal from "@/components/modals/NoteSettingsModal";
import NotesTTSPlayer from "@/components/document-viewer/NotesTTSPlayer";
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
  const [ttsOpen, setTtsOpen] = useState(false);
  const [activeTTSSentence, setActiveTTSSentence] = useState(null);

  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pendingStudyTaskId, setPendingStudyTaskId] = useState(null);
  
  useEffect(() => {
    if (lesson?.id && !initialLoadDone) {
      loadNotes();
      setInitialLoadDone(true);
    }
  }, [lesson?.id, initialLoadDone]);

  // Listen for study task events — auto-generate notes if no existing note for this task
  useEffect(() => {
    const handleStudyTask = async (e) => {
      if (e.detail?.taskType !== 'review_notes' && e.detail?.task?.task_type !== 'review_notes') return;
      const taskId = e.detail?.task?.task_id || null;
      setPendingStudyTaskId(taskId);
      
      // Check if notes already exist for this specific task_id
      if (taskId && lesson?.id) {
        const existing = await base44.entities.LessonNote.filter({ lesson_id: lesson.id, study_plan_task_id: taskId });
        if (existing?.length > 0) {
          // Already generated for this task — just show it
          const freshNotes = await base44.entities.LessonNote.filter({ lesson_id: lesson.id }, '-created_date', 50);
          setAllNotes(freshNotes);
          const idx = freshNotes.findIndex(n => n.study_plan_task_id === taskId);
          setNote(freshNotes[idx >= 0 ? idx : 0]);
          setCurrentNoteIndex(idx >= 0 ? idx : 0);
          setPendingStudyTaskId(null);
          return;
        }
      }
      
      // No existing notes for this task — auto-generate
      if (!isLoading) {
        generateNotes(settings);
      }
    };
    window.addEventListener('generateFromStudyTask', handleStudyTask);
    return () => window.removeEventListener('generateFromStudyTask', handleStudyTask);
  }, [lesson?.id, isLoading, settings]);

  const [allNotes, setAllNotes] = useState([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  
  const loadNotes = async () => {
    setInitialLoading(true);
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
    } finally {
      setInitialLoading(false);
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
        const taskIdForNote = pendingStudyTaskId || null;
        const newNote = await base44.entities.LessonNote.create({
          lesson_id: lesson.id,
          study_plan_task_id: taskIdForNote,
          note_type: currentSettings.noteType,
          content: data.content,
          custom_instructions: currentSettings.customInstructions
        });
        setPendingStudyTaskId(null);
        // Reload all notes and show the new one
        const freshNotes = await base44.entities.LessonNote.filter({ lesson_id: lesson.id }, '-created_date', 50);
        setAllNotes(freshNotes);
        setNote(newNote);
        setCurrentNoteIndex(0);
        toast.success(`${currentSettings.noteType} generated!`);
        
        // Mark the specific review_notes task as complete in study plan
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
                // If we have a specific task_id, only mark that one
                if (taskIdForNote && task.task_id !== taskIdForNote) return task;
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
            
            // Notify other components that a study activity was completed
            window.dispatchEvent(new CustomEvent('studyActivityCompleted'));
            
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

  const extractText = (children) => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map(c => extractText(c)).join('');
    if (children?.props?.children) return extractText(children.props.children);
    return String(children || '');
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
        description={`Our AI is synthesizing your ${settings.noteType.toLowerCase()} now...`} 
      />
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col relative w-full max-w-full overflow-x-hidden ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <NoteSettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        settings={settings} 
        onSave={handleSettingsSave} 
      />

      {note ? (
        <div className="flex flex-col w-full max-w-full overflow-x-hidden">
          {/* TTS Player — keep mounted so audio + position persist when hidden */}
          <div style={{ display: ttsOpen ? 'block' : 'none' }}>
            <NotesTTSPlayer
              noteContent={note.content}
              onClose={() => setTtsOpen(false)}
              onSentenceActive={(idx, text) => setActiveTTSSentence(text)}
            />
          </div>
          {/* Header — 2-row on mobile (title row + toolbar row), single row on desktop */}
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 sm:px-4 border-b sticky top-0 z-10 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'}`}>
            {/* Title row */}
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 sm:p-2 rounded-lg border flex-shrink-0 ${isDark ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-600 border-purple-200'}`}>
                <Notebook className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`font-bold text-sm sm:text-lg leading-tight truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{note.note_type}</h3>
                <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                  <span className={`text-[10px] sm:text-xs font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Generated by AI Tutor</span>
                  {note.custom_instructions && (
                    <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 ${isDark ? 'bg-violet-600/20 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>Custom</span>
                  )}
                </div>
              </div>
              {/* Note pager — moved into title row on mobile as it's related to current note */}
              {allNotes.length > 1 && (
                <div className={`flex sm:hidden items-center gap-0.5 px-1.5 py-0.5 rounded-lg border flex-shrink-0 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                  <button 
                    onClick={() => {
                      const newIdx = Math.min(currentNoteIndex + 1, allNotes.length - 1);
                      setCurrentNoteIndex(newIdx);
                      setNote(allNotes[newIdx]);
                    }}
                    disabled={currentNoteIndex >= allNotes.length - 1}
                    className={`p-1 rounded disabled:opacity-30 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                    <ChevronRightIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Toolbar row — wraps if needed */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-between sm:justify-end">
              {/* Font Size Controls */}
              <div className={`flex items-center gap-0.5 px-1 py-0.5 sm:px-2 sm:py-1 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <button 
                  onClick={() => setFontSize('sm')} 
                  className={`w-6 sm:w-auto px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition-colors ${fontSize === 'sm' ? 'bg-purple-600 text-white' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
                <button 
                  onClick={() => setFontSize('base')} 
                  className={`w-6 sm:w-auto px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-medium transition-colors ${fontSize === 'base' ? 'bg-purple-600 text-white' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
                <button 
                  onClick={() => setFontSize('lg')} 
                  className={`w-6 sm:w-auto px-1 sm:px-2 py-0.5 sm:py-1 rounded text-sm sm:text-base font-medium transition-colors ${fontSize === 'lg' ? 'bg-purple-600 text-white' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
                >
                  A
                </button>
              </div>

              {/* Action buttons — compact icon-only on mobile */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setTtsOpen(v => !v)}
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${ttsOpen ? 'bg-purple-500/20 border-purple-500/50 text-purple-600' : (isDark ? 'text-slate-300 border-white/20 hover:bg-white/10' : 'text-slate-600 border-slate-200 hover:bg-slate-50')}`}
                  title="Listen to these notes"
                >
                  <Headphones className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setHighlightMode(!highlightMode)}
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${highlightMode ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-600' : (isDark ? 'text-slate-300 border-white/20 hover:bg-white/10' : 'text-slate-600 border-slate-200 hover:bg-slate-50')}`}
                >
                  <Highlighter className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyToClipboard} 
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${isDark ? 'text-slate-300 border-white/20 hover:bg-white/10 hover:text-white' : 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSettingsOpen(true)} 
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${isDark ? 'text-purple-300 border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-200' : 'text-purple-700 border-purple-200 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300'} transition-all`}
                >
                  <Settings2 className="w-4 h-4" />
                </Button>
                {/* Desktop-only note pager */}
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
                  size="icon"
                  onClick={() => generateNotes(settings)} 
                  className="h-8 w-8 sm:h-9 sm:w-9 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/30 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex gap-0 overflow-hidden w-full max-w-full">
            {/* Table of Contents - Desktop Only, Collapsible */}
            {tableOfContents.length > 0 && (
              <div className={`hidden lg:flex flex-col border-r transition-all duration-300 relative ${tocCollapsed ? 'w-10' : 'w-64'} ${isDark ? 'bg-[#0a0a12] border-white/10' : 'bg-slate-50 border-slate-200'}`} style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {!tocCollapsed && (
                  <div className="p-2">
                    <h3 className={`text-xs font-bold uppercase tracking-wider px-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contents</h3>
                  </div>
                )}
                {!tocCollapsed && (
                  <nav className="space-y-1 px-4 pb-4 overflow-y-auto flex-1">
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
                {/* Centered collapse/expand toggle on the right edge */}
                <button
                  onClick={() => setTocCollapsed(!tocCollapsed)}
                  className={`absolute top-1/2 -translate-y-1/2 -right-3.5 z-10 w-7 h-7 rounded-full border-2 shadow-lg flex items-center justify-center transition-all ${
                    isDark 
                      ? 'bg-[#1a1a2e] border-purple-500/40 text-purple-400 hover:bg-purple-500/20 hover:border-purple-400' 
                      : 'bg-white border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400'
                  }`}
                  title={tocCollapsed ? 'Expand contents' : 'Collapse contents'}
                >
                  {tocCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-2 sm:p-6 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`} style={{ boxSizing: 'border-box', maxHeight: 'calc(100vh - 140px)' }}>
              <div className="w-full max-w-full md:max-w-4xl mx-auto" style={{ boxSizing: 'border-box' }}>
                <Card className={`p-3 sm:p-12 shadow-sm overflow-hidden break-words ${isDark ? 'border-purple-500/30 bg-[#12121a]' : 'border-slate-200 bg-white'} ${highlightMode ? 'highlight-active' : ''}`} style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: highlightMode ? 'text' : 'auto', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <div className={`prose max-w-none ${isDark ? 'prose-invert' : ''} ${
                    fontSize === 'sm' ? '[&_h1]:!text-xl sm:[&_h1]:!text-3xl [&_h2]:!text-base sm:[&_h2]:!text-xl [&_h3]:!text-sm sm:[&_h3]:!text-lg [&_h4]:!text-sm sm:[&_h4]:!text-base [&_p]:!text-xs sm:[&_p]:!text-sm [&_li]:!text-xs sm:[&_li]:!text-sm' :
                    fontSize === 'lg' ? '[&_h1]:!text-3xl sm:[&_h1]:!text-5xl [&_h2]:!text-xl sm:[&_h2]:!text-3xl [&_h3]:!text-lg sm:[&_h3]:!text-2xl [&_h4]:!text-base sm:[&_h4]:!text-xl [&_p]:!text-base sm:[&_p]:!text-lg [&_li]:!text-base sm:[&_li]:!text-lg' :
                    '[&_h1]:!text-2xl sm:[&_h1]:!text-4xl [&_h2]:!text-lg sm:[&_h2]:!text-2xl [&_h3]:!text-base sm:[&_h3]:!text-xl [&_h4]:!text-sm sm:[&_h4]:!text-lg [&_p]:!text-sm sm:[&_p]:!text-base [&_li]:!text-sm sm:[&_li]:!text-base'
                  } [&_h1]:!font-black [&_h1]:!border-b [&_h1]:!pb-3 sm:[&_h1]:!pb-4 [&_h1]:!mb-4 sm:[&_h1]:!mb-6 [&_h1]:!leading-tight [&_h2]:!font-bold [&_h2]:!mt-6 sm:[&_h2]:!mt-8 [&_h2]:!mb-2 sm:[&_h2]:!mb-3 [&_h2]:!leading-tight ${isDark ? '[&_h2]:!text-purple-400' : '[&_h2]:!text-purple-700'} [&_h3]:!font-semibold [&_h3]:!mt-4 sm:[&_h3]:!mt-6 [&_h3]:!mb-2 [&_p]:!leading-relaxed [&_p]:!my-2 sm:[&_p]:!my-3 [&_li]:!my-1 [&_strong]:!font-bold ${isDark ? '[&_strong]:!text-white' : '[&_strong]:!text-slate-900'} [&_ul]:!my-3 sm:[&_ul]:!my-4 [&_ol]:!my-3 sm:[&_ol]:!my-4 [&_ul]:!space-y-1 [&_ol]:!space-y-1`}>
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => {
                          const text = extractText(children);
                          return <h1 id={`heading-${slugify(text)}`}>{children}</h1>;
                        },
                        h2: ({ children }) => {
                          const text = extractText(children);
                          return <h2 id={`heading-${slugify(text)}`}>{children}</h2>;
                        },
                        h3: ({ children }) => {
                          const text = extractText(children);
                          return <h3 id={`heading-${slugify(text)}`}>{children}</h3>;
                        },
                        p: ({ children }) => {
                          const text = extractText(children);
                          const isActive = ttsOpen && activeTTSSentence && text && text.toLowerCase().includes(activeTTSSentence.toLowerCase().slice(0, 60));
                          return (
                            <p
                              ref={(el) => {
                                if (el && isActive) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              style={isActive ? { backgroundColor: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.12)', borderRadius: '6px', padding: '4px 8px', margin: '2px -8px', transition: 'background-color 0.3s ease' } : undefined}
                            >
                              {children}
                            </p>
                          );
                        },
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