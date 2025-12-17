import React from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Target, FileQuestion, AlertCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CurriculumTab({ lesson }) {
  const curriculumMap = lesson?.curriculum_map;

  if (!curriculumMap) {
    return (
      <div className="flex flex-col h-[600px]">
        <CardHeader className="border-b border-purple-800/30">
          <CardTitle className="text-purple-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Curriculum Map
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-purple-300">
            <p>No curriculum map available</p>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px]">
      <CardHeader className="border-b border-purple-800/30">
        <CardTitle className="text-purple-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Curriculum Map - {lesson.course_name}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-8">
            {/* Core Competencies */}
            {curriculumMap.core_competencies && curriculumMap.core_competencies.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-purple-100">Core Competencies</h3>
                </div>
                <div className="space-y-3">
                  {curriculumMap.core_competencies.map((comp, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/50 border border-purple-700/30 rounded-lg p-4"
                    >
                      <h4 className="font-medium text-purple-100 mb-1">{comp.name}</h4>
                      <p className="text-sm text-purple-300">{comp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Competency Weightings */}
            {curriculumMap.competency_weightings && curriculumMap.competency_weightings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-purple-100">Competency Weightings</h3>
                </div>
                <div className="grid gap-2">
                  {curriculumMap.competency_weightings.map((weight, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/50 border border-purple-700/30 rounded-lg p-3 flex items-center justify-between"
                    >
                      <span className="text-sm text-purple-100">{weight.competency_name}</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        {weight.weight_percentage}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Question Formats */}
            {curriculumMap.question_formats && curriculumMap.question_formats.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileQuestion className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-purple-100">Question Formats</h3>
                </div>
                <div className="space-y-3">
                  {curriculumMap.question_formats.map((format, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800/50 border border-purple-700/30 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-purple-100">{format.type}</h4>
                        <Badge variant="outline" className="border-purple-700/30 text-purple-300">
                          {format.frequency}
                        </Badge>
                      </div>
                      {format.examples && format.examples.length > 0 && (
                        <ul className="space-y-1">
                          {format.examples.map((example, exIdx) => (
                            <li key={exIdx} className="text-sm text-purple-300 pl-4">
                              • {example}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* High-Yield Focal Points */}
            {curriculumMap.high_yield_focal_points && curriculumMap.high_yield_focal_points.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-purple-100">High-Yield Focal Points</h3>
                </div>
                <div className="space-y-2">
                  {curriculumMap.high_yield_focal_points.map((point, idx) => (
                    <div
                      key={idx}
                      className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3"
                    >
                      <p className="text-sm text-yellow-100">{point}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Common Misconceptions */}
            {curriculumMap.common_misconceptions && curriculumMap.common_misconceptions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-semibold text-purple-100">Common Misconceptions</h3>
                </div>
                <div className="space-y-2">
                  {curriculumMap.common_misconceptions.map((misconception, idx) => (
                    <div
                      key={idx}
                      className="bg-red-900/20 border border-red-700/30 rounded-lg p-3"
                    >
                      <p className="text-sm text-red-100">{misconception}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </div>
  );
}