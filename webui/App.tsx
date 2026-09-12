import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { CreatePanel } from './components/CreatePanel';
import { SongList } from './components/SongList';
import { Player } from './components/Player';
import { LibraryView } from './components/LibraryView';
import { CreatePlaylistModal, AddToPlaylistModal } from './components/PlaylistModals';
import { UsernameModal } from './components/UsernameModal';
import { Toast, ToastType } from './components/Toast';
import { Song, GenerationParams, View, Playlist } from './types';
import { generateApi, songsApi, playlistsApi, getAudioUrl } from './services/api';
import { useAuth } from './context/AuthContext';
import { useResponsive } from './context/ResponsiveContext';
import { List } from 'lucide-react';

export default function App() {
  const { isMobile } = useResponsive();
  const { user, token, isAuthenticated, isLoading: authLoading, setupUser, logout } = useAuth();
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const activeJobsRef = useRef<Map<string, { tempId: string; pollInterval: ReturnType<typeof setInterval> }>>(new Map());
  const [activeJobCount, setActiveJobCount] = useState(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [currentView, setCurrentView] = useState<View>('create');
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [playQueue, setPlayQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('all');

  const [isGenerating, setIsGenerating] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [mobileShowList, setMobileShowList] = useState(false);

  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);

  const [reuseData, setReuseData] = useState<{ song: Song; timestamp: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const playNextRef = useRef<() => void>(() => {});

  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({ message: '', type: 'success', isVisible: false });
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type, isVisible: true });
  const closeToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setShowUsernameModal(true);
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (token) {
      playlistsApi.getMyPlaylists(token).then((res) => setPlaylists(res.playlists)).catch(() => {});
    } else {
      setPlaylists([]);
    }
  }, [token]);

  useEffect(() => {
    return () => {
      activeJobsRef.current.forEach(({ pollInterval }) => clearInterval(pollInterval));
      activeJobsRef.current.clear();
    };
  }, []);

  const handleReuse = (song: Song) => {
    setReuseData({ song, timestamp: Date.now() });
    setCurrentView('create');
    setMobileShowList(false);
  };

  const handleNavigateToPlaylist = (playlistId: string) => {
    setSelectedPlaylist(playlists.find((p) => p.id === playlistId) || null);
    setCurrentView('library');
  };

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const mapSong = (s: any): Song => ({
    id: s.id,
    title: s.title,
    lyrics: s.lyrics,
    style: s.style,
    coverUrl: `https://picsum.photos/seed/${s.id}/400/400`,
    duration: s.duration && s.duration > 0 ? `${Math.floor(s.duration / 60)}:${String(Math.floor(s.duration % 60)).padStart(2, '0')}` : '0:00',
    createdAt: new Date(s.created_at || s.createdAt),
    tags: s.tags || [],
    audioUrl: getAudioUrl(s.audio_url, s.id),
    isPublic: s.is_public,
    likeCount: s.like_count || 0,
    viewCount: s.view_count || 0,
    userId: s.user_id,
    creator: s.creator,
  });

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const loadSongs = async () => {
      try {
        const [mySongsRes, likedSongsRes] = await Promise.all([
          songsApi.getMySongs(token),
          songsApi.getLikedSongs(token),
        ]);
        const mySongs = mySongsRes.songs.map(mapSong);
        const likedSongs = likedSongsRes.songs.map(mapSong);
        const songsMap = new Map<string, Song>();
        [...mySongs, ...likedSongs].forEach((s) => songsMap.set(s.id, s));
        setSongs((prev) => {
          const generating = prev.filter((s) => s.isGenerating);
          return [...generating, ...Array.from(songsMap.values())];
        });
        setLikedSongIds(new Set(likedSongs.map((s) => s.id)));
      } catch (error) {
        console.error('Failed to load songs:', error);
      }
    };
    loadSongs();
  }, [isAuthenticated, token]);

  const getActiveQueue = (song?: Song) => {
    if (playQueue.length > 0) return playQueue;
    if (song && songs.some((s) => s.id === song.id)) return songs;
    return songs;
  };

  const playNext = useCallback(() => {
    if (!currentSong) return;
    const queue = getActiveQueue(currentSong);
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    if (currentIndex === -1) return;
    if (repeatMode === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
      return;
    }
    let nextIndex;
    if (isShuffle) {
      do { nextIndex = Math.floor(Math.random() * queue.length); } while (queue.length > 1 && nextIndex === currentIndex);
    } else {
      nextIndex = (currentIndex + 1) % queue.length;
    }
    setQueueIndex(nextIndex);
    setCurrentSong(queue[nextIndex]);
    setIsPlaying(true);
  }, [currentSong, queueIndex, isShuffle, repeatMode, playQueue, songs]);

  const playPrevious = useCallback(() => {
    if (!currentSong) return;
    const queue = getActiveQueue(currentSong);
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
    if (currentIndex === -1) return;
    if (currentTime > 3) { if (audioRef.current) audioRef.current.currentTime = 0; return; }
    let prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    if (isShuffle) prevIndex = Math.floor(Math.random() * queue.length);
    setQueueIndex(prevIndex);
    setCurrentSong(queue[prevIndex]);
    setIsPlaying(true);
  }, [currentSong, queueIndex, currentTime, isShuffle, playQueue, songs]);

  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = 'anonymous';
    const audio = audioRef.current;
    audio.volume = volume;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const applyPendingSeek = () => {
      if (pendingSeekRef.current === null) return;
      if (audio.seekable.length === 0) return;
      const target = pendingSeekRef.current;
      const safeTarget = Number.isFinite(audio.duration) ? Math.min(Math.max(target, 0), audio.duration) : Math.max(target, 0);
      audio.currentTime = safeTarget;
      setCurrentTime(safeTarget);
      pendingSeekRef.current = null;
    };
    const onLoadedMetadata = () => { setDuration(audio.duration); applyPendingSeek(); };
    const onCanPlay = () => applyPendingSeek();
    const onProgress = () => applyPendingSeek();
    const onEnded = () => playNextRef.current();
    const onError = (e: Event) => {
      if (audio.error && audio.error.code !== 1) {
        if (audio.error.code === 4) showToast('This song is no longer available.', 'error');
        else showToast('Unable to play this song.', 'error');
      }
      setIsPlaying(false);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.audioUrl) return;
    const playAudio = async () => {
      try { await audio.play(); } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') { console.error('Playback failed:', err); setIsPlaying(false); }
      }
    };
    if (audio.src !== currentSong.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.load();
      if (isPlaying) playAudio();
    } else {
      if (isPlaying) playAudio();
      else audio.pause();
    }
  }, [currentSong, isPlaying]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  const cleanupJob = useCallback((jobId: string, tempId: string) => {
    const jobData = activeJobsRef.current.get(jobId);
    if (jobData) { clearInterval(jobData.pollInterval); activeJobsRef.current.delete(jobId); }
    setSongs((prev) => prev.filter((s) => s.id !== tempId));
    setActiveJobCount(activeJobsRef.current.size);
    if (activeJobsRef.current.size === 0) setIsGenerating(false);
  }, []);

  const refreshSongsList = useCallback(async () => {
    if (!token) return;
    try {
      const response = await songsApi.getMySongs(token);
      const loadedSongs: Song[] = response.songs.map(mapSong);
      setSongs((prev) => {
        const generating = prev.filter((s) => s.isGenerating);
        const merged = [...generating];
        for (const song of loadedSongs) {
          if (!merged.some((s) => s.id === song.id)) merged.push(song);
        }
        return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      });
    } catch (error) { console.error('Failed to refresh songs:', error); }
  }, [token]);

  const handleGenerate = async (params: GenerationParams) => {
    if (!isAuthenticated || !token) { setShowUsernameModal(true); return; }
    setIsGenerating(true);
    setCurrentView('create');
    setMobileShowList(false);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempSong: Song = {
      id: tempId,
      title: params.title || 'Generating...',
      lyrics: '',
      style: params.style,
      coverUrl: 'https://picsum.photos/200/200?blur=10',
      duration: '--:--',
      createdAt: new Date(),
      isGenerating: true,
      tags: [params.mode],
      isPublic: true,
    };
    setSongs((prev) => [tempSong, ...prev]);
    setSelectedSong(tempSong);

    try {
      const job = await generateApi.startGeneration(params, token);
      const pollInterval = setInterval(async () => {
        try {
          const status = await generateApi.getStatus(job.jobId, token);
          setSongs((prev) => prev.map((s) => (s.id === tempId ? { ...s, queuePosition: status.status === 'queued' ? status.queuePosition : undefined } : s)));
          if (status.status === 'succeeded' && status.result) {
            cleanupJob(job.jobId, tempId);
            await refreshSongsList();
            if (window.innerWidth < 768) setMobileShowList(true);
          } else if (status.status === 'failed') {
            cleanupJob(job.jobId, tempId);
            console.error(`Job ${job.jobId} failed:`, status.error);
            showToast(`Generation failed: ${status.error || 'Unknown error'}`, 'error');
          }
        } catch (pollError) {
          console.error(`Polling error for job ${job.jobId}:`, pollError);
          cleanupJob(job.jobId, tempId);
        }
      }, 2000);
      activeJobsRef.current.set(job.jobId, { tempId, pollInterval });
      setActiveJobCount(activeJobsRef.current.size);
      setTimeout(() => {
        if (activeJobsRef.current.has(job.jobId)) {
          cleanupJob(job.jobId, tempId);
          showToast('Generation timed out', 'error');
        }
      }, 600000);
    } catch (e) {
      console.error('Generation error:', e);
      setSongs((prev) => prev.filter((s) => s.id !== tempId));
      if (activeJobsRef.current.size === 0) setIsGenerating(false);
      showToast('Generation failed. Please try again.', 'error');
    }
  };

  const togglePlay = () => { if (currentSong) setIsPlaying(!isPlaying); };

  const playSong = (song: Song, list?: Song[]) => {
    const nextQueue = list && list.length > 0 ? list : (playQueue.length > 0 && playQueue.some((s) => s.id === song.id)) ? playQueue : (songs.some((s) => s.id === song.id) ? songs : [song]);
    const nextIndex = nextQueue.findIndex((s) => s.id === song.id);
    setPlayQueue(nextQueue);
    setQueueIndex(nextIndex);
    if (currentSong?.id !== song.id) {
      const updatedSong = { ...song, viewCount: (song.viewCount || 0) + 1 };
      setCurrentSong(updatedSong);
      setSelectedSong(updatedSong);
      setIsPlaying(true);
      songsApi.trackPlay(song.id, token).catch(() => {});
    } else {
      togglePlay();
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isNaN(audio.duration) || audio.readyState < 1 || audio.seekable.length === 0) { pendingSeekRef.current = time; return; }
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const toggleLike = async (songId: string) => {
    if (!token) return;
    const isLiked = likedSongIds.has(songId);
    setLikedSongIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(songId); else next.add(songId);
      return next;
    });
    setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, likeCount: Math.max(0, (s.likeCount || 0) + (isLiked ? -1 : 1)) } : s)));
    if (selectedSong?.id === songId) setSelectedSong((prev) => (prev ? { ...prev, likeCount: Math.max(0, (prev.likeCount || 0) + (isLiked ? -1 : 1)) } : null));
    try { await songsApi.toggleLike(songId, token); } catch (error) {
      console.error('Failed to toggle like:', error);
      setLikedSongIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(songId); else next.delete(songId);
        return next;
      });
    }
  };

  const handleDeleteSong = async (song: Song) => {
    if (!token) return;
    if (!window.confirm(`Delete "${song.title}"? This cannot be undone.`)) return;
    try {
      await songsApi.deleteSong(song.id, token);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      setLikedSongIds((prev) => { const next = new Set(prev); next.delete(song.id); return next; });
      if (selectedSong?.id === song.id) setSelectedSong(null);
      if (currentSong?.id === song.id) { setCurrentSong(null); setIsPlaying(false); if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; } }
      setPlayQueue((prev) => prev.filter((s) => s.id !== song.id));
      showToast('Song deleted successfully');
    } catch (error) { console.error('Failed to delete song:', error); showToast('Failed to delete song', 'error'); }
  };

  const createPlaylist = async (name: string, description: string) => {
    if (!token) return;
    try {
      const res = await playlistsApi.create(name, description, true, token);
      setPlaylists((prev) => [res.playlist, ...prev]);
      if (songToAddToPlaylist) {
        await playlistsApi.addSong(res.playlist.id, songToAddToPlaylist.id, token);
        setSongToAddToPlaylist(null);
        playlistsApi.getMyPlaylists(token).then((r) => setPlaylists(r.playlists));
      }
      showToast('Playlist created successfully!');
    } catch (error) { console.error('Create playlist error:', error); showToast('Failed to create playlist', 'error'); }
  };

  const openAddToPlaylistModal = (song: Song) => { setSongToAddToPlaylist(song); setIsAddToPlaylistModalOpen(true); };

  const addSongToPlaylist = async (playlistId: string) => {
    if (!songToAddToPlaylist || !token) return;
    try {
      await playlistsApi.addSong(playlistId, songToAddToPlaylist.id, token);
      setSongToAddToPlaylist(null);
      showToast('Song added to playlist');
      playlistsApi.getMyPlaylists(token).then((r) => setPlaylists(r.playlists));
    } catch (error) { console.error('Add song error:', error); showToast('Failed to add song to playlist', 'error'); }
  };

  const handleUsernameSubmit = async (username: string) => { await setupUser(username); setShowUsernameModal(false); };

  const renderContent = () => {
    if (currentView === 'library') {
      return (
        <LibraryView
          songs={songs}
          playlists={playlists}
          likedSongIds={likedSongIds}
          onPlaySong={playSong}
          onSelectPlaylist={(p) => handleNavigateToPlaylist(p.id)}
          onCreatePlaylist={() => { setSongToAddToPlaylist(null); setIsCreatePlaylistModalOpen(true); }}
        />
      );
    }
    return (
      <div className="flex h-full overflow-hidden relative w-full">
        <div className={`${mobileShowList ? 'hidden md:block' : 'w-full'} md:w-[340px] lg:w-[380px] flex-shrink-0 h-full border-r border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-suno-panel relative z-10`}>
          <CreatePanel onGenerate={handleGenerate} isGenerating={isGenerating} initialData={reuseData} onShowToast={showToast} />
        </div>
        <div className={`${!mobileShowList ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full overflow-hidden bg-white dark:bg-suno-DEFAULT`}>
          <SongList
            songs={songs}
            currentSong={currentSong}
            selectedSong={selectedSong}
            likedSongIds={likedSongIds}
            isPlaying={isPlaying}
            onPlay={playSong}
            onSelect={setSelectedSong}
            onToggleLike={toggleLike}
            onReusePrompt={handleReuse}
            onDelete={handleDeleteSong}
          />
        </div>
        <div className="md:hidden absolute top-4 right-4 z-50">
          <button onClick={() => setMobileShowList(!mobileShowList)}
            className="bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-white/10 flex items-center gap-2 text-sm font-bold">
            {mobileShowList ? 'Create Song' : 'View List'}
            <List size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-suno-DEFAULT text-zinc-900 dark:text-white font-sans antialiased selection:bg-pink-500/30 transition-colors duration-300">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={(v) => { setCurrentView(v); if (v === 'create') setMobileShowList(false); }}
          theme={theme}
          onToggleTheme={toggleTheme}
          user={user}
          onLogout={logout}
        />
        <main className="flex-1 flex overflow-hidden relative">{renderContent()}</main>
      </div>

      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        onNext={playNext}
        onPrevious={playPrevious}
        volume={volume}
        onVolumeChange={setVolume}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        repeatMode={repeatMode}
        onToggleRepeat={() => setRepeatMode((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))}
        isLiked={currentSong ? likedSongIds.has(currentSong.id) : false}
        onToggleLike={() => currentSong && toggleLike(currentSong.id)}
        onReusePrompt={() => currentSong && handleReuse(currentSong)}
      />

      <CreatePlaylistModal isOpen={isCreatePlaylistModalOpen} onClose={() => setIsCreatePlaylistModalOpen(false)} onCreate={createPlaylist} />
      <AddToPlaylistModal isOpen={isAddToPlaylistModalOpen} onClose={() => setIsAddToPlaylistModalOpen(false)} playlists={playlists} onSelect={addSongToPlaylist} onCreateNew={() => { setIsAddToPlaylistModalOpen(false); setIsCreatePlaylistModalOpen(true); }} />
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={closeToast} />
      <UsernameModal isOpen={showUsernameModal} onSubmit={handleUsernameSubmit} />
    </div>
  );
}