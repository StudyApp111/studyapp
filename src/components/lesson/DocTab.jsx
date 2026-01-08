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
      <TabsList>
        {url && <TabsTrigger value="document">Document</TabsTrigger>}
        <TabsTrigger value="transcript">Transcript</TabsTrigger>
      </TabsList>

      {url && (
        <TabsContent value="document" className="pt-3">
          {isPDF ? (
            <div className="w-full h-[70vh] rounded-lg overflow-hidden border">
              <iframe title="PDF" src={`${url}#toolbar=1`} className="w-full h-full" />
            </div>
          ) : isImage ? (
            <div className="w-full flex items-center justify-center p-4 bg-slate-50 rounded-lg border">
              <img src={url} alt="Document" className="max-h-[70vh] object-contain" />
            </div>
          ) : (
            <div className="text-sm text-slate-600 p-4 bg-slate-50 rounded-lg border">
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