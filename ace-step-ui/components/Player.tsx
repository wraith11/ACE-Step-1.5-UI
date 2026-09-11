import React, { useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Volume2 } from 'lucide-react';
import { Song } from '../types';

interface PlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'none' | 'all' | 'one';
  onToggleRepeat: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
  onReusePrompt: () => void;
}

export const Player: React.FC<PlayerProps> = ({
  currentSong, isPlaying, onTogglePlay, currentTime, duration, onSeek,
  onNext, onPrevious, volume, onVolumeChange, isShuffle, onToggleShuffle,
  repeatMode, onToggleRepeat, isLiked, onToggleLike, onReusePrompt,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const format = (t: number) => {
    if (!Number.isFinite(t) || t <= 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="h-[88px] bg-white dark:bg-suno-sidebar border-t border-zinc-200 dark:border-white/5 flex items-center px-4 gap-4 flex-shrink-0">
      {/* Track info */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow">
          <span className="text-white font-bold text-xs">♪</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{currentSong.title}</div>
          <div className="text-xs text-zinc-500 truncate">{currentSong.style || 'ACE-Step'}</div>
        </div>
        <button onClick={onToggleLike} className={`ml-1 ${isLiked ? 'text-pink-500' : 'text-zinc-400 hover:text-pink-500'} transition-colors flex-shrink-0`}>
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onReusePrompt} title="Reuse as template"
          className="text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      {/* Controls + progress */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button onClick={onToggleShuffle} className={`${isShuffle ? 'text-pink-500' : 'text-zinc-400'} hover:text-white transition-colors`} title="Shuffle">
            <Shuffle size={15} />
          </button>
          <button onClick={onPrevious} className="text-zinc-400 hover:text-white transition-colors" title="Previous">
            <SkipBack size={20} />
          </button>
          <button onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-white dark:bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button onClick={onNext} className="text-zinc-400 hover:text-white transition-colors" title="Next">
            <SkipForward size={20} />
          </button>
          <button onClick={onToggleRepeat} className={`${repeatMode !== 'none' ? 'text-pink-500' : 'text-zinc-400'} hover:text-white transition-colors relative`} title="Repeat">
            <Repeat size={15} />
            {repeatMode === 'one' && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">1</span>}
          </button>
        </div>
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 tabular-nums w-10 text-right">{format(currentTime)}</span>
          <div ref={progressRef}
            onClick={(e) => {
              const rect = progressRef.current?.getBoundingClientRect();
              if (!rect || duration <= 0) return;
              onSeek(((e.clientX - rect.left) / rect.width) * duration);
            }}
            className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 cursor-pointer">
            <div className="h-full bg-gradient-to-r from-orange-500 to-pink-600 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-zinc-500 tabular-nums w-10">{format(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-[15%] justify-end">
        <Volume2 size={16} className="text-zinc-400" />
        <input type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-24 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-pink-500" />
      </div>
    </div>
  );
};