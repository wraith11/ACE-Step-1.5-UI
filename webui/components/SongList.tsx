import React from 'react';
import { Play, Pause, Heart, Loader2, RefreshCw } from 'lucide-react';
import { Song } from '../types';

interface SongListProps {
  songs: Song[];
  currentSong: Song | null;
  selectedSong: Song | null;
  likedSongIds: Set<string>;
  isPlaying: boolean;
  onPlay: (song: Song, list?: Song[]) => void;
  onSelect: (song: Song) => void;
  onToggleLike: (id: string) => void;
  onReusePrompt: (song: Song) => void;
  onDelete: (song: Song) => void;
}

export const SongList: React.FC<SongListProps> = ({
  songs, currentSong, selectedSong, likedSongIds, isPlaying,
  onPlay, onSelect, onToggleLike, onReusePrompt, onDelete,
}) => {
  const formatDuration = (s: Song) => {
    if (s.isGenerating) return s.queuePosition ? `Q${s.queuePosition}` : '--:--';
    return s.duration || '0:00';
  };

  if (songs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
          <Play size={28} className="text-white ml-1" />
        </div>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">No songs yet</h2>
        <p className="text-sm text-zinc-500 mt-1 max-w-xs">Describe a song on the left and hit Create. Your generations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
      {songs.map((song) => {
        const isCurrent = currentSong?.id === song.id;
        const isLiked = likedSongIds.has(song.id);
        return (
          <div key={song.id}
            onClick={() => onSelect(song)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer group ${
              isCurrent ? 'bg-pink-500/5 border-pink-500/30' : 'border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-white/5'
            }`}>
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(song, songs); }}
              className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                isCurrent ? 'bg-pink-600 text-white' : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-pink-500 hover:text-white'
              }`}>
              {song.isGenerating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isCurrent && isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} className="ml-0.5" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                {song.title}
              </div>
              <div className="text-xs text-zinc-500 truncate">{song.style || song.creator || 'ACE-Step'}</div>
            </div>

            <span className="text-xs text-zinc-400 tabular-nums flex-shrink-0">{formatDuration(song)}</span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onToggleLike(song.id); }}
                className={`p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors ${isLiked ? 'text-pink-500' : 'text-zinc-400 hover:text-pink-500'}`}>
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onReusePrompt(song); }}
                title="Reuse as template"
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                <RefreshCw size={15} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(song); }}
                title="Delete"
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-rose-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};