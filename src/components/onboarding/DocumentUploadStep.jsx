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
    <div className="p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-6xl mb-2">📄</div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
          Want More Accurate Results {userName}?
        </h2>
      </div>

      {/* Info card */}
      <div className="bg-purple-50 rounded-xl p-5 border border-purple-100 space-y-3 text-center">
        <p className="text-slate-700 text-base leading-relaxed">
          We generated questions based on typical <span className="font-semibold text-slate-900">{courseName}</span> topics.
        </p>
        <p className="text-slate-700 text-base leading-relaxed">
          Upload your notes for questions tailored to <span className="font-semibold text-purple-600">YOUR</span> class.
        </p>
        
        {/* Benefits */}
        <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm pt-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">35% more accurate predictions</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Takes 30 seconds</span>
        </div>
      </div>

      {/* File Upload Section */}
      <div>
        <label 
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer bg-purple-50 hover:bg-purple-100 transition-all"
        >
          <Upload className="w-12 h-12 text-purple-600 mb-3" />
          <span className="text-slate-900 font-semibold text-base mb-1">
            {file ? file.name : 'Click to upload document'}
          </span>
          <span className="text-slate-600 text-sm">PDF, DOCX, PNG, JPG (Max 5MB)</span>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
            disabled={isLoading}
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm text-center font-medium">{error}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        {file && !isLoading && (
          <Button
            onClick={handleUpload}
            variant="outline"
            className="w-full h-12 border-purple-300 hover:bg-purple-50 text-slate-900 font-medium text-base rounded-xl"
          >
            Upload & Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-purple-600 py-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">{uploading ? 'Uploading...' : 'Processing document...'}</span>
          </div>
        )}

        {/* Skip button - Now primary style */}
        <Button
          onClick={onSkip}
          disabled={isLoading}
          className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-base rounded-xl shadow-lg shadow-purple-500/30"
        >
          Continue without uploading
        </Button>

        {/* Back button */}
        <button
          onClick={onBack}
          disabled={isLoading}
          className="text-slate-500 hover:text-slate-700 text-sm transition-colors font-medium"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}