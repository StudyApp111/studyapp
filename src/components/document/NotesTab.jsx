import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notebook, Sparkles } from "lucide-react";

export default function NotesTab() {
  return (
    <div className="h-full flex flex-col">
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Notebook className="w-5 h-5 text-purple-600 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Generate concise, structured notes from your document. We'll wire this to your preferred prompt.
              </p>
              <Button className="gap-2 bg-purple-600 hover:bg-purple-700" disabled>
                <Sparkles className="w-4 h-4" /> Generate Notes (coming soon)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}