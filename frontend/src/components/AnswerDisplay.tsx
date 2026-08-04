'use client';

import { useState } from 'react';
import type { QueryResult, UploadedDoc } from '@/app/page';

type Props = {
  question: string;
  result: QueryResult;
  documents: UploadedDoc[];
  onFollowUpClick: (question: string) => void;
};

const FALLBACK_MESSAGE = "I don't have enough information in the uploaded documents to answer this.";

function filenameFor(documentId: string, documents: UploadedDoc[]): string {
  return documents.find(d => d.documentId === documentId)?.filename ?? 'source';
}

function AnswerBody({
  answer,
  sources,
  activeIndex,
  onToggle,
}: {
  answer: string;
  sources: QueryResult['sources'];
  activeIndex: number | null;
  onToggle: (index: number) => void;
}) {
  const parts = answer.split(/(\[\d+\])/g);

  return (
    <p className="text-[15.5px] leading-[1.72] text-ink">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;

        const index = parseInt(match[1]);
        const source = sources.find(s => s.index === index);
        if (!source) return <span key={i}>{part}</span>;

        return (
          <button
            key={i}
            onClick={() => onToggle(index)}
            className={`
              inline-flex items-center justify-center min-w-[16px] h-4 mx-[2px] px-1
              rounded-[5px] font-mono text-[10px] font-medium align-[1px] cursor-pointer
              ${activeIndex === index ? 'bg-accent text-accent-fg' : 'bg-accent-soft text-accent'}
            `}
          >
            {index}
          </button>
        );
      })}
    </p>
  );
}

function SourceChips({
  sources,
  documents,
  activeIndex,
  onToggle,
}: {
  sources: QueryResult['sources'];
  documents: UploadedDoc[];
  activeIndex: number | null;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[7px] items-center">
      {sources.map(source => (
        <button
          key={source.index}
          onClick={() => onToggle(source.index)}
          className={`
            flex items-center gap-[7px] pl-[6px] pr-[10px] py-[5px] rounded-[8px] border
            bg-panel cursor-pointer transition-colors duration-150
            ${activeIndex === source.index ? 'border-accent' : 'border-edge hover:border-accent'}
          `}
        >
          <span className="flex items-center justify-center w-4 h-4 rounded-[4px] bg-accent-soft text-accent font-mono text-[9.5px]">
            {source.index}
          </span>
          <span className="font-mono text-[11.5px] text-muted truncate max-w-[180px]">
            {filenameFor(source.documentId, documents)}
          </span>
          <span className="text-faint text-[10px]">{activeIndex === source.index ? '▴' : '▾'}</span>
        </button>
      ))}
      <span className="font-mono text-[10.5px] text-faint">
        {sources.length} chunk{sources.length === 1 ? '' : 's'} retrieved
      </span>
    </div>
  );
}

export default function AnswerDisplay({ question, result, documents, onFollowUpClick }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isFallback = result.answer.startsWith(FALLBACK_MESSAGE.slice(0, 20));
  const activeSource = activeIndex !== null ? result.sources.find(s => s.index === activeIndex) : undefined;

  function toggle(index: number) {
    setActiveIndex(prev => (prev === index ? null : index));
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="self-end max-w-[78%] bg-accent-soft border border-edge rounded-[14px_14px_4px_14px] px-[15px] py-[11px] text-[14.5px] leading-[1.5] text-ink">
        {question}
      </div>

      <div className="flex flex-col gap-3">
        {isFallback ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">No confident match</p>
            <p className="text-[14.5px] leading-relaxed text-muted">{result.answer}</p>
          </div>
        ) : (
          <>
            <AnswerBody answer={result.answer} sources={result.sources} activeIndex={activeIndex} onToggle={toggle} />

            {result.sources.length > 0 && (
              <SourceChips sources={result.sources} documents={documents} activeIndex={activeIndex} onToggle={toggle} />
            )}

            {activeSource && (
              <div className="rounded-[8px] border border-edge overflow-hidden" style={{ borderLeft: '2px solid var(--accent)' }}>
                <div className="px-3 py-2 border-b border-edge">
                  <span className="font-mono text-[11.5px] text-muted">
                    {filenameFor(activeSource.documentId, documents)} · source {activeSource.index}
                  </span>
                </div>
                <p className="px-[13px] py-[11px] font-mono text-[13px] leading-[1.65] text-muted whitespace-pre-wrap">
                  {activeSource.content}
                </p>
              </div>
            )}
          </>
        )}

        {!isFallback && result.followUps.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">Follow up</span>
            <div className="flex flex-wrap gap-2">
              {result.followUps.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUpClick(q)}
                  className="text-[13px] px-[13px] py-[7px] rounded-full border border-edge bg-panel text-muted hover:border-accent hover:text-accent transition-colors duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {result.tokenCount > 0 && (
          <p className="font-mono text-[10.5px] text-faint pt-2 border-t border-edge">
            {result.tokenCount} tokens · ~${result.estimatedCost.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
