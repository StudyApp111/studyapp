import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Link as LinkIcon, Loader2, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function MaterialUploadPrompt({ lesson, onComplete }) {
  const { isDark } = useTheme();
  const [uploadMethod, setUploadMethod] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    getUser();
  }, []);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      // Upload files
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const result = await base44.integrations.Core.UploadFile({ file });
        return { url: result.file_url, name: file.name };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      // Extract content from files
      const extractionResults = await Promise.allSettled(
        uploadedFiles.map(f => base44.functions.invoke('extractDocumentContent', { file_url: f.url }))
      );

      const extractedParts = extractionResults
        .filter(r => r.status === 'fulfilled' && r.value?.data?.extracted_content)
        .map(r => r.value.data.extracted_content);

      const extractedContent = extractedParts.join("\n\n--- NEXT DOCUMENT ---\n\n").trim();

      // Compress if needed
      let compressedContent = extractedContent;
      if (extractedContent.length > 2500) {
        try {
          const compResult = await base44.functions.invoke('compressDocument', { content: extractedContent });
          compressedContent = compResult?.data?.compressed_content || extractedContent;
        } catch (err) {
          console.warn("Compression failed:", err);
        }
      }

      // Update lesson
      await base44.entities.Lesson.update(lesson.id, {
        file_url: uploadedFiles[0].url,
        file_urls: uploadedFiles.map(f => f.url),
        input_type: "file",
        extracted_content: extractedContent,
        compressed_content: compressedContent
      });

      // Generate exam and curriculum in background
      base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id }).catch(err => console.error(err));
      
      const user = await base44.auth.me();
      const profile = user.learning_profile_id ? await base44.entities.LearningProfile.get(user.learning_profile_id) : null;
      const curriculumPrompt = `Educational Curriculum Analysis Request
Role: Expert curriculum analyst. Generate concise curriculum profile for ${lesson.course_name}.
Student Grade: ${profile?.grade || "N/A"}
School: ${profile?.school || "N/A"}
Content: ${compressedContent || "N/A"}

Output JSON with: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.`;
      
      base44.functions.invoke('curriculumMapping', { prompt: curriculumPrompt })
        .then(async (result) => {
          if (result?.data) {
            await base44.entities.Lesson.update(lesson.id, { curriculum_map: result.data });
          }
        })
        .catch(err => console.warn(err));

      toast.success("Materials uploaded! AI is processing...");
      onComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload materials");
    } finally {
      setUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    setUploading(true);
    try {
      await base44.entities.Lesson.update(lesson.id, {
        description: textInput,
        extracted_content: textInput,
        compressed_content: textInput,
        input_type: "description"
      });

      // Background processing
      base44.functions.invoke('autoGenerateExam1', { lesson_id: lesson.id }).catch(err => console.error(err));
      
      const user = await base44.auth.me();
      const profile = user.learning_profile_id ? await base44.entities.LearningProfile.get(user.learning_profile_id) : null;
      const curriculumPrompt = `Educational Curriculum Analysis Request
Role: Expert curriculum analyst. Generate concise curriculum profile for ${lesson.course_name}.
Student Grade: ${profile?.grade || "N/A"}
School: ${profile?.school || "N/A"}
Content: ${textInput || "N/A"}

Output JSON with: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.`;
      
      base44.functions.invoke('curriculumMapping', { prompt: curriculumPrompt })
        .then(async (result) => {
          if (result?.data) {
            await base44.entities.Lesson.update(lesson.id, { curriculum_map: result.data });
          }
        })
        .catch(err => console.warn(err));

      toast.success("Content saved! AI is processing...");
      onComplete();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save content");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setUploading(true);
    try {
      await base44.entities.Lesson.update(lesson.id, {
        url: urlInput,
        input_type: "url"
      });

      toast.success("URL saved! Add your study materials next.");
      setUploadMethod(null);
      setUrlInput("");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save URL");
    } finally {
      setUploading(false);
    }
  };

  const userName = user?.full_name?.split(' ')[0] || 'there';

  if (!uploadMethod) {
    return (
      <div className={`min-h-[60vh] flex items-center justify-center p-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`w-full max-w-2xl ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-purple-200'}`}>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 shadow-xl">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl md:text-3xl">Hey {userName}, Upload Your Materials</CardTitle>
            <CardDescription className={isDark ? 'text-purple-200/80' : 'text-slate-600'}>
              We'll analyze them and build your personalized study plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setUploadMethod('file')}
              className="w-full h-16 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
            >
              <FileText className="w-5 h-5 mr-2" />
              Upload Files (PDF, DOCX, Images)
            </Button>
            <Button
              onClick={() => setUploadMethod('text')}
              variant="outline"
              className={`w-full h-16 text-lg ${isDark ? 'border-purple-500/50 hover:bg-purple-500/10' : 'border-purple-200 hover:bg-purple-50'}`}
            >
              <FileText className="w-5 h-5 mr-2" />
              Paste Text or Notes
            </Button>
            <Button
              onClick={() => setUploadMethod('url')}
              variant="outline"
              className={`w-full h-16 text-lg ${isDark ? 'border-purple-500/50 hover:bg-purple-500/10' : 'border-purple-200 hover:bg-purple-50'}`}
            >
              <LinkIcon className="w-5 h-5 mr-2" />
              Add Resource URL
            </Button>
            <Button
              onClick={onComplete}
              variant="ghost"
              className="w-full text-sm text-slate-500 hover:text-slate-700"
            >
              Skip for now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadMethod === 'file') {
    return (
      <div className={`min-h-[60vh] flex items-center justify-center p-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`w-full max-w-2xl ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-purple-200'}`}>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>PDF, Word, PowerPoint, or image files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:bg-purple-500/5 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-3" />
                ) : (
                  <Upload className="w-12 h-12 text-purple-500 mb-3" />
                )}
                <p className={`mb-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <span className="font-semibold">{uploading ? 'Uploading...' : 'Click to upload'}</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">PDF, DOCX, PPTX, JPG, PNG (max 50MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadMethod(null)}
                disabled={uploading}
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadMethod === 'text') {
    return (
      <div className={`min-h-[60vh] flex items-center justify-center p-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`w-full max-w-2xl ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-purple-200'}`}>
          <CardHeader>
            <CardTitle>Paste Your Notes</CardTitle>
            <CardDescription>Lecture notes, textbook excerpts, or study guides</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste your study materials here..."
              className="min-h-[300px] text-sm"
              disabled={uploading}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadMethod(null)}
                disabled={uploading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || uploading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save & Continue
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadMethod === 'url') {
    return (
      <div className={`min-h-[60vh] flex items-center justify-center p-4 ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
        <Card className={`w-full max-w-2xl ${isDark ? 'bg-[#12121a] border-purple-500/30' : 'bg-white border-purple-200'}`}>
          <CardHeader>
            <CardTitle>Add Resource URL</CardTitle>
            <CardDescription>Link to online textbook, article, or video</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className={`w-full px-4 py-3 rounded-lg border ${isDark ? 'bg-[#1a1a2e] border-purple-500/30 text-white' : 'bg-white border-purple-200'}`}
              disabled={uploading}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadMethod(null)}
                disabled={uploading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim() || uploading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save URL
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}