'use client';

import { useEffect, useRef, useState } from 'react';
import type { ThreadSummary } from '@/app/page';

type Props = {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
};

function scopeLabel(documentIds: string[]): string {
  return documentIds.length === 0 ? 'all documents' : `${documentIds.length} file${documentIds.length === 1 ? '' : 's'}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryList({ threads, activeThreadId, onSelectThread, onDeleteThread }: Props) {
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // closes the menu on any click outside it — otherwise it just sits open once opened
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuThreadId(null);
        setConfirmDeleteId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleMenu(threadId: string) {
    setMenuThreadId(prev => (prev === threadId ? null : threadId));
    setConfirmDeleteId(null);
  }

  function handleSelect(threadId: string) {
    setMenuThreadId(null);
    setConfirmDeleteId(null);
    onSelectThread(threadId);
  }

  function handleDelete(threadId: string) {
    onDeleteThread(threadId);
    setMenuThreadId(null);
    setConfirmDeleteId(null);
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-2 pt-3.5 pb-2">
      <div className="px-2 pb-[9px]">
        <span className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">History</span>
      </div>

      {threads.length === 0 ? (
        <p className="px-2 text-[13px] text-muted">Threads you start will show up here once you begin a new one.</p>
      ) : (
        <div className="flex flex-col gap-[1px]">
          {threads.map(thread => (
            <div key={thread.threadId} className="relative">
              <div
                onClick={() => handleSelect(thread.threadId)}
                className={`
                  flex items-start gap-1 px-2 py-[9px] rounded-[7px] cursor-pointer
                  ${thread.threadId === activeThreadId ? 'bg-accent-soft' : 'hover:bg-panel2'}
                `}
              >
                <div className="flex flex-col gap-[3px] min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-ink truncate">{thread.title}</span>
                  <span className="font-mono text-[10.5px] text-faint">
                    {relativeTime(thread.updatedAt)} · {thread.turnCount} turn{thread.turnCount === 1 ? '' : 's'} · {scopeLabel(thread.documentIds)}
                  </span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleMenu(thread.threadId); }}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-faint hover:text-ink hover:bg-panel2 leading-none cursor-pointer"
                  aria-label="Thread options"
                >
                  ⋮
                </button>
              </div>

              {menuThreadId === thread.threadId && (
                <div className="absolute right-1 top-[34px] z-10 min-w-[130px] bg-panel border border-edge rounded-[8px] shadow-lg overflow-hidden">
                  {confirmDeleteId === thread.threadId ? (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(thread.threadId); }}
                      className="block w-full text-left px-3 py-[7px] text-[12.5px] text-red-400 hover:bg-panel2 cursor-pointer"
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(thread.threadId); }}
                      className="block w-full text-left px-3 py-[7px] text-[12.5px] text-ink hover:bg-panel2 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
