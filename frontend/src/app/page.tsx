'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import supabase from '@/lib/supabaseClient';
import authFetch from '@/lib/authFetch';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import HistoryList from '@/components/HistoryList';
import QueryInput from '@/components/QueryInput';
import Logo from '@/components/Logo';
import AnswerDisplay from '@/components/AnswerDisplay';

export type Source = {
  index: number;
  content: string;
  documentId: string;
};

export type QueryResult = {
  answer: string;
  sources: Source[];
  followUps: string[];
  tokenCount: number;
  estimatedCost: number;
};

export type Turn = QueryResult & { question: string };

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

export type ThreadSummary = {
  threadId: string;
  title: string;
  documentIds: string[];
  turnCount: number;
  updatedAt: string;
};

export type Thread = {
  threadId: string;
  title: string;
  documentIds: string[];
  turns: Turn[];
  updatedAt: string;
};

type Theme = 'dark' | 'light';
type SidebarTab = 'sources' | 'history';
type AuthUser = { id: string; name: string; avatarUrl: string | null };

function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: (meta.full_name as string) ?? (meta.name as string) ?? user.email ?? 'Signed in',
    avatarUrl: (meta.avatar_url as string) ?? null,
  };
}

export default function Home() {
  // undefined = still checking for a session, null = signed out, AuthUser = signed in
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sources');
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? toAuthUser(session.user) : null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toAuthUser(session.user) : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function handleSignIn() {
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  }

  function handleSignOut() {
    supabase.auth.signOut();
  }

  useEffect(() => {
    const stored = window.localStorage.getItem('docquery-theme');
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('docquery-theme', theme);
  }, [theme]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  // the page only knows about this session's uploads otherwise — a refresh would lose them.
  // gated on `user` so it doesn't fire (and 401) before a session exists
  useEffect(() => {
    if (!user) return;

    Promise.all([
      authFetch('/api/documents').then(res => res.json()),
      authFetch('/api/folders').then(res => res.json()),
    ])
      .then(([docsData, foldersData]: [{ documents: UploadedDoc[] }, { folders: Folder[] }]) => {
        setDocuments(docsData.documents);
        setFolders(foldersData.folders);
      })
      .catch(() => setError('Could not load your documents. Check that the backend is running.'));
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function refreshThreads() {
    return authFetch('/api/threads')
      .then(res => res.json())
      .then((data: { threads: ThreadSummary[] }) => setThreads(data.threads))
      .catch(() => {});
  }

  // persists the in-progress conversation as a thread — creates one the first time, updates
  // the same row on every save after that (tracked via activeThreadId) so resuming a thread
  // and saving again overwrites it instead of forking a duplicate
  async function saveCurrentThread(scopeIdsOverride?: string[]) {
    if (turns.length === 0) return;

    const documentIds = scopeIdsOverride ?? Array.from(selectedDocIds);
    const payload = { title: turns[0].question.slice(0, 60), documentIds, turns };
    const path = activeThreadId ? `/api/threads/${activeThreadId}` : '/api/threads';

    try {
      const res = await authFetch(path, {
        method: activeThreadId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) await refreshThreads();
    } catch {
      // best-effort — a failed save shouldn't block starting the next conversation
    }
  }

  // saves whatever's in progress (if anything), then clears the view for a new conversation.
  // scopeIdsOverride lets the selection-change effect below save under the scope the
  // conversation was actually asked in, not whatever the selection has already changed to
  async function resetThread(scopeIdsOverride?: string[]) {
    await saveCurrentThread(scopeIdsOverride);
    setTurns([]);
    setActiveThreadId(null);
    setError(null);
  }

  async function handleSelectThread(threadId: string) {
    await saveCurrentThread();
    setError(null);
    try {
      const res = await authFetch(`/api/threads/${threadId}`);
      if (!res.ok) throw new Error('failed to load thread');
      const data: Thread = await res.json();
      setTurns(data.turns);
      setActiveThreadId(data.threadId);
    } catch {
      setError('Could not load that conversation.');
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      const res = await authFetch(`/api/threads/${threadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed to delete thread');
      setThreads(prev => prev.filter(t => t.threadId !== threadId));
      // the deleted thread was open in the main view — clear it rather than leaving a
      // conversation on screen that no longer exists anywhere
      if (threadId === activeThreadId) {
        setTurns([]);
        setActiveThreadId(null);
      }
    } catch {
      setError('Could not delete that conversation.');
    }
  }

  // changing which documents are in scope reads as "new line of inquiry" — save the current
  // thread under the scope it was actually asked in, then start fresh, so a stale topic
  // doesn't leak into the rewrite/generation prompt for the new scope. skipped on the very
  // first render so mounting with an empty selection doesn't no-op a save of nothing
  const prevSelectedIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const currentIds = Array.from(selectedDocIds).sort();
    const prevIds = prevSelectedIdsRef.current;
    if (prevIds !== null && prevIds.join(',') !== currentIds.join(',')) {
      void resetThread(prevIds);
    }
    prevSelectedIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocIds]);

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

  function updateLastTurn(patch: Partial<Turn>) {
    setTurns(prev => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }

  async function handleQuery(question: string) {
    setQuerying(true);
    setError(null);
    // prior turns only — captured before the optimistic push below so this doesn't include
    // the in-progress one. the backend resolves references like "that" against these before
    // retrieval, and replays them for the model's conversational memory
    const historyForBackend = turns.map(t => ({ question: t.question, answer: t.answer }));
    setTurns(prev => [...prev, { question, answer: '', sources: [], followUps: [], tokenCount: 0, estimatedCost: 0 }]);

    try {
      const res = await authFetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          // empty selection means "search everything" — omit the field entirely rather
          // than sending [], since the backend treats [] as "match no documents"
          documentIds: selectedDocIds.size > 0 ? Array.from(selectedDocIds) : undefined,
          history: historyForBackend,
        }),
      });

      if (!res.ok || !res.body) throw new Error('query failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            updateLastTurn({ sources: data.sources });
          } else if (eventType === 'token') {
            setTurns(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, answer: last.answer + data.token };
              return next;
            });
          } else if (eventType === 'followups') {
            updateLastTurn({ followUps: data.followUps });
          } else if (eventType === 'done') {
            updateLastTurn({ tokenCount: data.tokenCount, estimatedCost: data.estimatedCost });
          } else if (eventType === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch {
      // drop the empty in-progress turn rather than leaving a blank bubble behind
      setTurns(prev => prev.slice(0, -1));
      setError('Something went wrong. Check that the backend is running.');
    } finally {
      setQuerying(false);
    }
  }

  if (user === undefined) {
    return <div className="h-screen w-full bg-bg" />;
  }

  if (user === null) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg text-ink">
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-[10px] bg-accent flex items-center justify-center text-accent-fg">
            <Logo className="w-7 h-7" />
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight">DocQuery</h1>
          <p className="text-muted text-sm">Sign in to access your documents.</p>
          <button
            onClick={handleSignIn}
            className="px-5 py-[10px] rounded-[9px] bg-accent text-accent-fg text-[13.5px] font-semibold cursor-pointer hover:bg-accent-hi transition-colors duration-150"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunksIngested, 0);
  const scopeLabel = selectedDocIds.size === 0 ? 'all documents' : `scope: ${selectedDocIds.size} file${selectedDocIds.size === 1 ? '' : 's'}`;

  return (
    <div className="flex h-screen min-h-[640px] w-full bg-bg text-ink overflow-hidden">
      <aside className="w-[288px] flex-none h-full flex flex-col bg-panel border-r border-edge">
        <div className="flex items-center gap-[9px] px-4 h-14 flex-none border-b border-edge">
          <div className="w-[22px] h-[22px] rounded-[6px] bg-accent flex items-center justify-center text-accent-fg">
            <Logo className="w-[14px] h-[14px]" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">DocQuery</span>
        </div>

        <FileUpload folders={folders} onUpload={handleUpload} />

        <div className="flex items-center gap-1 px-3.5 pt-3 flex-none">
          {(['sources', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`
                text-[12px] font-medium px-2.5 py-1 rounded-[6px] capitalize cursor-pointer
                ${sidebarTab === tab ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink'}
              `}
            >
              {tab}
            </button>
          ))}
        </div>

        {sidebarTab === 'sources' ? (
          <DocumentList
            documents={documents}
            folders={folders}
            selectedDocIds={selectedDocIds}
            onChange={setSelectedDocIds}
            onFolderCreated={handleFolderCreated}
          />
        ) : (
          <HistoryList
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onDeleteThread={handleDeleteThread}
          />
        )}

        <div className="flex-none border-t border-edge px-4 py-[11px] flex flex-col gap-[9px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[12px] text-muted truncate">{user.name}</span>
            </div>
            <button onClick={handleSignOut} className="text-[11px] text-faint hover:text-ink flex-shrink-0 cursor-pointer">
              Sign out
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] text-faint">{documents.length} docs · {totalChunks} chunks</span>
            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              className="flex items-center gap-[5px] px-[9px] py-1 border border-edge rounded-full text-[11px] text-muted hover:border-accent hover:text-accent transition-colors duration-150"
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full flex flex-col min-w-0 bg-bg">
        <header className="flex-none h-14 flex items-center justify-between px-6 border-b border-edge bg-panel">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[14px] font-semibold tracking-tight truncate">
              {turns[0]?.question || 'Ask about your documents'}
            </span>
            <span className="font-mono text-[10px] tracking-wide px-2 py-[3px] rounded-full bg-accent-soft text-accent whitespace-nowrap">
              {scopeLabel}
            </span>
          </div>
          <button
            onClick={() => resetThread()}
            className="text-[12.5px] font-medium px-3 py-[6px] rounded-[7px] border border-edge2 hover:border-accent hover:text-accent transition-colors duration-150"
          >
            New thread
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-9 pb-2">
          <div className="max-w-[740px] mx-auto flex flex-col gap-[34px]">
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {turns.map((turn, i) => (
              <AnswerDisplay
                key={i}
                question={turn.question}
                result={turn}
                documents={documents}
                onFollowUpClick={handleQuery}
              />
            ))}

            {turns.length === 0 && !error && (
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
                placeholder={turns.length > 0 ? 'Ask a follow-up…' : 'Ask a question about your documents…'}
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
