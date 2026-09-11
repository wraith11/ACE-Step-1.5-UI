import React from 'react';
import { Play, Plus, ListMusic } from 'lucide-react';
import { Song, Playlist } from '../types';

interface LibraryViewProps {
  songs: Song[];
  playlists: Playlist[];
  likedSongIds: Set<string>;
  onPlaySong: (song: Song, list?: Song[]) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  songs, playlists, likedSongIds, onPlaySong, onSelectPlaylist, onCreatePlaylist,
}) => {
  const likedSongs = songs.filter((s) => likedSongIds.has(s.id));
  const format = (d?: number) => {
    if (!d || d <= 0) return '0:00';
    return `${Math.floor(d / 60)}:${String(Math.floor(d % 60)).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Your Library</h1>
        <button onClick={onCreatePlaylist}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold transition-colors">
          <Plus size={16} /> New Playlist
        </button>
      </div>

      {/* Playlists */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Playlists</h2>
        {playlists.length === 0 ? (
          <div className="text-sm text-zinc-500">No playlists yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => onSelectPlaylist(p)}
                className="group text-left">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center shadow-sm group-hover:shadow-lg transition-shadow overflow-hidden">
                  {p.cover_url ? <img src={p.cover_url} className="w-full h-full object-cover" alt="" /> : <ListMusic size={40} className="text-zinc-500 dark:text-zinc-400" />}
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{p.name}</div>
                <div className="text-xs text-zinc-500">{p.song_count || 0} songs</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Liked songs */}
      <div>
        <h2 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Liked Songs</h2>
        {likedSongs.length === 0 ? (
          <div className="text-sm text-zinc-500">No liked songs yet.</div>
        ) : (
          <div className="space-y-2">
            {likedSongs.map((song) => (
              <div key={song.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                <button onClick={() => onPlaySong(song, likedSongs)}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-pink-500 hover:text-white flex items-center justify-center transition-colors">
                  <Play size={16} className="ml-0.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{song.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{song.style}</div>
                </div>
                <span className="text-xs text-zinc-400">{format(song.duration ? parseInt(song.duration, 10) : 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};