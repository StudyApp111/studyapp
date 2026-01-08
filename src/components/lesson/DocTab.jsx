import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TranscriptEditor from "./TranscriptEditor";

export default function DocTab({ lesson, onUpdated }) {
  const url = lesson.file_url;
  const ext = (url || "").split(".").pop()?.toLowerCase();
  const isPDF = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg"].includes(ext || "");

  return (
    <Tabs defaultValue={url ? (isPDF || isImage ? "document" : "transcript") : "transcript"}>
      <TabsList className="bg-purple-50 rounded-lg p-1">
        {url && <TabsTrigger value="document" className="data-[state=active]:bg-white data-[state=active]:text-purple-700 rounded-md">Document</TabsTrigger>}
        <TabsTrigger value="transcript" className="data-[state=active]:bg-white data-[state=active]:text-purple-700 rounded-md">Transcript</TabsTrigger>
      </TabsList>

      {url && (
        <TabsContent value="document" className="pt-3">
          {isPDF ? (
            <div className="w-full h-[70vh] rounded-xl overflow-hidden border border-purple-100 bg-white shadow-sm">
              <iframe title="PDF" src={`${url}#toolbar=1`} className="w-full h-full" />
            </div>
          ) : isImage ? (
            <div className="w-full flex items-center justify-center p-4 bg-purple-50/50 rounded-xl border border-purple-100">
              <img src={url} alt="Document" className="max-h-[70vh] object-contain" />
            </div>
          ) : (
            <div className="text-sm text-slate-700 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              Preview not available for this file type. Please use the Transcript tab.
            </div>
          )}
        </TabsContent>
      )}

      <TabsContent value="transcript" className="pt-3">
        <TranscriptEditor lesson={lesson} onSaved={onUpdated} />
      </TabsContent>
    </Tabs>
  );
}