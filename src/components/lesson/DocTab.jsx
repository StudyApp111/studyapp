import React from "react";
import { Eye, FileText, Download, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import TranscriptEditor from "./TranscriptEditor";

export default function DocTab({ lesson, onUpdated }) {
  const url = lesson.file_url;
  const ext = (url || "").split(".").pop()?.toLowerCase();
  const fileName = url ? url.split("/").pop() : "document";
  const [view, setView] = React.useState("document");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView("document")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            view === "document"
              ? "bg-gray-200 text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Eye className="w-4 h-4" />
          Document View
        </button>
        <button
          onClick={() => setView("transcript")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            view === "transcript"
              ? "bg-gray-200 text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          Transcript
        </button>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {view === "document" && url ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
            <FileIcon className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{fileName}</h3>
          <p className="text-sm text-gray-500 mb-8 max-w-md">
            This document type cannot be previewed directly. The text has been extracted and is available in the Transcript view.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <a href={url} download className="gap-2">
                <Download className="w-4 h-4" />
                Download Original
              </a>
            </Button>
            <Button onClick={() => setView("transcript")} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Eye className="w-4 h-4" />
              View Transcript
            </Button>
          </div>
        </div>
      ) : (
        <TranscriptEditor lesson={lesson} onSaved={onUpdated} />
      )}
    </div>
  );
}