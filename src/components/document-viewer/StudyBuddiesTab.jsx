import React from "react";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function StudyBuddiesTab({ lessonId, lessonName }) {
  return (
    <div className="space-y-4 p-4">
      <Card className="p-6 bg-white/90 backdrop-blur-xl border-purple-200">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Collaboration Coming Soon</h3>
          <p className="text-sm text-slate-600 max-w-sm">
            Study buddy features are being redesigned for an improved experience.
          </p>
        </div>
      </Card>
    </div>
  );
}