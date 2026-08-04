'use client';

import { useState } from 'react';
import type { UploadedDoc, Folder } from '@/app/page';

type Props = {
  documents: UploadedDoc[];
  folders: Folder[];
  selectedDocIds: Set<string>;
  onChange: (next: Set<string>) => void;
  onFolderCreated: (folder: Folder) => void;
};

type CheckState = 'checked' | 'unchecked' | 'indeterminate';

const DOT_COLORS = ['bg-dot-a', 'bg-dot-b', 'bg-dot-c', 'bg-dot-d'] as const;

function Checkbox({ state, onChange, title }: { state: CheckState; onChange: () => void; title?: string }) {
  return (
    <span className="relative inline-flex w-3.5 h-3.5 flex-shrink-0">
      <input
        type="checkbox"
        checked={state === 'checked'}
        ref={el => { if (el) el.indeterminate = state === 'indeterminate'; }}
        onChange={onChange}
        title={title}
        className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
      />
      <span
        className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center pointer-events-none ${
          state === 'unchecked' ? 'border-[1.5px] border-edge2' : 'bg-accent'
        }`}
      >
        {state === 'checked' && (
          <span className="text-accent-fg text-[9px] font-bold leading-none">✓</span>
        )}
        {state === 'indeterminate' && (
          <span className="w-[7px] h-[1.5px] bg-accent-fg rounded-full" />
        )}
      </span>
    </span>
  );
}

export default function DocumentList({ documents, folders, selectedDocIds, onChange, onFolderCreated }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunksIngested, 0);

  const childFolders = (parentId: string | null) =>
    folders.filter(f => f.parentFolderId === parentId);

  const childDocs = (folderId: string | null) =>
    documents.filter(d => d.folderId === folderId);

  // every document nested anywhere under a folder, not just direct children
  function descendantDocIds(folderId: string): string[] {
    const own = childDocs(folderId).map(d => d.documentId);
    const sub = childFolders(folderId).flatMap(f => descendantDocIds(f.folderId));
    return [...own, ...sub];
  }

  // color identity is per top-level folder, cycling through the palette by position,
  // and inherited (dimmed) by everything nested under it
  const topLevelFolders = childFolders(null);
  function topLevelAncestor(folder: Folder): Folder {
    let current = folder;
    while (current.parentFolderId !== null) {
      const parent = folders.find(f => f.folderId === current.parentFolderId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }
  function dotColorClass(folder: Folder): string {
    const top = topLevelAncestor(folder);
    const idx = topLevelFolders.findIndex(f => f.folderId === top.folderId);
    return DOT_COLORS[idx % DOT_COLORS.length] ?? DOT_COLORS[0];
  }

  function checkStateForIds(ids: string[]): CheckState {
    if (ids.length === 0) return 'unchecked';
    const selectedCount = ids.filter(id => selectedDocIds.has(id)).length;
    if (selectedCount === 0) return 'unchecked';
    if (selectedCount === ids.length) return 'checked';
    return 'indeterminate';
  }

  function toggleIds(ids: string[], shouldSelect: boolean) {
    const next = new Set(selectedDocIds);
    for (const id of ids) {
      if (shouldSelect) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  }

  function folderCheckState(folderId: string): CheckState {
    return checkStateForIds(descendantDocIds(folderId));
  }

  function toggleFolder(folderId: string) {
    const ids = descendantDocIds(folderId);
    toggleIds(ids, folderCheckState(folderId) === 'unchecked');
  }

  const allDocIds = documents.map(d => d.documentId);
  const allCheckState = checkStateForIds(allDocIds);

  function toggleAll() {
    toggleIds(allDocIds, allCheckState === 'unchecked');
  }

  function toggleDocument(documentId: string) {
    const next = new Set(selectedDocIds);
    if (next.has(documentId)) next.delete(documentId);
    else next.add(documentId);
    onChange(next);
  }

  function toggleCollapsed(folderId: string) {
    const next = new Set(collapsed);
    if (next.has(folderId)) next.delete(folderId);
    else next.add(folderId);
    setCollapsed(next);
  }

  async function submitNewFolder(parentFolderId: string | null) {
    if (newFolderName.trim().length === 0) {
      setCreatingUnder(undefined);
      return;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), parentFolderId }),
    });

    if (res.ok) {
      const folder: Folder = await res.json();
      onFolderCreated(folder);
    }

    setNewFolderName('');
    setCreatingUnder(undefined);
  }

  function NewFolderRow({ parentFolderId, depth }: { parentFolderId: string | null; depth: number }) {
    return (
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        <input
          autoFocus
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submitNewFolder(parentFolderId);
            if (e.key === 'Escape') { setNewFolderName(''); setCreatingUnder(undefined); }
          }}
          onBlur={() => submitNewFolder(parentFolderId)}
          placeholder="Folder name"
          className="flex-1 bg-bg border border-edge rounded px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent"
        />
      </div>
    );
  }

  function FolderNode({ folder, depth }: { folder: Folder; depth: number }) {
    const isCollapsed = collapsed.has(folder.folderId);
    const state = folderCheckState(folder.folderId);
    const subfolders = childFolders(folder.folderId);
    const docs = childDocs(folder.folderId);
    const dotClass = dotColorClass(folder);
    const isTopLevel = folder.parentFolderId === null;

    return (
      <>
        <div
          className="flex items-center gap-[9px] py-[7px] rounded-[7px] cursor-pointer hover:bg-panel2 text-[13px]"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <button
            onClick={() => toggleCollapsed(folder.folderId)}
            className="text-faint text-[9px] w-2 flex-shrink-0"
            aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
          <Checkbox state={state} onChange={() => toggleFolder(folder.folderId)} />
          <span
            className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${dotClass}`}
            style={{ opacity: isTopLevel ? 1 : 0.6 }}
          />
          <span className={`flex-1 truncate ${isTopLevel ? 'text-ink' : 'text-muted'}`}>{folder.name}</span>
          <button
            onClick={() => { setCreatingUnder(folder.folderId); setNewFolderName(''); }}
            className="text-faint hover:text-accent text-xs px-1 flex-shrink-0"
            title="New subfolder"
          >
            +
          </button>
          <span className="font-mono text-[10.5px] text-faint flex-shrink-0">{docs.length + subfolders.length}</span>
        </div>

        {!isCollapsed && (
          <>
            {subfolders.map(f => <FolderNode key={f.folderId} folder={f} depth={depth + 1} />)}
            {docs.map(doc => (
              // DocumentRow's own indent formula already accounts for being one level
              // deeper than its containing folder's header, so this passes `depth`
              // (the containing folder's depth), not depth + 1
              <DocumentRow key={doc.documentId} doc={doc} depth={depth} />
            ))}
            {creatingUnder === folder.folderId && (
              <NewFolderRow parentFolderId={folder.folderId} depth={depth + 1} />
            )}
          </>
        )}
      </>
    );
  }

  function DocumentRow({ doc, depth }: { doc: UploadedDoc; depth: number }) {
    return (
      <div
        className="flex items-center gap-[9px] py-[7px] rounded-[7px] cursor-pointer hover:bg-panel2"
        style={{ paddingLeft: `${depth * 20 + 8 + 25}px` }}
      >
        <Checkbox state={selectedDocIds.has(doc.documentId) ? 'checked' : 'unchecked'} onChange={() => toggleDocument(doc.documentId)} />
        <span
          className="font-mono text-[11.5px] flex-1 truncate text-muted"
          title={doc.summary ?? undefined}
        >
          {doc.filename}
        </span>
        <span className="font-mono text-[10.5px] text-faint flex-shrink-0">{doc.chunksIngested}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 pt-3.5 pb-2">
      <div className="flex items-center justify-between px-2 pb-[9px]">
        <span className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">Sources</span>
        <button
          onClick={() => { setCreatingUnder(null); setNewFolderName(''); }}
          className="text-[11.5px] text-muted hover:text-accent hover:bg-accent-soft px-1.5 py-0.5 rounded"
        >
          + folder
        </button>
      </div>

      <div
        className="flex items-center gap-[9px] px-2 py-[7px] rounded-[7px] cursor-pointer"
        style={{ background: selectedDocIds.size === 0 ? 'var(--accent-soft)' : 'transparent' }}
      >
        <Checkbox state={allCheckState} onChange={toggleAll} title="Select all documents" />
        <button
          onClick={() => onChange(new Set())}
          className="text-[13px] font-medium flex-1 text-left truncate"
          disabled={allDocIds.length === 0}
        >
          All documents
        </button>
        <span className="font-mono text-[10.5px] text-muted flex-shrink-0">{totalChunks}</span>
      </div>

      <div className="flex flex-col gap-[1px] mt-1">
        {childFolders(null).map(f => <FolderNode key={f.folderId} folder={f} depth={0} />)}
        {childDocs(null).map(doc => <DocumentRow key={doc.documentId} doc={doc} depth={0} />)}
        {creatingUnder === null && <NewFolderRow parentFolderId={null} depth={0} />}
      </div>
    </div>
  );
}
