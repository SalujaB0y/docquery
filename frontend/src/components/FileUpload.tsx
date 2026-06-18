'use client';

import { useState, useRef } from 'react';
import type { UploadedDoc } from '@/app/page';

type Props = {
  onUpload: (doc: UploadedDoc) => void;
};

export default function FileUpload({ onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

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
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      className={`
        border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer
        transition-colors duration-150
        ${dragOver
          ? 'border-accent bg-indigo-950/20'
          : 'border-zinc-700 hover:border-zinc-500'
        }
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
        <p className="text-zinc-400 text-sm">Uploading and indexing...</p>
      ) : (
        <>
          <p className="text-zinc-300 text-sm font-medium">
            Drop a file here or click to browse
          </p>
          <p className="text-zinc-500 text-xs mt-1">.txt or .pdf, up to 10MB</p>
        </>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-3">{error}</p>
      )}
    </div>
  );
}
