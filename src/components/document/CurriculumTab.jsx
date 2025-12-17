import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function CurriculumTab({ curriculum }) {
  if (!curriculum) {
    return <div className="text-sm text-slate-600">No curriculum map available yet.</div>;
  }
  const { core_competencies = [], competency_weightings = [], question_formats = [], high_yield_focal_points = [], common_misconceptions = [] } = curriculum;
  
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold text-slate-800 mb-2">Core Competencies</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
            {core_competencies.map((c, i) => (
              <li key={i}><span className="font-medium">{c.name}:</span> {c.description}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Competency Weightings</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {competency_weightings.map((w, i) => (
                <li key={i}>{w.competency_name} — {w.weight_percentage}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Question Formats</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {question_formats.map((q, i) => (
                <li key={i}><span className="font-medium">{q.type}</span> — {q.frequency}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">High‑Yield Focal Points</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {high_yield_focal_points.map((p, i) => (<li key={i}>{p}</li>))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Common Misconceptions</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {common_misconceptions.map((m, i) => (<li key={i}>{m}</li>))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}