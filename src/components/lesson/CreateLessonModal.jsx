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
      <DialogContent className="max-w-lg bg-white/95 backdrop-blur-xl rounded-2xl border border-purple-100 shadow-2xl">
        <DialogHeader className="p-0">
          <div className="bg-gradient-to-r from-purple-600 to-yellow-500 text-white px-5 py-4">
            <DialogTitle className="text-lg font-bold">Create Lesson</DialogTitle>
            <p className="text-xs/5 opacity-90">Upload notes or type a description</p>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Course name</label>
            <Input
              placeholder="e.g., Calculus I"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="focus-visible:ring-purple-600"
            />
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid grid-cols-2 bg-purple-50 rounded-lg p-1">
              <TabsTrigger value="upload" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-purple-700 rounded-md">
                <Upload className="w-4 h-4" /> Upload Document
              </TabsTrigger>
              <TabsTrigger value="description" className="gap-2 data-[state=active]:bg-white data-[state=active]:text-purple-700 rounded-md">
                <FileText className="w-4 h-4" /> Type Description
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="pt-3">
              <div className="space-y-2">
                <input
                  id="lesson-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={onFileChange}
                  className="hidden"
                />
                <label htmlFor="lesson-file" className="block border-2 border-dashed border-purple-200 rounded-xl p-5 text-center cursor-pointer hover:border-purple-300 transition-colors bg-purple-50/40">
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <Upload className="w-6 h-6 text-purple-600" />
                    <div className="text-sm"><span className="font-medium text-slate-800">Click to upload</span> or drag and drop</div>
                    <div className="text-xs text-slate-500">PDF, PNG, JPG, DOC up to 15MB • OCR enabled</div>
                    {file && <div className="text-xs mt-1 text-purple-700">Selected: {file.name}</div>}
                  </div>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="description" className="pt-3">
              <Textarea
                placeholder="Paste or write your lesson description here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px] focus-visible:ring-purple-600"
              />
              <p className="text-xs text-slate-500 mt-2">Tip: Clear, well-structured descriptions generate better exams and flashcards.</p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="border-slate-200">Cancel</Button>
            <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700 ring-2 ring-yellow-400/0 hover:ring-yellow-400/40" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Lesson'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}