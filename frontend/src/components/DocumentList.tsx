'use client';

import type { UploadedDoc } from '@/app/page';

type Props = {
  documents: UploadedDoc[];
  selectedDocId: string | null;
  onSelect: (documentId: string | null) => void;
};

export default function DocumentList({ documents, selectedDocId, onSelect }: Props) {
  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunksIngested, 0);

  function itemClasses(selected: boolean) {
    return `
      w-full text-left px-4 py-3 text-sm transition-colors duration-150
      ${selected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}
    `;
  }

  return (
    <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden">
      <button
        onClick={() => onSelect(null)}
        className={itemClasses(selectedDocId === null)}
      >
        <span className="font-medium">All documents</span>
        <span className="ml-2 text-zinc-500">— {totalChunks} chunks indexed</span>
      </button>

      {documents.map(doc => (
        <button
          key={doc.documentId}
          onClick={() => onSelect(doc.documentId)}
          className={itemClasses(selectedDocId === doc.documentId)}
        >
          <span className="font-medium">{doc.filename}</span>
          <span className="ml-2 text-zinc-500">— {doc.chunksIngested} chunks indexed</span>
        </button>
      ))}
    </div>
  );
}
