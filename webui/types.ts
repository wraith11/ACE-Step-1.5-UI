export interface Song {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  coverUrl: string;
  duration: string;
  createdAt: Date;
  isGenerating?: boolean;
  queuePosition?: number;
  tags: string[];
  audioUrl?: string;
  isPublic?: boolean;
  likeCount?: number;
  viewCount?: number;
  userId?: string;
  creator?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  cover_url?: string;
  songIds?: string[];
  isPublic?: boolean;
  is_public?: boolean;
  user_id?: string;
  created_at?: string;
  song_count?: number;
  songs?: any[];
}

// ---------------------------------------------------------------------------
// Generation parameters
//
// These mirror the full parameter surface of the official ACE-Step Gradio UI
// so every control is available to experts, while end-users only touch a few.
// ---------------------------------------------------------------------------
export interface GenerationParams {
  // Mode
  customMode: boolean;
  mode: 'Custom' | 'Remix' | 'Cover' | 'Repaint' | 'Extract' | 'Complete';
  taskType: string;

  // Simple / sample
  songDescription?: string;

  // Custom Mode inputs
  prompt: string;
  lyrics: string;
  style: string;
  title: string;

  // Reference audio (custom/cover/remix)
  referenceAudioUrl?: string;
  sourceAudioUrl?: string;

  // Common
  instrumental: boolean;
  vocalLanguage: string;

  // Optional metadata (auto-toggles in original UI)
  bpm?: number;
  bpmAuto: boolean;
  keyScale: string;
  keyAuto: boolean;
  timeSignature: string;
  timesigAuto: boolean;
  duration?: number;
  durationAuto: boolean;
  batchSize: number;

  // DiT advanced
  inferenceSteps: number;
  guidanceScale: number;
  inferMethod: 'ode' | 'sde';
  samplerMode: 'euler' | 'heun';
  velocityNormThreshold: number;
  velocityEmaFactor: number;
  useAdg: boolean;
  shift: number;
  customTimesteps?: string;
  cfgIntervalStart: number;
  cfgIntervalEnd: number;
  seed: number;
  randomSeed: boolean;

  // DCW
  dcwEnabled: boolean;
  dcwMode: 'low' | 'high' | 'double' | 'pix';
  dcwWavelet: string;
  dcwScaler: number;
  dcwHighScaler: number;

  // LM advanced
  lmTemperature: number;
  lmCfgScale: number;
  lmTopK: number;
  lmTopP: number;
  lmNegativePrompt: string;
  lmUseLegacyCfgPrompt: boolean;
  useCotMetas: boolean;
  useCotCaption: boolean;
  useCotLanguage: boolean;
  constrainedDecodingDebug: boolean;
  allowLmBatch: boolean;
  lmBatchChunkSize: number;

  // Output
  audioFormat: 'mp3' | 'flac' | 'opus' | 'aac' | 'wav' | 'wav32';
  mp3Bitrate: string;
  mp3SampleRate: number;
  scoreScale: number;
  enableNormalization: boolean;
  normalizationDb: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  latentShift: number;
  latentRescale: number;

  // Repaint / cover
  repaintingStart: number;
  repaintingEnd: number;
  repaintMode: 'conservative' | 'balanced' | 'aggressive';
  repaintStrength: number;
  audioCoverStrength: number;
  coverNoiseStrength: number;
  noFsq: boolean;
  instruction: string;

  // Runtime toggles
  thinking: boolean;
  autogen: boolean;
  getScores: boolean;
  getLrc: boolean;

  // Track selection / code hints
  trackName?: string;
  completeTrackClasses?: string[];
  audioCodes?: string;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
}

export interface User {
  id: string;
  username: string;
  createdAt: Date;
  avatar_url?: string;
  isAdmin?: boolean;
}

export type View = 'create' | 'library';