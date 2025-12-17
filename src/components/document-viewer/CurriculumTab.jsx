import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Target, FileQuestion, AlertCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CurriculumTab({ lesson }) {
  const curriculumMap = lesson?.curriculum_map;

  if (!curriculumMap) {
    return (
      <div className="bg-white/90 border border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] rounded-xl shadow-xl overflow-hidden">
        <div className="border-b border-purple-200 px-6 py-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <BookOpen className="w-5 h-5" />
            Curriculum Map
          </div>
        </div>

        <div className="flex items-center justify-center h-[calc(100%-70px)] p-6">
          <div className="text-center text-slate-500">
            <p>No curriculum map available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 border border-purple-200 backdrop-blur-xl h-[calc(100vh-180px)] rounded-xl shadow-xl overflow-hidden">
      <div className="border-b border-purple-200 px-6 py-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <BookOpen className="w-5 h-5" />
          Curriculum Map
        </div>
      </div>

      <ScrollArea className="h-[calc(100%-70px)]">
        <div className="p-6 space-y-8">
            {/* Core Competencies */}
            {curriculumMap.core_competencies && curriculumMap.core_competencies.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Core Competencies</h3>
                </div>
                <div className="space-y-3">
                  {curriculumMap.core_competencies.map((comp, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm"
                    >
                      <h4 className="font-medium text-slate-900 mb-1">{comp.name}</h4>
                      <p className="text-sm text-slate-600">{comp.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Competency Weightings */}
            {curriculumMap.competency_weightings && curriculumMap.competency_weightings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Competency Weightings</h3>
                </div>
                <div className="grid gap-2">
                  {curriculumMap.competency_weightings.map((weight, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-purple-200 rounded-lg p-3 flex items-center justify-between shadow-sm"
                    >
                      <span className="text-sm text-slate-900">{weight.competency_name}</span>
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
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
                  <FileQuestion className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Question Formats</h3>
                </div>
                <div className="space-y-3">
                  {curriculumMap.question_formats.map((format, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900">{format.type}</h4>
                        <Badge variant="outline" className="border-purple-200 text-slate-700">
                          {format.frequency}
                        </Badge>
                      </div>
                      {format.examples && format.examples.length > 0 && (
                        <ul className="space-y-1">
                          {format.examples.map((example, exIdx) => (
                            <li key={exIdx} className="text-sm text-slate-600 pl-4">
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
                  <Target className="w-5 h-5 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-slate-900">High-Yield Focal Points</h3>
                </div>
                <div className="space-y-2">
                  {curriculumMap.high_yield_focal_points.map((point, idx) => (
                    <div
                      key={idx}
                      className="bg-yellow-50 border border-yellow-300 rounded-lg p-3"
                    >
                      <p className="text-sm text-slate-900">{point}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Common Misconceptions */}
            {curriculumMap.common_misconceptions && curriculumMap.common_misconceptions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Common Misconceptions</h3>
                </div>
                <div className="space-y-2">
                  {curriculumMap.common_misconceptions.map((misconception, idx) => (
                    <div
                      key={idx}
                      className="bg-red-50 border border-red-300 rounded-lg p-3"
                    >
                      <p className="text-sm text-slate-900">{misconception}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}