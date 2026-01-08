import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ExamQuestion from "@/components/exam/ExamQuestion";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function ExamRunner({ lesson }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const transcript = lesson.extracted_content || lesson.description || "";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Create 8 mixed exam questions (MCQ, True/False, Short Answer, Fill in the Blanks) based on this content. Provide concise, rigorous questions. Return JSON only.`,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_type: { type: "string" },
                  question_text: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "string" },
                  explanation: { type: "string" }
                }
              }
            }
          }
        },
        file_urls: [],
      });
      setQuestions(res?.questions || []);
      setIndex(0);
    } finally { setLoading(false); }
  };

  if (!questions.length) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-600 mb-3">Generate a quick diagnostic exam based on your document/description.</p>
        <Button onClick={generate} className="bg-purple-600 hover:bg-purple-700" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Generating...</> : 'Generate Exam'}
        </Button>
      </Card>
    );
  }

  const q = questions[index];
  return (
    <div>
      <div className="mb-3 text-sm text-slate-500">Question {index + 1} of {questions.length}</div>
      <ExamQuestion
        question={{
          question_type: q.question_type,
          difficulty_index: "",
          question_text: q.question_text,
          options: q.options || [],
          correct_answer: q.correct_answer,
          explanation: q.explanation || "",
        }}
        onAnswer={() => {}}
      />
      <div className="flex justify-between mt-4">
        <Button variant="outline" disabled={index===0} onClick={() => setIndex((i)=>i-1)}>Previous</Button>
        <Button variant="outline" disabled={index===questions.length-1} onClick={() => setIndex((i)=>i+1)}>Next</Button>
      </div>
    </div>
  );
}