import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, CheckCircle, Clock, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";

const statusConfig = {
  created: { label: "Start Diagnostic", color: "bg-purple-100 text-purple-700", icon: PlayCircle },
  diagnostic_completed: { label: "Start Worksheet", color: "bg-yellow-100 text-yellow-700", icon: PlayCircle },
  worksheet_completed: { label: "View Feedback", color: "bg-amber-100 text-amber-700", icon: PlayCircle },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle }
};

export default function LessonCard({ lesson }) {
  const navigate = useNavigate();
  const status = statusConfig[lesson.status] || statusConfig.created;

  const handleContinue = () => {
    if (lesson.status === "created") {
      navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
    } else if (lesson.status === "diagnostic_completed") {
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
    } else if (lesson.status === "worksheet_completed") {
      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-2">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <Badge className={status.color}>
              {status.label}
            </Badge>
          </div>
          <CardTitle className="text-xl text-slate-900">{lesson.course_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lesson.description && (
              <p className="text-sm text-slate-600 line-clamp-3">{lesson.description}</p>
            )}
            
            {lesson.curriculum_map && (
              <div className="flex flex-wrap gap-2">
                {lesson.curriculum_map.key_concepts?.slice(0, 3).map((concept, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {concept}
                  </Badge>
                ))}
              </div>
            )}

            {lesson.status !== "completed" && (
              <Button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
              >
                <status.icon className="w-4 h-4 mr-2" />
                {status.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}