'use client';

import React, { useState } from 'react';
import { GremlinGraphVisualizer } from '@/components/GremlinGraphVisualizer';
import { UploadCloud, CheckCircle2, FileText, Sparkles, RefreshCw } from 'lucide-react';

export default function ContractsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [compilationSuccess, setCompilationSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file.name);
      setIsUploading(true);
      setCompilationSuccess(false);

      // Simulate S3 upload and Bedrock Claude 3.5 Sonnet ECA compilation
      setTimeout(() => {
        setIsUploading(false);
        setCompilationSuccess(true);
      }, 1500);
    }
  };

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">SLA Contract Parsing & Graph Management</h1>
        <p className="text-xs text-gray-400 mt-1">
          Ingest raw vendor SLA agreements into Amazon S3 (`slabound-contracts-incoming`) and compile to Amazon Neptune ECA graphs via Amazon Bedrock.
        </p>
      </div>

      {/* SLA Contract PDF Uploader Drag-and-Drop Zone */}
      <div className="p-8 rounded-xl bg-[#111827] border-2 border-dashed border-gray-700 hover:border-indigo-500 transition-all flex flex-col items-center justify-center text-center relative group">
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
          {isUploading ? (
            <RefreshCw className="w-7 h-7 animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>
        <h3 className="text-base font-semibold text-white">
          {uploadedFile ? `Uploaded: ${uploadedFile}` : 'Drag & drop vendor SLA PDF here'}
        </h3>
        <p className="text-xs text-gray-400 mt-1 max-w-md">
          Supports vendor agreements, enterprise Master Service Agreements (MSAs), or service attachments. Maximum 50MB.
        </p>

        {isUploading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400 font-mono">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Invoking Amazon Bedrock Claude 3.5 Sonnet schema parser...</span>
          </div>
        )}

        {compilationSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Successfully extracted ECA rules: Vendor(stripe-payments-v1) -&gt; SLAClause(800ms) -&gt; Penalty(15%)</span>
          </div>
        )}
      </div>

      {/* Gremlin Graph Visualizer */}
      <GremlinGraphVisualizer />
    </div>
  );
}
