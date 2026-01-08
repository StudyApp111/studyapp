import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Star } from "lucide-react";
import DocTab from "../components/lesson/DocTab";
import ExamRunner from "../components/lesson/ExamRunner";
import FlashcardsTab from "../components/lesson/FlashcardsTab";
import GradeTab from "../components/lesson/GradeTab";
import StudySessionTracker from "@/components/gamification/StudySessionTracker";

function useQueryParam(key) {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search).get(key), [search, key]);
}

export default function Lesson() {
  const id = useQueryParam("id");
  const queryClient = useQueryClient();

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", id],
    queryFn: async () => {
      const list = await base44.entities.Lesson.filter({ id });
      return list?.[0];
    },
    enabled: !!id,
  });

  if (!id || isLoading || !lesson) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{lesson.course_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">StudyApp Predicted Grade:</span>
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">—</Badge>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <Card className="p-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">Study Timer</span>
            </div>
            <div className="mt-1">
              <StudySessionTracker minimized />
            </div>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="doc">
        <TabsList className="grid grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="doc">Doc</TabsTrigger>
          <TabsTrigger value="exam">Exam</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="grade">Grade</TabsTrigger>
        </TabsList>

        <TabsContent value="doc" className="pt-4">
          <DocTab lesson={lesson} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["lesson", id] })} />
        </TabsContent>

        <TabsContent value="exam" className="pt-4">
          <ExamRunner lesson={lesson} />
        </TabsContent>

        <TabsContent value="flashcards" className="pt-4">
          <FlashcardsTab lesson={lesson} />
        </TabsContent>

        <TabsContent value="grade" className="pt-4">
          <GradeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}