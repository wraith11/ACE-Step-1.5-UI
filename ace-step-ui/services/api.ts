// ---------------------------------------------------------------------------
// API client for the ACE-Step UI Express backend.
//
// The frontend never talks to the ACE-Step REST API directly. Instead it talks
// to the local Express backend (port 3001) which proxies/adapts calls to the
// ACE-Step API server (port 8001). This keeps auth + audio storage + DB in one
// place and lets the frontend use simple relative URLs (LAN-friendly).
// ---------------------------------------------------------------------------

const API_BASE = '';
import type { GenerationParams } from '../types';

export function getAudioUrl(audioUrl: string | undefined | null, songId?: string): string | undefined {
  if (!audioUrl) return undefined;
  if (audioUrl.startsWith('/audio/')) return audioUrl;
  return audioUrl;
}

async function api<T>(endpoint: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(`${response.status}: ${error.error || error.message || 'Request failed'}`);
  }
  return response.json();
}

// --- Auth (simplified local single-user) ---
export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
  avatar_url?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  auto: (): Promise<AuthResponse> => api('/api/auth/auto'),
  setup: (username: string): Promise<AuthResponse> => api('/api/auth/setup', { method: 'POST', body: { username } }),
  me: (token: string): Promise<{ user: User }> => api('/api/auth/me', { token }),
  logout: (): Promise<{ success: boolean }> => api('/api/auth/logout', { method: 'POST' }),
  refresh: (token: string): Promise<AuthResponse> => api('/api/auth/refresh', { method: 'POST', token }),
  updateUsername: (username: string, token: string): Promise<AuthResponse> =>
    api('/api/auth/username', { method: 'PATCH', body: { username }, token }),
};

// --- Songs ---
export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  caption?: string;
  cover_url?: string;
  audio_url?: string;
  audioUrl?: string;
  duration?: number;
  bpm?: number;
  key_scale?: string;
  time_signature?: string;
  tags: string[];
  is_public: boolean;
  like_count?: number;
  view_count?: number;
  user_id?: string;
  created_at: string;
  creator?: string;
}

function transformSongs(songs: Song[]): Song[] {
  return songs.map((song) => {
    const raw = song.audio_url || song.audioUrl;
    const resolved = getAudioUrl(raw, song.id);
    return { ...song, audio_url: resolved, audioUrl: resolved };
  });
}

export const songsApi = {
  getMySongs: async (token: string): Promise<{ songs: Song[] }> => {
    const result = await api('/api/songs', { token }) as { songs: Song[] };
    return { songs: transformSongs(result.songs) };
  },
  getSong: async (id: string, token?: string | null): Promise<{ song: Song }> => {
    const result = await api(`/api/songs/${id}`, { token: token || undefined }) as { song: Song };
    const raw = result.song.audio_url || result.song.audioUrl;
    return { song: { ...result.song, audio_url: getAudioUrl(raw, result.song.id), audioUrl: getAudioUrl(raw, result.song.id) } };
  },
  createSong: (song: Partial<Song>, token: string): Promise<{ song: Song }> =>
    api('/api/songs', { method: 'POST', body: song, token }),
  updateSong: (id: string, updates: Partial<Song>, token: string): Promise<{ song: Song }> =>
    api(`/api/songs/${id}`, { method: 'PATCH', body: updates, token }),
  deleteSong: (id: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/songs/${id}`, { method: 'DELETE', token }),
  toggleLike: (id: string, token: string): Promise<{ liked: boolean }> =>
    api(`/api/songs/${id}/like`, { method: 'POST', token }),
  getLikedSongs: async (token: string): Promise<{ songs: Song[] }> => {
    const result = await api('/api/songs/liked/list', { token }) as { songs: Song[] };
    return { songs: transformSongs(result.songs) };
  },
  togglePrivacy: (id: string, token: string): Promise<{ isPublic: boolean }> =>
    api(`/api/songs/${id}/privacy`, { method: 'PATCH', token }),
  trackPlay: (id: string, token?: string | null): Promise<{ viewCount: number }> =>
    api(`/api/songs/${id}/play`, { method: 'POST', token: token || undefined }),
};

// --- Generation ---
export interface GenerationJob {
  jobId: string;
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed';
  queuePosition?: number;
  etaSeconds?: number;
  result?: { audioUrls: string[]; bpm?: number; duration?: number; keyScale?: string; timeSignature?: string };
  error?: string;
}

export const generateApi = {
  startGeneration: (params: GenerationParams, token: string): Promise<GenerationJob> =>
    api('/api/generate', { method: 'POST', body: params, token }),

  getStatus: (jobId: string, token: string): Promise<GenerationJob> =>
    api(`/api/generate/status/${jobId}`, { token }),

  getHistory: (token: string): Promise<{ jobs: GenerationJob[] }> =>
    api('/api/generate/history', { token }),

  uploadAudio: async (file: File, token: string): Promise<{ url: string; key: string }> => {
    const formData = new FormData();
    formData.append('audio', file);
    const response = await fetch(`${API_BASE}/api/generate/upload-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.details || error.error || 'Upload failed');
    }
    return response.json();
  },
};

// --- Playlists ---
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
  user_id?: string;
  created_at?: string;
  song_count?: number;
}

export const playlistsApi = {
  create: (name: string, description: string, isPublic: boolean, token: string): Promise<{ playlist: Playlist }> =>
    api('/api/playlists', { method: 'POST', body: { name, description, isPublic }, token }),
  getMyPlaylists: (token: string): Promise<{ playlists: Playlist[] }> =>
    api('/api/playlists', { token }),
  getPlaylist: (id: string, token?: string | null): Promise<{ playlist: Playlist; songs: any[] }> =>
    api(`/api/playlists/${id}`, { token: token || undefined }),
  addSong: (playlistId: string, songId: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${playlistId}/songs`, { method: 'POST', body: { songId }, token }),
  removeSong: (playlistId: string, songId: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE', token }),
  update: (id: string, updates: Partial<Playlist>, token: string): Promise<{ playlist: Playlist }> =>
    api(`/api/playlists/${id}`, { method: 'PATCH', body: updates, token }),
  delete: (id: string, token: string): Promise<{ success: boolean }> =>
    api(`/api/playlists/${id}`, { method: 'DELETE', token }),
};