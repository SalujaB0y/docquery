'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import QueryInput from '@/components/QueryInput';
import AnswerDisplay from '@/components/AnswerDisplay';

export type Source = {
  index: number;
  content: string;
};

export type QueryResult = {
  answer: string;
  sources: Source[];
  tokenCount: number;
  estimatedCost: number;
};

export type UploadedDoc = {
  documentId: string;
  filename: string;
  chunksIngested: number;
};

export default function Home() {
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery(question: string) {
    setQuerying(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error('query failed');
      const data: QueryResult = await res.json();
      setResult(data);
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
          Upload a document, then ask questions about it.
        </p>
      </div>

      <div className="space-y-8">
        <FileUpload onUpload={setUploadedDoc} />

        {uploadedDoc && (
          <div className="text-sm text-zinc-400 border border-zinc-800 rounded-lg px-4 py-3">
            <span className="text-zinc-200 font-medium">{uploadedDoc.filename}</span>
            <span className="ml-2">— {uploadedDoc.chunksIngested} chunks indexed</span>
          </div>
        )}

        {uploadedDoc && (
          <QueryInput onSubmit={handleQuery} loading={querying} />
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {result && <AnswerDisplay result={result} />}
      </div>
    </main>
  );
}
