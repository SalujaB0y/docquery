'use client';

import { useState, useRef } from 'react';
import type { UploadedDoc, Folder } from '@/app/page';

type Props = {
  folders: Folder[];
  onUpload: (doc: UploadedDoc) => void;
};

// depth-first walk so children appear directly under their parent in the flat dropdown
function flattenWithDepth(folders: Folder[], parentId: string | null = null, depth = 0): { folder: Folder; depth: number }[] {
  return folders
    .filter(f => f.parentFolderId === parentId)
    .flatMap(f => [{ folder: f, depth }, ...flattenWithDepth(folders, f.folderId, depth + 1)]);
}

export default function FileUpload({ folders, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const flatFolders = flattenWithDepth(folders);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    if (targetFolderId) formData.append('folderId', targetFolderId);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ingest`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'upload failed');
      }

      const data: UploadedDoc = await res.json();
      onUpload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="px-3.5 pt-3.5 pb-3 flex flex-col gap-2.5 border-b border-edge">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`
          border border-dashed rounded-[10px] px-3 py-[18px] flex flex-col items-center gap-[5px]
          cursor-pointer transition-colors duration-150
          ${dragOver ? 'border-accent bg-accent-soft' : 'border-edge2 bg-panel2 hover:border-accent hover:bg-accent-soft'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading ? (
          <span className="text-[13px] text-muted">Uploading and indexing...</span>
        ) : (
          <>
            <span className="text-[13px] font-medium text-ink">Drop a file or browse</span>
            <span className="font-mono text-[10.5px] text-faint tracking-wide">.txt · .pdf · up to 10MB</span>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {flatFolders.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex-shrink-0">Upload to</span>
          <select
            value={targetFolderId}
            onChange={e => setTargetFolderId(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-bg border border-edge rounded-[7px] px-2 py-[5px] text-xs text-ink focus:outline-none focus:border-accent"
          >
            <option value="">root</option>
            {flatFolders.map(({ folder, depth }) => (
              <option key={folder.folderId} value={folder.folderId}>
                {'  '.repeat(depth)}{folder.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
