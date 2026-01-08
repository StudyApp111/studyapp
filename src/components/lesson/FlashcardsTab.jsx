import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function FlashcardsTab({ lesson }) {
  const qc = useQueryClient();
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["flashcards", lesson.id],
    queryFn: () => base44.entities.Flashcard.filter({ lesson_id: lesson.id }),
  });

  const [generating, setGenerating] = React.useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const text = lesson.extracted_content || lesson.description || "";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 12 concise study flashcards from the following content. Return JSON only with an array 'flashcards' of {question, answer}. Keep questions short and focused.`,
        response_json_schema: {
          type: "object",
          properties: {
            flashcards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" }
                }
              }
            }
          }
        },
      });
      const toCreate = (res?.flashcards || []).map((c) => ({
        lesson_id: lesson.id,
        question: c.question,
        answer: c.answer,
      }));
      if (toCreate.length) {
        await base44.entities.Flashcard.bulkCreate(toCreate);
        await qc.invalidateQueries({ queryKey: ["flashcards", lesson.id] });
      }
    } finally { setGenerating(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-600">AI-powered flashcards to reinforce key concepts.</p>
        <Button onClick={generate} className="bg-purple-600 hover:bg-purple-700" disabled={generating}>
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Generating...</> : 'Generate Flashcards'}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-4 text-sm text-slate-500">Loading...</div>
      ) : cards.length === 0 ? (
        <Card className="p-4 text-sm text-slate-600">No flashcards yet. Click Generate to create some.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c, idx) => (
            <motion.div key={c.id || idx} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}>
              <Card className="p-4 hover:shadow-lg transition-all">
                <div className="font-medium mb-2">{c.question}</div>
                <div className="text-sm text-slate-600">{c.answer}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}