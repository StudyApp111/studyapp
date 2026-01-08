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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-yellow-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-purple-100/50 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-yellow-500 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{lesson.course_name}</h1>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80">Predicted Grade:</span>
                  <Badge className="bg-yellow-400 text-yellow-900 border-0 font-semibold">—</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3">
                <Clock className="w-5 h-5 text-white" />
                <div>
                  <div className="text-xs text-white/80 font-medium">Study Timer</div>
                  <StudySessionTracker minimized />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-purple-100">
            <Tabs defaultValue="doc" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-0 px-6 gap-2">
                <TabsTrigger
                  value="doc"
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6"
                >
                  📄 Document
                </TabsTrigger>
                <TabsTrigger
                  value="exam"
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6"
                >
                  ✍️ Exam
                </TabsTrigger>
                <TabsTrigger
                  value="flashcards"
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6"
                >
                  🎴 Flashcards
                </TabsTrigger>
                <TabsTrigger
                  value="grade"
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6"
                >
                  ⭐ Grade
                </TabsTrigger>
              </TabsList>

              <TabsContent value="doc" className="p-6">
                <DocTab lesson={lesson} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["lesson", id] })} />
              </TabsContent>

              <TabsContent value="exam" className="p-6">
                <ExamRunner lesson={lesson} />
              </TabsContent>

              <TabsContent value="flashcards" className="p-6">
                <FlashcardsTab lesson={lesson} />
              </TabsContent>

              <TabsContent value="grade" className="p-6">
                <GradeTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}