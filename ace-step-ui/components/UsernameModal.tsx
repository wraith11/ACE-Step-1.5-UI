import React, { useState } from 'react';

interface UsernameModalProps {
  isOpen: boolean;
  onSubmit: (username: string) => Promise<void>;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ isOpen, onSubmit }) => {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(username.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-[90%] max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl p-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Welcome to ACE-Step</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Your local AI music studio. Pick a username to get started — everything stays on this machine.
        </p>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Username"
          autoFocus
          className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-pink-500 mb-4"
        />
        <button onClick={handleSubmit} disabled={submitting || !username.trim()}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
          {submitting ? 'Setting up...' : 'Get Started'}
        </button>
      </div>
    </div>
  );
};