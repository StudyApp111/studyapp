import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Notebook, ClipboardList, Sparkles, GraduationCap, BookOpen } from "lucide-react";
import DocViewer from "../components/document/DocViewer";
import DocChat from "../components/document/DocChat";
import NotesTab from "../components/document/NotesTab";
import FlashcardsTab from "../components/document/FlashcardsTab";
import CurriculumTab from "../components/document/CurriculumTab";
import PredictedGradeTab from "../components/document/PredictedGradeTab";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function DocumentLesson() {
  const urlParams = new URLSearchParams(window.location.search);
  const lessonId = urlParams.get("lessonId");

  const { data: lesson } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const rows = await base44.entities.Lesson.filter({ id: lessonId });
      return rows[0];
    },
    enabled: !!lessonId,
  });

  const { data: quiz } = useQuery({
    queryKey: ["diagnosticQuiz", lessonId],
    queryFn: async () => {
      const rows = await base44.entities.DiagnosticQuiz.filter({ lesson_id: lessonId });
      return rows[0];
    },
    enabled: !!lessonId,
  });

  const { data: worksheets = [] } = useQuery({
    queryKey: ["worksheets", lessonId],
    queryFn: async () => base44.entities.Worksheet.filter({ lesson_id: lessonId }),
    enabled: !!lessonId,
    initialData: [],
  });

  const fileUrl = lesson?.file_url || null;
  const contextText = (lesson && lesson.extracted_content) || ""; // may be empty if not persisted
  const curriculum = lesson?.curriculum_map;
  const quizCompleted = !!quiz?.completed;
  const hasWorksheet = worksheets.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Document Lesson</h1>
            <p className="text-sm text-slate-600">{lesson?.course_name || "Untitled Course"}</p>
          </div>
          {lesson?.input_type === "file" && (
            <Badge className="bg-purple-100 text-purple-700 border">FILE</Badge>
          )}
        </div>

        <Tabs defaultValue="tutor" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2 rounded-xl bg-white/80 p-1 border">
            <TabsTrigger value="tutor" className="gap-2"><MessageSquare className="w-4 h-4" /> AI Tutor</TabsTrigger>
            <TabsTrigger value="notes" className="gap-2"><Notebook className="w-4 h-4" /> Notes</TabsTrigger>
            <TabsTrigger value="quiz" className="gap-2"><ClipboardList className="w-4 h-4" /> Quiz</TabsTrigger>
            <TabsTrigger value="grade" className="gap-2"><GraduationCap className="w-4 h-4" /> Predicted Grade</TabsTrigger>
            <TabsTrigger value="flashcards" className="gap-2"><Sparkles className="w-4 h-4" /> Flashcards</TabsTrigger>
            <TabsTrigger value="curriculum" className="gap-2"><BookOpen className="w-4 h-4" /> Curriculum</TabsTrigger>
          </TabsList>

          {/* Layout: Left panel (tab content) + Right panel (document viewer) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 order-2 md:order-1 min-h-[420px]">
              <TabsContent value="tutor" className="m-0 h-full"><DocChat contextText={contextText} /></TabsContent>
              <TabsContent value="notes" className="m-0 h-full"><NotesTab /></TabsContent>
              <TabsContent value="quiz" className="m-0 h-full">
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <p className="text-sm text-slate-700 mb-3">Start your diagnostic quiz. This uses the same generation flow as before.</p>
                  <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => (window.location.href = createPageUrl("DiagnosticQuiz") + `?lessonId=${lessonId}`)}>Open Diagnostic Quiz</Button>
                </div>
              </TabsContent>
              <TabsContent value="grade" className="m-0 h-full"><PredictedGradeTab lessonId={lessonId} quizCompleted={quizCompleted} hasWorksheet={hasWorksheet} /></TabsContent>
              <TabsContent value="flashcards" className="m-0 h-full"><FlashcardsTab /></TabsContent>
              <TabsContent value="curriculum" className="m-0 h-full"><div className="bg-white rounded-xl border shadow-sm p-4"><CurriculumTab curriculum={curriculum} /></div></TabsContent>
            </div>

            <div className="md:col-span-3 order-1 md:order-2 min-h-[480px]">
              <DocViewer fileUrl={fileUrl} fallbackText={contextText} />
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}