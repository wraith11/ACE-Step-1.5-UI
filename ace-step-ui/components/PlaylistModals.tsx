import React, { useState } from 'react';
import { Playlist } from '../types';

// --- Create Playlist Modal ---
interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90%] max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">New Playlist</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Playlist name"
          autoFocus
          className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-pink-500 mb-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-pink-500 resize-none mb-4"
          rows={2}
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-200 dark:border-white/10 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={submitting || !name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Add to Playlist Modal ---
interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  onSelect: (playlistId: string) => Promise<void>;
  onCreateNew: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ isOpen, onClose, playlists, onSelect, onCreateNew }) => {
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = async (id: string) => {
    setSubmitting(id);
    try {
      await onSelect(id);
      onClose();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[90%] max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Add to Playlist</h3>
        {playlists.length === 0 ? (
          <p className="text-sm text-zinc-500 mb-4">No playlists yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => handleSelect(p.id)} disabled={submitting === p.id}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors text-left">
                <div>
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.name}</div>
                  <div className="text-xs text-zinc-500">{p.song_count || 0} songs</div>
                </div>
                {submitting === p.id && <span className="text-xs text-pink-500">Adding...</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-200 dark:border-white/10 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={onCreateNew} className="flex-1 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold transition-colors">
            New Playlist
          </button>
        </div>
      </div>
    </div>
  );
};