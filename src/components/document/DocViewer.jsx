import React from "react";

export default function DocViewer({ fileUrl, fallbackText }) {
  const isImage = fileUrl && /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(fileUrl);
  const isPdf = fileUrl && /\.pdf(\?|$)/i.test(fileUrl);

  return (
    <div className="w-full h-full bg-white rounded-xl border shadow-sm overflow-hidden">
      {fileUrl ? (
        isImage ? (
          <div className="w-full h-full flex items-center justify-center p-2 bg-slate-50">
            <img src={fileUrl} alt="Document" className="max-w-full max-h-full rounded-lg shadow" />
          </div>
        ) : isPdf ? (
          <object data={`${fileUrl}#toolbar=0&navpanes=0`} type="application/pdf" className="w-full h-full min-h-[480px]">
            <iframe src={`${fileUrl}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[480px]" title="Document" />
          </object>
        ) : (
          <iframe src={fileUrl} className="w-full h-full min-h-[480px] bg-white" title="Document" />
        )
      ) : (
        <div className="p-6 text-slate-600 text-sm whitespace-pre-wrap">
          {fallbackText || "Document preview not available."}
        </div>
      )}
    </div>
  );
}