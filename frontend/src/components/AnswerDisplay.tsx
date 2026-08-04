'use client';

import { useState } from 'react';
import type { QueryResult } from '@/app/page';

type Props = {
  result: QueryResult;
  onFollowUpClick?: (question: string) => void;
};

const FALLBACK_MESSAGE = "I don't have enough information in the uploaded documents to answer this.";

function AnswerWithTooltips({
  answer,
  sources,
}: {
  answer: string;
  sources: QueryResult['sources'];
}) {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const parts = answer.split(/(\[\d+\])/g);

  return (
    <p className="text-zinc-200 text-sm leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;

        const index = parseInt(match[1]);
        const source = sources.find(s => s.index === index);
        if (!source) return <span key={i}>{part}</span>;

        return (
          <span key={i} className="relative inline-block">
            <button
              onClick={() => setActiveTooltip(activeTooltip === index ? null : index)}
              className="text-accent font-medium hover:underline focus:outline-none"
            >
              {part}
            </button>
            {activeTooltip === index && (
              <span className="
                absolute left-0 top-6 z-10 w-72
                bg-zinc-800 border border-zinc-700 rounded-lg p-3
                text-xs text-zinc-300 leading-relaxed shadow-xl
              ">
                {source.content}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

function FollowUpInput({ onSubmit }: { onSubmit: (question: string) => void }) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ask your own follow-up..."
        className="
          flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5
          text-xs text-zinc-200 placeholder-zinc-500
          focus:outline-none focus:border-accent
          transition-colors duration-150
        "
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="
          px-3 py-1.5 rounded-lg text-xs font-medium
          bg-accent text-white
          disabled:opacity-40 disabled:cursor-not-allowed
          hover:bg-indigo-400 transition-colors duration-150
        "
      >
        Ask
      </button>
    </form>
  );
}

export default function AnswerDisplay({ result, onFollowUpClick }: Props) {
  const isFallback = result.answer.startsWith(FALLBACK_MESSAGE.slice(0, 20));

  return (
    <div className="border border-zinc-800 rounded-xl p-6 space-y-4">
      {isFallback ? (
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">No confident match</p>
          <p className="text-zinc-300 text-sm leading-relaxed">{result.answer}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Answer</p>
          <AnswerWithTooltips answer={result.answer} sources={result.sources} />
        </div>
      )}

      {!isFallback && onFollowUpClick && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <p className="text-zinc-400 text-xs uppercase tracking-widest font-medium">Follow up</p>
          {result.followUps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.followUps.map((question, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUpClick(question)}
                  className="
                    text-xs px-3 py-1.5 rounded-full
                    border border-zinc-700 text-zinc-300
                    hover:border-accent hover:text-accent
                    transition-colors duration-150
                  "
                >
                  {question}
                </button>
              ))}
            </div>
          )}
          <FollowUpInput onSubmit={onFollowUpClick} />
        </div>
      )}

      {result.tokenCount > 0 && (
        <p className="text-zinc-600 text-xs pt-2 border-t border-zinc-800">
          {result.tokenCount} tokens · ~${result.estimatedCost.toFixed(5)}
        </p>
      )}
    </div>
  );
}
