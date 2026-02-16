import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, ArrowRight, FileText, AlertCircle, Sparkles } from "lucide-react";
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

  const [uploadComplete, setUploadComplete] = useState(false);
  const [processingStep, setProcessingStep] = useState(""); // "", "uploading", "extracting", "compressing"

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
    setUploadComplete(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setProcessingStep("uploading");
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
        setProcessingStep("");
        return;
      }

      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      setUploadedFileUrl(fileUrl);

      // Extract content
      setProcessingStep("extracting");
      setProcessing(true);
      const extractResult = await base44.functions.invoke('extractDocumentContent', { file_url: fileUrl });

      if (!extractResult.data?.extracted_content) {
        throw new Error("Could not extract content from document");
      }

      const extracted = extractResult.data.extracted_content;
      setExtractedContent(extracted);

      // Compress content
      setProcessingStep("compressing");
      const compressResult = await base44.functions.invoke('compressDocument', { content: extracted });

      if (!compressResult.data?.compressed_content) {
        throw new Error("Could not compress document");
      }

      const compressed = compressResult.data.compressed_content;
      setCompressedContent(compressed);
      setUploadComplete(true);

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
      setProcessingStep("");
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

      {/* Floating animated element */}
      <motion.div
        className="absolute top-4 right-4 text-2xl select-none pointer-events-none z-0"
        animate={{ y: [0, -6, 0], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        ✨
      </motion.div>

      {/* Header */}
      <div className="text-center space-y-3">
        <motion.div
          className="text-6xl mb-2"
          animate={{ y: [0, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          📄
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
          Want a more accurate prediction?
        </h2>
        <p className="text-slate-600 text-sm">Upload your notes — your diagnostic will use your actual course material.</p>
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
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            file 
              ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100' 
              : 'border-purple-300 bg-purple-50 hover:bg-purple-100'
          }`}
        >
          {file ? (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-emerald-600" />
              </div>
              <span className="text-emerald-700 font-bold text-base mb-1 px-4 text-center">
                {file.name}
              </span>
              <span className="text-emerald-600 text-sm font-medium">✓ File selected</span>
              <span className="text-slate-500 text-xs mt-1">Click to change</span>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-purple-600 mb-3" />
              <span className="text-slate-900 font-semibold text-base mb-1">
                Click to upload document
              </span>
              <span className="text-slate-600 text-sm">PDF, DOCX, PNG, JPG (Max 5MB)</span>
            </>
          )}
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
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              </div>
              <div>
                <p className="font-bold text-purple-700 text-sm">
                  {processingStep === "uploading" && "Uploading your file..."}
                  {processingStep === "extracting" && "Reading your document..."}
                  {processingStep === "compressing" && "Analyzing content..."}
                </p>
                <p className="text-purple-600 text-xs">This may take up to 15 seconds</p>
              </div>
            </div>
            
            {/* Progress steps */}
            <div className="flex items-center gap-2 justify-center">
              <div className={`flex items-center gap-1 ${processingStep === "uploading" ? 'text-purple-600' : (processingStep === "extracting" || processingStep === "compressing") ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep === "uploading" ? 'bg-purple-600 animate-pulse' : (processingStep === "extracting" || processingStep === "compressing") ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-[10px] font-medium">Upload</span>
              </div>
              <div className="w-4 h-0.5 bg-slate-200" />
              <div className={`flex items-center gap-1 ${processingStep === "extracting" ? 'text-purple-600' : processingStep === "compressing" ? 'text-emerald-600' : 'text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep === "extracting" ? 'bg-purple-600 animate-pulse' : processingStep === "compressing" ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-[10px] font-medium">Extract</span>
              </div>
              <div className="w-4 h-0.5 bg-slate-200" />
              <div className={`flex items-center gap-1 ${processingStep === "compressing" ? 'text-purple-600' : 'text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${processingStep === "compressing" ? 'bg-purple-600 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-[10px] font-medium">Analyze</span>
              </div>
            </div>
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