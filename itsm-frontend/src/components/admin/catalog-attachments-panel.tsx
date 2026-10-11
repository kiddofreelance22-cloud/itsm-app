"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { CatalogAttachment } from "@/types/catalog";
import { uploadFile } from "@/lib/api/uploads.api";
import { resolveAssetUrl } from "@/lib/api/client";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CatalogAttachmentsPanelProps {
  attachments: CatalogAttachment[];
  onUpload: (data: { fileName: string; contentType?: string; size: number; storagePath: string }) => Promise<void>;
  onRemove: (attachmentId: number) => Promise<void>;
}

export function CatalogAttachmentsPanel({ attachments, onUpload, onRemove }: CatalogAttachmentsPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        await onUpload({
          fileName: result.fileName,
          contentType: result.contentType,
          size: result.size,
          storagePath: result.url,
        });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div
        className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="size-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500 mb-3">Drag files here, or</p>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-2">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : "Upload File"}
        </button>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div className="space-y-2">
        {attachments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No attachments yet.</p>
        )}
        {attachments.map((a) => (
          <div key={a.attachmentId}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <FileText className="size-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{a.fileName}</p>
              <p className="text-xs text-slate-400">
                {formatSize(a.size)} &middot; {new Date(a.createdAt).toLocaleDateString()}
                {a.createdBy?.username ? ` \u00b7 ${a.createdBy.username}` : ""}
              </p>
            </div>
            <a href={resolveAssetUrl(a.storagePath)} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Download">
              <Download className="size-4" />
            </a>
            <button type="button"
              onClick={async () => { setRemovingId(a.attachmentId); await onRemove(a.attachmentId); setRemovingId(null); }}
              disabled={removingId === a.attachmentId}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
              {removingId === a.attachmentId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
