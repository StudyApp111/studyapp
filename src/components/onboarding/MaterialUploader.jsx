import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Type, Loader2, X, CheckCircle, Lightbulb, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MaterialUploader({ courseName, school, onMaterialReady, disabled = false }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pastedNotes, setPastedNotes] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === "topic" && courseName && suggestions.length === 0 && !loadingSuggestions) {
      generateSuggestions();
    }
  }, [activeTab, courseName]);

  const generateSuggestions = async () => {
    if (!courseName?.trim() || loadingSuggestions) return;
    
    setLoadingSuggestions(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const result = await base44.functions.invoke('generateSuggestions', {
        courseName: courseName.trim(),
        school: school || '',
        grade: ''
      });
      
      clearTimeout(timeoutId);
      
      const topics = result?.data?.topics || [];
      setSuggestions(topics.slice(0, 4));
    } catch (err) {
      console.error("Error generating suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  const [fileSizeError, setFileSizeError] = useState("");

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file size
    const oversized = files.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileSizeError(`"${oversized.name}" exceeds the 20 MB limit.`);
      return;
    }
    setFileSizeError("");

    setIsUploading(true);
    const newFiles = [];

    for (const file of files) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newFiles.push({
          name: file.name,
          url: file_url,
          size: file.size
        });
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    const allFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(allFiles);
    setIsUploading(false);
    
    if (allFiles.length > 0) {
      onMaterialReady({ type: "file", files: allFiles });
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

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "upload") {
      onMaterialReady(uploadedFiles.length > 0 ? { type: "file", files: uploadedFiles } : null);
    } else if (tabId === "paste") {
      onMaterialReady(pastedNotes.trim() ? { type: "notes", content: pastedNotes } : null);
    } else if (tabId === "topic") {
      onMaterialReady(topicDescription.trim() ? { type: "topic", content: topicDescription } : null);
    }
  };

  const tabs = [
    { id: "upload", label: "Upload", icon: Upload, emoji: "📄" },
    { id: "topic", label: "Topic", icon: Type, emoji: "💡" },
    { id: "paste", label: "Paste", icon: FileText, emoji: "📝" }
  ];

  const isDisabled = disabled || !courseName?.trim();

  return (
    <div className={`space-y-4 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Course name required hint */}
      {!courseName?.trim() && (
        <p className="text-sm text-emerald-400 font-semibold text-center animate-pulse">Enter a course name above first</p>
      )}
      {/* Tab selector - more visual */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-800/50 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => !isDisabled && handleTabChange(tab.id)}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <span className="text-lg">{tab.emoji}</span>
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {fileSizeError && (
            <div className="mb-2 p-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-sm text-center">
              {fileSizeError}
            </div>
          )}
          {uploadedFiles.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-purple-400/50 hover:border-purple-400 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 rounded-2xl p-8 transition-all group"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                  <p className="text-purple-300 font-semibold">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-4xl">📤</span>
                  </div>
                  <div>
                    <p className="font-bold text-xl text-white mb-1">Drop your files here</p>
                    <p className="text-sm text-slate-400">PDF, Word, PowerPoint, Images</p>
                    <p className="text-xs text-slate-500 mt-1">Max 20 MB per file</p>
                  </div>
                  <div className="flex items-center gap-2 text-purple-300 text-sm font-medium">
                    <span>Tap to browse</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{file.name}</p>
                    <p className="text-sm text-emerald-300">{formatFileSize(file.size)} • Ready</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                  </button>
                </div>
              ))}

            </div>
          )}
        </div>
      )}

      {/* Paste Tab */}
      {activeTab === "paste" && (
        <div>
          <Textarea
            value={pastedNotes}
            onChange={handleNotesChange}
            placeholder="Paste your notes, textbook excerpts, or any study material..."
            className="min-h-[180px] resize-none border-2 border-purple-500/30 focus:border-purple-400 rounded-xl p-4 bg-slate-800/80 text-white placeholder:text-slate-500 text-base"
          />
          {pastedNotes && (
            <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>{pastedNotes.length} characters ready</span>
            </div>
          )}
        </div>
      )}

      {/* Topic Tab */}
      {activeTab === "topic" && (
        <div className="space-y-4">
          <Textarea
            value={topicDescription}
            onChange={handleTopicChange}
            placeholder={`What do you want to learn in ${courseName}?\n\nExample: "Photosynthesis - light and dark reactions"`}
            className="min-h-[120px] resize-none border-2 border-purple-500/30 focus:border-purple-400 rounded-xl p-4 bg-slate-800/80 text-white placeholder:text-slate-500 text-base"
          />
          
          {/* AI Suggestions */}
          {courseName && (
            <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold text-purple-200">Popular topics</span>
                {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin text-purple-400 ml-auto" />}
              </div>
              
              {loadingSuggestions && suggestions.length === 0 && (
                <p className="text-sm text-purple-300">Finding topics for {courseName}...</p>
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
                      className="text-sm text-white bg-slate-700/70 hover:bg-purple-500/30 border border-slate-600 hover:border-purple-400/50 rounded-lg px-3 py-2 transition-all"
                    >
                      {suggestion.length > 40 ? suggestion.substring(0, 40) + '...' : suggestion}
                    </button>
                  ))}
                </div>
              )}
              
              {!loadingSuggestions && suggestions.length === 0 && (
                <button
                  type="button"
                  onClick={generateSuggestions}
                  className="w-full text-sm bg-purple-600 hover:bg-purple-500 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  ✨ Generate topic ideas
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}