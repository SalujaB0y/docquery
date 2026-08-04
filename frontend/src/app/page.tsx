'use client';

import { useState, useEffect, useRef } from 'react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import QueryInput from '@/components/QueryInput';
import AnswerDisplay from '@/components/AnswerDisplay';

export type Source = {
  index: number;
  content: string;
  documentId: string;
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

type Theme = 'dark' | 'light';

export default function Home() {
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('docquery-theme');
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('docquery-theme', theme);
  }, [theme]);

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

  function handleNewThread() {
    setHistory([]);
    setResult(null);
    setError(null);
    setCurrentQuestion('');
  }

  async function handleQuery(question: string) {
    setQuerying(true);
    setError(null);
    setResult(null);
    setCurrentQuestion(question);

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

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunksIngested, 0);
  const scopeLabel = selectedDocIds.size === 0 ? 'all documents' : `scope: ${selectedDocIds.size} file${selectedDocIds.size === 1 ? '' : 's'}`;

  return (
    <div className="flex h-screen min-h-[640px] w-full bg-bg text-ink overflow-hidden">
      <aside className="w-[288px] flex-none h-full flex flex-col bg-panel border-r border-edge">
        <div className="flex items-center gap-[9px] px-4 h-14 flex-none border-b border-edge">
          <div className="w-[22px] h-[22px] rounded-[6px] bg-accent flex items-center justify-center text-[12px] font-bold text-accent-fg">D</div>
          <span className="text-[15px] font-semibold tracking-tight">DocQuery</span>
        </div>

        <FileUpload folders={folders} onUpload={handleUpload} />

        <DocumentList
          documents={documents}
          folders={folders}
          selectedDocIds={selectedDocIds}
          onChange={setSelectedDocIds}
          onFolderCreated={handleFolderCreated}
        />

        <div className="flex-none border-t border-edge px-4 py-[11px] flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-faint">{documents.length} docs · {totalChunks} chunks</span>
          <button
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            className="flex items-center gap-[5px] px-[9px] py-1 border border-edge rounded-full text-[11px] text-muted hover:border-accent hover:text-accent transition-colors duration-150"
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col min-w-0 bg-bg">
        <header className="flex-none h-14 flex items-center justify-between px-6 border-b border-edge bg-panel">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[14px] font-semibold tracking-tight truncate">
              {currentQuestion || 'Ask about your documents'}
            </span>
            <span className="font-mono text-[10px] tracking-wide px-2 py-[3px] rounded-full bg-accent-soft text-accent whitespace-nowrap">
              {scopeLabel}
            </span>
          </div>
          <button
            onClick={handleNewThread}
            className="text-[12.5px] font-medium px-3 py-[6px] rounded-[7px] border border-edge2 hover:border-accent hover:text-accent transition-colors duration-150"
          >
            New thread
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pt-9 pb-2">
          <div className="max-w-[740px] mx-auto flex flex-col gap-[34px]">
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {result && (
              <AnswerDisplay
                question={currentQuestion}
                result={result}
                documents={documents}
                onFollowUpClick={handleQuery}
              />
            )}

            {!result && !error && (
              <p className="text-muted text-sm pt-8">
                {documents.length > 0
                  ? 'Ask a question below to get a cited answer from your selected sources.'
                  : 'Upload a document in the sidebar to get started.'}
              </p>
            )}
          </div>
        </div>

        {documents.length > 0 && (
          <div className="flex-none px-6 pt-3.5 pb-[22px] bg-bg">
            <div className="max-w-[740px] mx-auto flex flex-col gap-2">
              <QueryInput
                onSubmit={handleQuery}
                loading={querying}
                placeholder={result ? 'Ask a follow-up…' : 'Ask a question about your documents…'}
              />
              <span className="font-mono text-[10.5px] text-faint text-center">
                Answers are grounded in your selected sources only
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
