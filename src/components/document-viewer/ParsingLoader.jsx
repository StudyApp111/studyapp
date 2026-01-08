import React from "react";
import { Loader2 } from "lucide-react";

export default function ParsingLoader({ title = "Parsing your document", description = "We're extracting text and optimizing it for faster quiz generation..." }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="bg-white/90 border border-purple-200 rounded-2xl shadow-md p-5 max-w-md w-full text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-purple-600/10 flex items-center justify-center mb-3">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}