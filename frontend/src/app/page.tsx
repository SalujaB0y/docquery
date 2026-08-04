'use client';

import { useState, useEffect, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import QueryInput from '@/components/QueryInput';
import AnswerDisplay from '@/components/AnswerDisplay';

export type Source = {
  index: number;
  content: string;
};

export type ConversationTurn = {
  question: string;
  answer: string;
};

export type QueryResult = {
  answer: string;
  sources: Source[];
  followUps: string[];
  tokenCount: number;
  estimatedCost: number;
};

export type UploadedDoc = {
  documentId: string;
  filename: string;
  chunksIngested: number;
  folderId: string | null;
  summary: string | null;
  // only present on documents that came back from GET /api/documents, not fresh uploads
  createdAt?: string;
};

export type Folder = {
  folderId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
};

export default function Home() {
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  // changing which documents are in scope reads as "new line of inquiry" — clear the
  // conversation memory so a stale topic doesn't leak into the rewrite/generation prompt.
  // skipped on the very first render so mounting with an empty selection doesn't no-op reset
  // an already-empty history
  const prevSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    const key = Array.from(selectedDocIds).sort().join(',');
    if (prevSelectionRef.current !== null && prevSelectionRef.current !== key) {
      setHistory([]);
    }
    prevSelectionRef.current = key;
  }, [selectedDocIds]);

  // the page only knows about this session's uploads otherwise — a refresh would lose them
  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`).then(res => res.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/folders`).then(res => res.json()),
    ])
      .then(([docsData, foldersData]: [{ documents: UploadedDoc[] }, { folders: Folder[] }]) => {
        setDocuments(docsData.documents);
        setFolders(foldersData.folders);
      })
      .catch(() => setError('Could not load your documents. Check that the backend is running.'));
  }, []);

  function handleUpload(doc: UploadedDoc) {
    // dedupe by filename too, not just id — re-uploading an existing filename replaces
    // it server-side under a new documentId, so an id-only filter would leave the old,
    // now-deleted entry sitting in the list alongside the new one
    setDocuments(prev => [
      doc,
      ...prev.filter(d => d.documentId !== doc.documentId && d.filename !== doc.filename),
    ]);
  }

  function handleFolderCreated(folder: Folder) {
    setFolders(prev => [...prev, folder]);
  }

  async function handleQuery(question: string) {
    setQuerying(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          // empty selection means "search everything" — omit the field entirely rather
          // than sending [], since the backend treats [] as "match no documents"
          documentIds: selectedDocIds.size > 0 ? Array.from(selectedDocIds) : undefined,
          // prior turns only — the backend resolves references like "that" against these
          // before retrieval, and replays them for the model's conversational memory
          history,
        }),
      });

      if (!res.ok || !res.body) throw new Error('query failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let sources: Source[] = [];
      let answer = '';
      let followUps: string[] = [];
      let tokenCount = 0;
      let estimatedCost = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const match = frame.match(/^event: (\w+)\ndata: ([\s\S]*)$/);
          if (!match) continue;

          const [, eventType, dataStr] = match;
          const data = JSON.parse(dataStr);

          if (eventType === 'sources') {
            sources = data.sources;
          } else if (eventType === 'token') {
            answer += data.token;
            setResult({ answer, sources, followUps, tokenCount, estimatedCost });
          } else if (eventType === 'followups') {
            followUps = data.followUps;
            setResult({ answer, sources, followUps, tokenCount, estimatedCost });
          } else if (eventType === 'done') {
            tokenCount = data.tokenCount;
            estimatedCost = data.estimatedCost;
            setResult({ answer, sources, followUps, tokenCount, estimatedCost });
          } else if (eventType === 'error') {
            throw new Error(data.message);
          }
        }
      }

      setHistory(prev => [...prev, { question, answer }]);
    } catch {
      setError('Something went wrong. Check that the backend is running.');
    } finally {
      setQuerying(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">DocQuery</h1>
        <p className="text-zinc-400 text-sm">
          Upload documents, then ask questions across all of them or one at a time.
        </p>
      </div>

      <div className="space-y-8">
        <FileUpload folders={folders} onUpload={handleUpload} />

        {documents.length > 0 && (
          <DocumentList
            documents={documents}
            folders={folders}
            selectedDocIds={selectedDocIds}
            onChange={setSelectedDocIds}
            onFolderCreated={handleFolderCreated}
          />
        )}

        {documents.length > 0 && (
          <QueryInput onSubmit={handleQuery} loading={querying} />
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {result && <AnswerDisplay result={result} onFollowUpClick={handleQuery} />}
      </div>
    </main>
  );
}
