'use client';

import { useState } from 'react';

type Props = {
  onSubmit: (question: string) => void;
  loading: boolean;
};

export default function QueryInput({ onSubmit, loading }: Props) {
  const [question, setQuestion] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
          }
        }}
        placeholder="Ask a question about your document..."
        rows={3}
        className="
          w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3
          text-sm text-zinc-100 placeholder-zinc-500
          focus:outline-none focus:border-accent
          resize-none transition-colors duration-150
        "
      />
      <button
        type="submit"
        disabled={!question.trim() || loading}
        className="
          self-end px-5 py-2 rounded-lg text-sm font-medium
          bg-accent text-white
          disabled:opacity-40 disabled:cursor-not-allowed
          hover:bg-indigo-400 transition-colors duration-150
        "
      >
        {loading ? 'Thinking...' : 'Ask'}
      </button>
    </form>
  );
}
