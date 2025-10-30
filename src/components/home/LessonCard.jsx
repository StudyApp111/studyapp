import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, CheckCircle, Clock, PlayCircle, Brain, FileText, Award } from "lucide-react";
import { motion } from "framer-motion";

const statusConfig = {
  created: { 
    label: "Start Diagnostic Quiz", 
    color: "bg-purple-100 text-purple-700 border-purple-300", 
    icon: Brain,
    iconColor: "text-purple-600",
    progress: "0%",
    description: "Begin with a diagnostic assessment"
  },
  diagnostic_completed: { 
    label: "Start Worksheet", 
    color: "bg-yellow-100 text-yellow-700 border-yellow-300", 
    icon: FileText,
    iconColor: "text-yellow-600",
    progress: "33%",
    description: "Take the personalized exam"
  },
  worksheet_completed: { 
    label: "View Feedback", 
    color: "bg-amber-100 text-amber-700 border-amber-300", 
    icon: Award,
    iconColor: "text-amber-600",
    progress: "67%",
    description: "See your results and next steps"
  },
  completed: { 
    label: "Review Results", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-300", 
    icon: CheckCircle,
    iconColor: "text-emerald-600",
    progress: "100%",
    description: "Lesson complete"
  }
};

export default function LessonCard({ lesson }) {
  const navigate = useNavigate();
  const status = statusConfig[lesson.status] || statusConfig.created;
  const StatusIcon = status.icon;

  const handleContinue = () => {
    if (lesson.status === "created") {
      navigate(createPageUrl("DiagnosticQuiz") + `?lessonId=${lesson.id}`);
    } else if (lesson.status === "diagnostic_completed") {
      navigate(createPageUrl("Worksheet") + `?lessonId=${lesson.id}`);
    } else if (lesson.status === "worksheet_completed" || lesson.status === "completed") {
      navigate(createPageUrl("Feedback") + `?lessonId=${lesson.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200">
          <div 
            className={`h-full transition-all duration-500 ${
              lesson.status === 'completed' ? 'bg-emerald-500' : 
              lesson.status === 'worksheet_completed' ? 'bg-amber-500' :
              lesson.status === 'diagnostic_completed' ? 'bg-yellow-500' :
              'bg-purple-500'
            }`}
            style={{ width: status.progress }}
          />
        </div>

        <CardHeader className="pb-4 pt-6">
          <div className="flex items-start justify-between mb-3">
            <StatusIcon className={`w-8 h-8 ${status.iconColor}`} />
            <Badge className={`${status.color} border`}>
              {lesson.status === 'completed' ? '✓ Complete' : status.progress}
            </Badge>
          </div>
          <CardTitle className="text-xl text-slate-900">{lesson.course_name}</CardTitle>
          <p className="text-sm text-slate-500 mt-1">{status.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lesson.description && (
              <p className="text-sm text-slate-600 line-clamp-2">{lesson.description}</p>
            )}
            
            {lesson.curriculum_map?.core_competencies && (
              <div className="flex flex-wrap gap-2">
                {lesson.curriculum_map.core_competencies.slice(0, 2).map((comp, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {comp.name}
                  </Badge>
                ))}
                {lesson.curriculum_map.core_competencies.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{lesson.curriculum_map.core_competencies.length - 2} more
                  </Badge>
                )}
              </div>
            )}

            <Button
              onClick={handleContinue}
              className={`w-full ${
                lesson.status === 'completed' 
                  ? 'bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900'
                  : 'bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900'
              }`}
            >
              <StatusIcon className="w-4 h-4 mr-2" />
              {status.label}
            </Button>

            {lesson.status === 'completed' && (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium">
                <CheckCircle className="w-4 h-4" />
                <span>Lesson Complete</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}