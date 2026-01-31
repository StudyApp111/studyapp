import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, ArrowRight, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DocumentUploadStep({ userName, courseName, onNext, onBack, onSkip }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [extractedContent, setExtractedContent] = useState("");
  const [compressedContent, setCompressedContent] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      setUploadedFileUrl(fileUrl);

      // Extract content
      setProcessing(true);
      const extractResult = await base44.functions.invoke('extractDocumentContent', { file_url: fileUrl });

      if (!extractResult.data?.extracted_content) {
        throw new Error("Could not extract content from document");
      }

      const extracted = extractResult.data.extracted_content;
      setExtractedContent(extracted);

      // Compress content
      const compressResult = await base44.functions.invoke('compressDocument', { content: extracted });

      if (!compressResult.data?.compressed_content) {
        throw new Error("Could not compress document");
      }

      const compressed = compressResult.data.compressed_content;
      setCompressedContent(compressed);

      // Pass data to parent
      onNext({ fileUrl, extractedContent: extracted, compressedContent: compressed });

    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to process document");
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const isLoading = uploading || processing;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          🎯 Want More Accurate Results {userName}?
        </h2>
      </div>

      {/* Info card */}
      <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600 space-y-3">
        <p className="text-slate-300 text-base leading-relaxed">
          We generated questions based on typical <span className="font-semibold text-white">{courseName}</span> topics.
        </p>
        <p className="text-slate-300 text-base leading-relaxed">
          Upload your notes for questions tailored to <span className="font-semibold text-purple-300">YOUR</span> class.
        </p>
        
        {/* Benefits */}
        <div className="flex items-center gap-2 text-emerald-400 text-sm pt-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>35% more accurate predictions</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Takes 30 seconds</span>
        </div>
      </div>

      {/* File Upload Section */}
      {!file ? (
        <div>
          <label 
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-500/50 rounded-xl cursor-pointer bg-purple-500/5 hover:bg-purple-500/10 transition-all"
          >
            <Upload className="w-12 h-12 text-purple-400 mb-3" />
            <span className="text-white font-semibold text-base mb-1">Click to upload document</span>
            <span className="text-slate-400 text-sm">PDF, DOCX, PNG, JPG (Max 5MB)</span>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
            />
          </label>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="text-white text-sm">{file.name}</span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {file && !isLoading && (
          <Button
            onClick={handleUpload}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base"
          >
            Upload & Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-purple-300 py-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{uploading ? 'Uploading...' : 'Processing document...'}</span>
          </div>
        )}

        {/* Skip button */}
        <Button
          onClick={onSkip}
          disabled={isLoading}
          variant="ghost"
          className="w-full h-12 text-slate-400 hover:text-white font-medium"
        >
          Continue with current results →
        </Button>

        {/* Back button */}
        <button
          onClick={onBack}
          disabled={isLoading}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}