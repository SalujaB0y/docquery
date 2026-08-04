'use client';

import { useState } from 'react';

type Props = {
  onSubmit: (question: string) => void;
  loading: boolean;
  placeholder?: string;
};

export default function QueryInput({ onSubmit, loading, placeholder = 'Ask a question…' }: Props) {
  const [question, setQuestion] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setQuestion('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 py-[7px] pl-4 pr-[7px] rounded-[13px] border border-edge2 bg-panel shadow-[0_2px_14px_rgba(0,0,0,0.08)] focus-within:border-accent"
    >
      <input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        className="flex-1 min-w-0 bg-transparent text-[14.5px] text-ink placeholder-faint focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!question.trim() || loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-[9px] bg-accent text-accent-fg text-[13.5px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hi transition-colors duration-150"
      >
        {loading ? 'Thinking…' : 'Ask'}
      </button>
    </form>
  );
}
