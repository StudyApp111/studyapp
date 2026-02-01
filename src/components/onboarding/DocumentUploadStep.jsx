import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, ArrowRight, FileText, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { generateFingerprint } from "@/components/utils/browserFingerprint";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DocumentUploadStep({ userName, courseName, onNext, onBack, onSkip }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [extractedContent, setExtractedContent] = useState("");
  const [compressedContent, setCompressedContent] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Hidden field for bot detection

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
      // ABUSE PROTECTION CHECK
      const fingerprint = await generateFingerprint();
      const abuseCheck = await base44.functions.invoke('checkAbuseProtection', {
        action_type: 'ocr_upload',
        fingerprint,
        honeypot_value: honeypot
      });

      if (!abuseCheck.data?.allowed) {
        setError(abuseCheck.data?.reason || "Upload limit reached. Please sign in to continue.");
        setUploading(false);
        return;
      }

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

      // Pass data to parent - include all data for post-login flow
      onNext({ 
        fileUrl, 
        extractedContent: extracted, 
        compressedContent: compressed 
      });

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
    <div className="relative p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-2xl overflow-hidden">
      {/* HONEYPOT - Hidden field to catch bots */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {/* Animated Background Sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-purple-400/30 rounded-full"
          initial={{ opacity: 0, x: Math.random() * 500, y: Math.random() * 400 }}
          animate={{
            opacity: [0, 0.8, 0],
            x: Math.random() * 500,
            y: Math.random() * 400,
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
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

      {/* Error - More prominent for rate limit messages */}
      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        {file && !isLoading && (
            <Button
              onClick={handleUpload}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base rounded-xl"
            >
              Upload & Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-purple-600 py-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">{uploading ? 'Uploading...' : 'Processing...'}</span>
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
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors font-medium rounded-lg"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}