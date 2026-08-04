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
      <div className="flex items-center gap-2 px-4 py-2" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
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
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent"
        />
      </div>
    );
  }

  function FolderNode({ folder, depth }: { folder: Folder; depth: number }) {
    const isCollapsed = collapsed.has(folder.folderId);
    const state = folderCheckState(folder.folderId);
    const subfolders = childFolders(folder.folderId);
    const docs = childDocs(folder.folderId);

    return (
      <>
        <div
          className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-900 text-sm"
          style={{ paddingLeft: `${depth * 20 + 16}px` }}
        >
          <button
            onClick={() => toggleCollapsed(folder.folderId)}
            className="text-zinc-500 w-3 text-xs"
            aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
          <input
            type="checkbox"
            checked={state === 'checked'}
            ref={el => { if (el) el.indeterminate = state === 'indeterminate'; }}
            onChange={() => toggleFolder(folder.folderId)}
            className="accent-accent"
          />
          <span className="text-zinc-300 font-medium flex-1">{folder.name}</span>
          <button
            onClick={() => { setCreatingUnder(folder.folderId); setNewFolderName(''); }}
            className="text-zinc-600 hover:text-zinc-400 text-xs px-1"
            title="New subfolder"
          >
            +
          </button>
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
        className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-900 text-sm"
        style={{ paddingLeft: `${depth * 20 + 16 + 20}px` }}
      >
        <input
          type="checkbox"
          checked={selectedDocIds.has(doc.documentId)}
          onChange={() => toggleDocument(doc.documentId)}
          className="accent-accent"
        />
        <span
          className="text-zinc-400 flex-1"
          title={doc.summary ?? undefined}
        >
          {doc.filename}
        </span>
        <span className="text-zinc-600 text-xs">{doc.chunksIngested} chunks</span>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allCheckState === 'checked'}
            ref={el => { if (el) el.indeterminate = allCheckState === 'indeterminate'; }}
            onChange={toggleAll}
            disabled={allDocIds.length === 0}
            className="accent-accent"
            title="Select all documents"
          />
          <button
            onClick={() => onChange(new Set())}
            className={`text-left text-sm ${selectedDocIds.size === 0 ? 'text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            All documents
            <span className="ml-2 text-zinc-500">— {totalChunks} chunks indexed</span>
          </button>
        </div>
        <button
          onClick={() => { setCreatingUnder(null); setNewFolderName(''); }}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          + New folder
        </button>
      </div>

      {childFolders(null).map(f => <FolderNode key={f.folderId} folder={f} depth={0} />)}
      {childDocs(null).map(doc => <DocumentRow key={doc.documentId} doc={doc} depth={0} />)}
      {creatingUnder === null && <NewFolderRow parentFolderId={null} depth={0} />}
    </div>
  );
}
