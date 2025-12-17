import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const DemoCard = ({ front, back }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <button onClick={() => setFlipped(!flipped)} className="relative w-full h-32 md:h-36 bg-white border rounded-xl shadow-sm p-4 text-left transition-transform hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-50 to-amber-50 opacity-60" />
      <div className="relative z-10 h-full flex items-center justify-center">
        <p className="text-sm md:text-base font-medium text-slate-800">{flipped ? back : front}</p>
      </div>
    </button>
  );
};

export default function FlashcardsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Flashcards</h3>
        <Button className="gap-2 bg-purple-600 hover:bg-purple-700" disabled>
          <Sparkles className="w-4 h-4" /> Generate from Notes (coming soon)
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[{f:"Key term 1", b:"Definition 1"},{f:"Concept 2", b:"Explanation 2"},{f:"Author", b:"Work"}].map((c,i)=>(
          <DemoCard key={i} front={c.f} back={c.b} />
        ))}
      </div>
      <Card>
        <CardContent className="p-3 text-xs text-slate-500">
          Flashcards will be generated using your summarized notes (Gemini 2.5 Flash). This is a preview UI.
        </CardContent>
      </Card>
    </div>
  );
}