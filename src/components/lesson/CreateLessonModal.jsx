import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, AlertTriangle, Sparkles, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

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
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
      }

      if (mode === "description") {
        transcript = description.trim();
      }

      const lesson = await base44.entities.Lesson.create({
        course_name: courseName.trim(),
        description: mode === "description" ? description.trim() : undefined,
        input_type: inputType,
        file_url: fileUrl || undefined,
        file_urls: fileUrl ? [fileUrl] : undefined,
        extracted_content: transcript || undefined,
      });

      setCourseName("");
      setDescription("");
      setFile(null);
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
      <DialogContent className="max-w-xl p-0 bg-white border-0 rounded-3xl shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-yellow-500 p-8 pb-12">
          <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Lesson</h2>
              <p className="text-white/90 text-sm">Turn your notes into study materials</p>
            </div>
          </div>
        </div>

        <div className="p-8 -mt-6 bg-white rounded-t-3xl space-y-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-900">Course Name</label>
            <Input
              placeholder="e.g., Calculus I, Biology 101..."
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="h-12 text-base border-slate-200 focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:border-transparent"
            />
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("upload")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  mode === "upload"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload File
              </button>
              <button
                onClick={() => setMode("description")}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  mode === "description"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Type Text
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "upload" ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <input
                    id="lesson-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="lesson-file-input"
                    className="block relative group cursor-pointer"
                  >
                    <div className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-all">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-purple-600" />
                      </div>
                      <div className="text-base font-medium text-slate-900 mb-1">
                        {file ? file.name : "Drop your file here"}
                      </div>
                      <div className="text-sm text-slate-500">
                        PDF, PNG, JPG, DOC • Max 15MB • OCR enabled
                      </div>
                    </div>
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="description"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Textarea
                    placeholder="Paste your notes, textbook chapter, or lesson description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[160px] text-base border-slate-200 focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:border-transparent resize-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 h-12 border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-600/30 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Lesson
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}