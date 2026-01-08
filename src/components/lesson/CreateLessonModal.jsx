import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

export default function CreateLessonModal({ open, onOpenChange }) {
  const [courseName, setCourseName] = useState("");
  const [mode, setMode] = useState("upload");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      setError("File too large. Max size is 15MB.");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleCreate = async () => {
    setError("");
    if (!courseName.trim()) {
      setError("Please enter a course name.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    try {
      let fileUrl = null;
      let transcript = "";
      let inputType = mode === "upload" ? "file" : "description";

      if (mode === "upload" && file) {
        // Upload file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        // Try OCR for pdf/images
        const lower = file.name.toLowerCase();
        const isOcrCapable = /(pdf|png|jpg|jpeg)$/.test(lower.split('.').pop() || "");
        if (isOcrCapable) {
          const resp = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: fileUrl,
            json_schema: {
              type: "object",
              properties: { transcript: { type: "string" } }
            }
          });
          const out = resp?.output;
          if (Array.isArray(out)) {
            transcript = out[0]?.transcript || "";
          } else if (out && typeof out === 'object') {
            transcript = out.transcript || "";
          }
        }
      }

      if (mode === "description") {
        transcript = description.trim();
      }

      // Create lesson
      const lesson = await base44.entities.Lesson.create({
        course_name: courseName.trim(),
        description: mode === "description" ? description.trim() : undefined,
        input_type: inputType,
        file_url: fileUrl || undefined,
        file_urls: fileUrl ? [fileUrl] : undefined,
        extracted_content: transcript || undefined,
      });

      onOpenChange(false);
      window.location.href = createPageUrl("Lesson") + `?id=${lesson.id}`;
    } catch (e) {
      setError(e?.message || "Failed to create lesson.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Lesson</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Input
            placeholder="Course name (e.g., Calculus I)"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" /> Upload Document
              </TabsTrigger>
              <TabsTrigger value="description" className="gap-2">
                <FileText className="w-4 h-4" /> Type Description
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="pt-3">
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={onFileChange}
                />
                <p className="text-xs text-slate-500">Max file size: 15MB. OCR supported for PDF/PNG/JPG.</p>
              </div>
            </TabsContent>

            <TabsContent value="description" className="pt-3">
              <Textarea
                placeholder="Paste or write your lesson description here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px]"
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Lesson'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}