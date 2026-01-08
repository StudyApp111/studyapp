import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Play, Pause } from "lucide-react";
import DocTab from "../components/lesson/DocTab";
import ExamRunner from "../components/lesson/ExamRunner";
import FlashcardsTab from "../components/lesson/FlashcardsTab";
import GradeTab from "../components/lesson/GradeTab";

function useQueryParam(key) {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search).get(key), [search, key]);
}

export default function Lesson() {
  const id = useQueryParam("id");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [studyTime, setStudyTime] = React.useState(0);
  const [isTimerRunning, setIsTimerRunning] = React.useState(false);

  React.useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl("Home"))}
            className="text-white hover:bg-white/20 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">{lesson.course_name}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-white/90">
            StudyApp Predicted Grade: <Badge className="bg-yellow-400 text-yellow-900 border-0 ml-1">—</Badge>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
            <span className="font-mono text-sm">{formatTime(studyTime)}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="h-7 w-7 text-white hover:bg-white/20"
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Pills */}
      <Tabs defaultValue="doc" className="w-full">
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <TabsList className="bg-transparent border-0 gap-2 h-auto p-0">
            <TabsTrigger
              value="doc"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-full px-6 py-2 text-sm font-medium"
            >
              📄 Doc
            </TabsTrigger>
            <TabsTrigger
              value="exam"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-full px-6 py-2 text-sm font-medium"
            >
              ✍️ Exam
            </TabsTrigger>
            <TabsTrigger
              value="flashcards"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-full px-6 py-2 text-sm font-medium"
            >
              🎴 Flashcards
            </TabsTrigger>
            <TabsTrigger
              value="grade"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-full px-6 py-2 text-sm font-medium"
            >
              ⭐ Grade
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-6">
          <TabsContent value="doc" className="mt-0">
            <DocTab lesson={lesson} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["lesson", id] })} />
          </TabsContent>

          <TabsContent value="exam" className="mt-0">
            <ExamRunner lesson={lesson} />
          </TabsContent>

          <TabsContent value="flashcards" className="mt-0">
            <FlashcardsTab lesson={lesson} />
          </TabsContent>

          <TabsContent value="grade" className="mt-0">
            <GradeTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}