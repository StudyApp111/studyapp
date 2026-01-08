import React from "react";
import { FileText, FileImage } from "lucide-react";
import TranscriptEditor from "./TranscriptEditor";

export default function DocTab({ lesson, onUpdated }) {
  const url = lesson.file_url;
  const ext = (url || "").split(".").pop()?.toLowerCase();
  const isPDF = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg"].includes(ext || "");
  const [view, setView] = React.useState(url && (isPDF || isImage) ? "document" : "transcript");

  return (
    <div className="space-y-4">
      {url && (
        <div className="flex gap-2">
          <button
            onClick={() => setView("document")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              view === "document"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            <FileImage className="w-4 h-4" />
            View Document
          </button>
          <button
            onClick={() => setView("transcript")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              view === "transcript"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            Edit Transcript
          </button>
        </div>
      )}

      {view === "document" && url ? (
        <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden shadow-lg">
          {isPDF ? (
            <div className="w-full h-[75vh]">
              <iframe title="PDF" src={`${url}#toolbar=1`} className="w-full h-full" />
            </div>
          ) : isImage ? (
            <div className="w-full flex items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-yellow-50/30">
              <img src={url} alt="Document" className="max-h-[70vh] rounded-xl shadow-2xl" />
            </div>
          ) : (
            <div className="text-sm text-slate-700 p-6 bg-yellow-50 text-center">
              Preview not available. Please view the transcript.
            </div>
          )}
        </div>
      ) : (
        <TranscriptEditor lesson={lesson} onSaved={onUpdated} />
      )}
    </div>
  );
}