import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Type, Loader2, File, X, CheckCircle, Lightbulb } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MaterialUploader({ courseName, school, onMaterialReady }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pastedNotes, setPastedNotes] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  // Generate suggestions when switching to topic tab
  useEffect(() => {
    if (activeTab === "topic" && courseName && suggestions.length === 0 && !loadingSuggestions) {
      generateSuggestions();
    }
  }, [activeTab, courseName]);

  const generateSuggestions = async () => {
    if (!courseName?.trim() || loadingSuggestions) return;
    
    setLoadingSuggestions(true);
    try {
      const result = await base44.functions.invoke('generateSuggestions', {
        courseName: courseName.trim(),
        school: school || '',
        grade: ''
      });
      
      const topics = result?.data?.topics || [];
      setSuggestions(topics.slice(0, 4));
    } catch (err) {
      console.error("Error generating suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const newFiles = [];

    for (const file of files) {
      try {
        console.log("📤 Uploading file:", file.name);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        console.log("✅ File uploaded:", file_url);
        newFiles.push({
          name: file.name,
          url: file_url,
          size: file.size
        });
      } catch (error) {
        console.error("❌ Error uploading file:", error);
      }
    }

    const allFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(allFiles);
    setIsUploading(false);
    
    // Notify parent with all files
    if (allFiles.length > 0) {
      console.log("📦 Material ready with", allFiles.length, "file(s):", allFiles.map(f => f.url));
      onMaterialReady({
        type: "file",
        files: allFiles
      });
    }
  };

  const removeFile = (index) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    onMaterialReady(updated.length > 0 ? { type: "file", files: updated } : null);
  };

  const handleNotesChange = (e) => {
    const text = e.target.value;
    setPastedNotes(text);
    onMaterialReady(text.trim() ? { type: "notes", content: text } : null);
  };

  const handleTopicChange = (e) => {
    const text = e.target.value;
    setTopicDescription(text);
    onMaterialReady(text.trim() ? { type: "topic", content: text } : null);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 p-1 rounded-xl bg-slate-100">
          <TabsTrigger 
            value="upload" 
            className="rounded-lg text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger 
            value="paste"
            className="rounded-lg text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Paste
          </TabsTrigger>
          <TabsTrigger 
            value="topic"
            className="rounded-lg text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            <Type className="w-4 h-4 mr-2" />
            Topic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {uploadedFiles.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-purple-300 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 rounded-2xl p-8 transition-all"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                  <p className="text-purple-700 font-medium">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-purple-700">Upload Your Materials</p>
                    <p className="text-sm mt-1 text-slate-500">PDF, Word, PowerPoint, TXT, PNG, JPG, WEBP, GIF, BMP, TIFF</p>
                    <p className="text-xs mt-1 text-slate-400">Max 15MB per file</p>
                  </div>
                </div>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add more files
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="paste" className="mt-4">
          <Textarea
            value={pastedNotes}
            onChange={handleNotesChange}
            placeholder="Paste your lecture notes, textbook excerpts, or any study material here..."
            className="min-h-[200px] resize-none border-2 border-slate-200 focus:border-purple-400 rounded-xl p-4"
          />
          <p className="text-xs mt-2 text-center text-slate-500">
            Paste any text content you want to study
          </p>
        </TabsContent>

        <TabsContent value="topic" className="mt-4 space-y-3">
          <Textarea
            value={topicDescription}
            onChange={handleTopicChange}
            placeholder={`Describe what you want to learn about ${courseName}...\n\nExample: "I want to learn about photosynthesis, including the light and dark reactions, and how plants convert CO2 into glucose."`}
            className="min-h-[140px] resize-none border-2 border-slate-200 focus:border-purple-400 rounded-xl p-4"
          />
          
          {/* AI Suggestions */}
          {courseName && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-800">Topic Ideas</span>
                </div>
                {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-purple-600" />}
              </div>
              
              {loadingSuggestions && suggestions.length === 0 && (
                <p className="text-[11px] text-purple-600">Finding topics...</p>
              )}
              
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTopicDescription(suggestion);
                        onMaterialReady({ type: "topic", content: suggestion });
                      }}
                      className="text-[11px] text-slate-700 bg-white hover:bg-purple-100 border border-purple-100 rounded-full px-3 py-1.5 transition-all shadow-sm hover:shadow"
                    >
                      {suggestion.length > 50 ? suggestion.substring(0, 50) + '...' : suggestion}
                    </button>
                  ))}
                </div>
              )}
              
              {!loadingSuggestions && suggestions.length === 0 && (
                <button
                  type="button"
                  onClick={generateSuggestions}
                  className="w-full text-[11px] bg-purple-600 hover:bg-purple-700 text-white font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Generate Topic Ideas
                </button>
              )}
            </div>
          )}
          
          <p className="text-xs text-center text-slate-500">
            Be specific about the topics you want to cover
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}