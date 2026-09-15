// ---------------------------------------------------------------------------
// Local AI service
//
// Replaces the Gemini-based "AI Generate / Enhance / Random" helpers of the
// original Saganaki22 UI with fully-local equivalents backed by the ACE-Step
// REST API. Everything runs on the local machine (M3 + MLX) with no external
// API keys and no network access.
//
// Endpoints used (implemented by acestep/api/http/sample_format_routes.py):
//   POST /v1/create_sample  ->  natural-language description -> caption/lyrics/metas
//   POST /format_input      ->  enhance existing caption/lyrics + auto-fill metadata
//   POST /create_random_sample -> random pre-loaded example payload
//
// The local AI endpoints live behind the Express backend and require the auth
// token (Authorization: Bearer), same as the generation endpoints.
// ---------------------------------------------------------------------------

const API_BASE = '';

export interface LocalGeneratedSong {
  title: string;
  lyrics: string;
  style: string;          // comma-joined caption/tags
  caption: string;        // raw caption (may equal style)
  bpm: number;
  keyScale: string;
  timeSignature: string;
  duration: number;
  vocalLanguage: string;
}

interface Wrapped<T> {
  data?: T | null;
  error?: string | null;
}

function unwrap<T>(payload: Wrapped<T>, fallback: T): T {
  if (payload.error) throw new Error(payload.error);
  return payload.data ?? fallback;
}

// Title is derived heuristically: the local LLM does not return a song title,
// so we synthesize one from the caption unless the caller provides one.
function deriveTitle(caption: string): string {
  const cleaned = caption.split(',').map((s) => s.trim()).filter(Boolean);
  const first = cleaned[0] || '';
  if (!first) return 'Untitled';
  const words = first.split(/\s+/).slice(0, 5).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// A lyrics value that means "no vocals" — the LM emits these when it decides
// a track is instrumental. We never want to write this into the user's lyrics
// field; real text should stay text.
function isInstrumentalLyrics(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === '' || v === '[instrumental]' || v === '[inst]' || v === 'instrumental';
}

// ---------------------------------------------------------------------------
// Create a full song suggestion from a natural-language description
// (Simple-mode "AI Generate" equivalent).
// ---------------------------------------------------------------------------
export async function createSongFromDescription(
  description: string,
  instrumental: boolean,
  vocalLanguage: string,
  token?: string | null
): Promise<LocalGeneratedSong> {
  const res = await fetch(`${API_BASE}/api/generate/local/sample`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ query: description, instrumental, vocal_language: vocalLanguage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Local AI sample failed' }));
    throw new Error(err.detail || err.error || 'Local AI sample failed');
  }
  const payload = (await res.json()) as Wrapped<Record<string, unknown>>;
  const data = unwrap(payload, {} as Record<string, unknown>);

  const caption = String(data.caption || description || '');
  const style = caption;
  let lyrics = String(data.lyrics || '');
  // If the model decided this is instrumental but the user asked for vocals,
  // do not force "[Instrumental]" into the lyrics box.
  if (!instrumental && isInstrumentalLyrics(lyrics)) {
    lyrics = '';
  }
  return {
    title: deriveTitle(caption),
    lyrics,
    style,
    caption,
    bpm: Number(data.bpm || 0),
    keyScale: String(data.keyscale || data.key_scale || ''),
    timeSignature: String(data.timesignature || data.time_signature || ''),
    duration: Number(data.duration || 0),
    vocalLanguage: String(data.vocal_language || vocalLanguage || 'en'),
  };
}

// ---------------------------------------------------------------------------
// Enhance existing caption + lyrics and auto-fill metadata
// (Custom-mode "Format & Enhance" / sparkles equivalent).
// ---------------------------------------------------------------------------
export async function enhanceCaptionLyrics(
  caption: string,
  lyrics: string,
  current: {
    bpm?: number;
    duration?: number;
    keyScale?: string;
    timeSignature?: string;
  },
  token?: string | null
): Promise<LocalGeneratedSong> {
  const res = await fetch(`${API_BASE}/api/generate/local/format`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      prompt: caption,
      lyrics,
      bpm: current.bpm,
      duration: current.duration,
      key_scale: current.keyScale,
      time_signature: current.timeSignature,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Local AI format failed' }));
    throw new Error(err.detail || err.error || 'Local AI format failed');
  }
  const payload = (await res.json()) as Wrapped<Record<string, unknown>>;
  const data = unwrap(payload, {} as Record<string, unknown>);

  const captionOut = String(data.caption || caption || '');
  return {
    title: deriveTitle(captionOut),
    lyrics: String(data.lyrics || lyrics || ''),
    style: captionOut,
    caption: captionOut,
    bpm: Number(data.bpm || 0),
    keyScale: String(data.key_scale || data.keyscale || ''),
    timeSignature: String(data.time_signature || data.timesignature || ''),
    duration: Number(data.duration || 0),
    vocalLanguage: String(data.vocal_language || ''),
  };
}

// ---------------------------------------------------------------------------
// Fetch a random pre-loaded example (Simple-mode "dice"/random button).
// ---------------------------------------------------------------------------
export async function fetchRandomSample(
  sampleType: 'simple_mode' | 'custom_mode',
  token?: string | null
): Promise<{
  description?: string;
  caption?: string;
  lyrics?: string;
  bpm?: number;
  duration?: number;
  keyScale?: string;
  timeSignature?: string;
  vocalLanguage?: string;
  instrumental?: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/generate/local/random`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ sample_type: sampleType }),
  });
  if (!res.ok) {
    throw new Error('Failed to load random sample');
  }
  const payload = (await res.json()) as Wrapped<Record<string, unknown>>;
  const data = unwrap(payload, {} as Record<string, unknown>);
  return {
    description: data.description ? String(data.description) : undefined,
    caption: data.caption ? String(data.caption) : undefined,
    lyrics: data.lyrics ? String(data.lyrics) : undefined,
    bpm: data.bpm ? Number(data.bpm) : undefined,
    duration: data.duration ? Number(data.duration) : undefined,
    keyScale: data.key_scale ? String(data.key_scale) : (data.keyscale ? String(data.keyscale) : undefined),
    timeSignature: data.time_signature ? String(data.time_signature) : (data.timesignature ? String(data.timesignature) : undefined),
    vocalLanguage: data.vocal_language ? String(data.vocal_language) : undefined,
    instrumental: data.instrumental === true || data.instrumental === 'true',
  };
}