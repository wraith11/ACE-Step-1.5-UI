// ---------------------------------------------------------------------------
// ACE-Step API adapter
//
// Bridges the UI backend to the local ACE-Step REST API server (port 8001).
// Because the UI backend runs inside the ACE-Step repo, paths resolve relative
// to the repo root (parent of this file's own "server/src/services" folder:
//   ../../../../..  => repo root)
//
// The ACE-Step API contract (see acestep/api/http/):
//   POST /release_task   -> { data: { task_id, status, queue_position } }
//   POST /query_result   -> { data: [ { status: 0|1|2, result, ... } ] }
//   GET  /v1/audio?path= -> audio bytes
//   POST /v1/create_sample
//   POST /format_input
//   POST /create_random_sample
//   GET  /health
// ---------------------------------------------------------------------------

import { mkdir, copyFile, rm } from 'fs/promises';
import { spawn, execSync } from 'child_process';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ACE-Step repo root = server/src/services -> ../../../..  (server/src/services -> server/src -> server -> ace-step-ui -> repo root)
// __dirname = ace-step-ui/server/src/services
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const AUDIO_DIR = path.join(__dirname, '../../public/audio');

const ACESTEP_API = config.acestep.apiUrl;

export function resolvePythonPath(baseDir: string): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  const isWindows = process.platform === 'win32';
  const pythonExe = isWindows ? 'python.exe' : 'python';
  const portablePath = path.join(baseDir, 'python_embeded', pythonExe);
  if (existsSync(portablePath)) return portablePath;
  if (isWindows) return path.join(baseDir, '.venv', 'Scripts', pythonExe);
  return path.join(baseDir, '.venv', 'bin', 'python');
}

function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    const duration = parseFloat(result.trim());
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Health check (cached per session)
// ---------------------------------------------------------------------------
let apiAvailableCache: boolean | null = null;
let apiCheckPromise: Promise<boolean> | null = null;

export async function isApiAvailable(): Promise<boolean> {
  if (apiAvailableCache !== null) return apiAvailableCache;
  if (apiCheckPromise) return apiCheckPromise;
  apiCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${ACESTEP_API}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const data = (await response.json()) as {
          status?: string; healthy?: boolean; data?: { status?: string };
        };
        apiAvailableCache = data.status === 'ok' || data.healthy === true || data.data?.status === 'ok';
        return apiAvailableCache;
      }
      apiAvailableCache = false;
      return false;
    } catch {
      apiAvailableCache = false;
      return false;
    } finally {
      apiCheckPromise = null;
    }
  })();
  return apiCheckPromise;
}

export function resetApiCache(): void {
  apiAvailableCache = null;
  apiCheckPromise = null;
}

// ---------------------------------------------------------------------------
// Generation params (mirrors types.ts GenerationParams)
// ---------------------------------------------------------------------------
export interface GenerationParams {
  customMode: boolean;
  mode: string;
  taskType: string;
  prompt: string;
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  vocalLanguage: string;
  bpm?: number;
  keyScale: string;
  timeSignature: string;
  duration?: number;
  batchSize: number;
  referenceAudioUrl?: string;
  sourceAudioUrl?: string;
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
  dcwEnabled: boolean;
  dcwMode: string;
  dcwWavelet: string;
  dcwScaler: number;
  dcwHighScaler: number;
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
  audioFormat: string;
  mp3Bitrate: string;
  mp3SampleRate: number;
  scoreScale: number;
  enableNormalization: boolean;
  normalizationDb: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  latentShift: number;
  latentRescale: number;
  repaintingStart: number;
  repaintingEnd: number;
  repaintMode: string;
  repaintStrength: number;
  audioCoverStrength: number;
  coverNoiseStrength: number;
  noFsq: boolean;
  instruction: string;
  thinking: boolean;
  autogen: boolean;
  getScores: boolean;
  getLrc: boolean;
  trackName?: string;
  completeTrackClasses?: string[];
  audioCodes?: string;
}

// Build the /release_task body from UI params. The API uses snake_case keys.
function buildRequestBody(params: GenerationParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: params.prompt || params.style || 'pop music',
    lyrics: params.instrumental ? '' : (params.lyrics || ''),
    thinking: params.thinking ?? false,
    task_type: params.taskType || 'text2music',
    vocal_language: params.vocalLanguage || 'en',
    inference_steps: params.inferenceSteps ?? 8,
    guidance_scale: params.guidanceScale ?? 7.0,
    audio_format: params.audioFormat ?? 'mp3',
    use_random_seed: params.randomSeed !== false,
    seed: params.randomSeed ? -1 : (params.seed ?? -1),
    shift: params.shift ?? 3.0,
    infer_method: params.inferMethod || 'ode',
    sampler_mode: params.samplerMode || 'euler',
    velocity_norm_threshold: params.velocityNormThreshold ?? 0.0,
    velocity_ema_factor: params.velocityEmaFactor ?? 0.0,
    use_adg: params.useAdg ?? false,
    cfg_interval_start: params.cfgIntervalStart ?? 0.0,
    cfg_interval_end: params.cfgIntervalEnd ?? 1.0,
    use_cot_metas: params.useCotMetas ?? true,
    use_cot_caption: params.useCotCaption ?? false,
    use_cot_language: params.useCotLanguage ?? true,
    constrained_decoding_debug: params.constrainedDecodingDebug ?? false,
    allow_lm_batch: params.allowLmBatch ?? true,
    lm_temperature: params.lmTemperature ?? 0.85,
    lm_cfg_scale: params.lmCfgScale ?? 2.0,
    lm_top_p: params.lmTopP ?? 0.9,
    lm_negative_prompt: params.lmNegativePrompt ?? 'NO USER INPUT',
    dcw_enabled: params.dcwEnabled ?? false,
    dcw_mode: params.dcwMode || 'double',
    dcw_wavelet: params.dcwWavelet || 'haar',
    dcw_scaler: params.dcwScaler ?? 0.05,
    dcw_high_scaler: params.dcwHighScaler ?? 0.02,
    repainting_start: params.repaintingStart ?? 0.0,
    repainting_end: params.repaintingEnd ?? -1,
    repaint_mode: params.repaintMode || 'balanced',
    repaint_strength: params.repaintStrength ?? 0.5,
    audio_cover_strength: params.audioCoverStrength ?? 1.0,
    cover_noise_strength: params.coverNoiseStrength ?? 0.0,
    no_fsq: params.noFsq ?? false,
    instruction: params.instruction,
    enable_normalization: params.enableNormalization ?? true,
    normalization_db: params.normalizationDb ?? -1.0,
    fade_in_duration: params.fadeInDuration ?? 0.0,
    fade_out_duration: params.fadeOutDuration ?? 0.0,
    latent_shift: params.latentShift ?? 0.0,
    latent_rescale: params.latentRescale ?? 1.0,
  };

  if (params.lmTopK && params.lmTopK > 0) body.lm_top_k = params.lmTopK;
  if (params.duration && params.duration > 0) body.audio_duration = params.duration;
  if (params.bpm && params.bpm > 0) body.bpm = params.bpm;
  if (params.keyScale) body.key_scale = params.keyScale;
  if (params.timeSignature) body.time_signature = params.timeSignature;
  if (params.batchSize && params.batchSize > 1) body.batch_size = params.batchSize;
  if (params.customTimesteps) body.timesteps = params.customTimesteps;
  if (params.audioCodes) body.audio_code_string = params.audioCodes;
  if (params.trackName) body.track_name = params.trackName;
  if (params.completeTrackClasses && params.completeTrackClasses.length > 0) body.track_classes = params.completeTrackClasses;
  if (params.lmUseLegacyCfgPrompt) body.lm_use_legacy_cfg_prompt = true;
  if (params.mp3Bitrate && params.audioFormat === 'mp3') body.mp3_bitrate = params.mp3Bitrate;
  if (params.mp3SampleRate && params.audioFormat === 'mp3') body.mp3_sample_rate = params.mp3SampleRate;

  // Reference / source audio paths
  if (params.referenceAudioUrl) {
    body.reference_audio_path = params.referenceAudioUrl.startsWith('/audio/')
      ? path.join(AUDIO_DIR, params.referenceAudioUrl.replace('/audio/', ''))
      : params.referenceAudioUrl;
  }
  if (params.sourceAudioUrl) {
    body.src_audio_path = params.sourceAudioUrl.startsWith('/audio/')
      ? path.join(AUDIO_DIR, params.sourceAudioUrl.replace('/audio/', ''))
      : params.sourceAudioUrl;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Submit + poll the ACE-Step API
// ---------------------------------------------------------------------------
async function submitToApi(params: GenerationParams): Promise<{ taskId: string }> {
  const body = buildRequestBody(params);
  const response = await fetch(`${ACESTEP_API}/release_task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  const taskId = result.data?.task_id || result.data?.job_id || result.job_id || result.task_id;
  if (!taskId) throw new Error('No task ID returned from API');
  return { taskId };
}

interface ApiTaskResult {
  status: number;
  audioPaths: string[];
  metas?: { bpm?: number; duration?: number; genres?: string; keyscale?: string; timesignature?: string };
}

async function pollApiResult(taskId: string, maxWaitMs = 600000): Promise<ApiTaskResult> {
  const startTime = Date.now();
  const pollInterval = 2000;
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${ACESTEP_API}/query_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id_list: [taskId] }),
    });
    if (!response.ok) throw new Error(`API poll error: ${response.status}`);
    const result = await response.json();
    const taskData = result.data?.[0];
    if (!taskData) {
      await new Promise((r) => setTimeout(r, pollInterval));
      continue;
    }
    if (taskData.status === 1) {
      let resultData;
      try { resultData = typeof taskData.result === 'string' ? JSON.parse(taskData.result) : taskData.result; } catch { resultData = []; }
      const audioPaths: string[] = Array.isArray(resultData)
        ? resultData.map((r: { file?: string }) => r.file).filter((f): f is string => Boolean(f))
        : [];
      const metas = resultData[0]?.metas;
      return { status: 1, audioPaths, metas };
    } else if (taskData.status === 2) {
      throw new Error('Generation failed on API side');
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  throw new Error('API generation timeout');
}

async function downloadAudioFromApi(audioPath: string, destPath: string): Promise<void> {
  const url = audioPath.startsWith('/v1/audio')
    ? `${ACESTEP_API}${audioPath}`
    : `${ACESTEP_API}/v1/audio?path=${encodeURIComponent(audioPath)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
  const body = response.body;
  if (!body) throw new Error('No response body');
  await mkdir(path.dirname(destPath), { recursive: true });
  const fileStream = createWriteStream(destPath);
  const reader = body.getReader();
  const nodeStream = new (await import('stream')).Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(Buffer.from(value));
    }
  });
  await pipeline(nodeStream, fileStream);
}

// ---------------------------------------------------------------------------
// Job management (sequential queue — GPU can only run one job at a time)
// ---------------------------------------------------------------------------
interface ActiveJob {
  params: GenerationParams;
  startTime: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: { audioUrls: string[]; duration: number; bpm?: number; keyScale?: string; timeSignature?: string };
  error?: string;
  queuePosition?: number;
}

const activeJobs = new Map<string, ActiveJob>();
const jobQueue: string[] = [];
let isProcessingQueue = false;

export async function generateMusicViaAPI(params: GenerationParams): Promise<{ jobId: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job: ActiveJob = { params, startTime: Date.now(), status: 'queued', queuePosition: jobQueue.length + 1 };
  activeJobs.set(jobId, job);
  jobQueue.push(jobId);
  processQueue().catch((err) => console.error('Queue processing error:', err));
  return { jobId };
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (jobQueue.length > 0) {
    const jobId = jobQueue[0];
    const job = activeJobs.get(jobId);
    if (job && job.status === 'queued') {
      try { await processGeneration(jobId, job); } catch (error) { console.error(`Queue processing error for ${jobId}:`, error); }
    }
    jobQueue.shift();
    jobQueue.forEach((id, index) => {
      const q = activeJobs.get(id);
      if (q) q.queuePosition = index + 1;
    });
  }
  isProcessingQueue = false;
}

async function processGeneration(jobId: string, job: ActiveJob): Promise<void> {
  job.status = 'running';
  const params = job.params;
  const useApi = await isApiAvailable();

  if (useApi) {
    try {
      const { taskId } = await submitToApi(params);
      const apiResult = await pollApiResult(taskId);
      if (!apiResult.audioPaths || apiResult.audioPaths.length === 0) throw new Error('No audio files generated by API');

      const audioUrls: string[] = [];
      let actualDuration = 0;
      for (const apiAudioPath of apiResult.audioPaths) {
        const ext = apiAudioPath.includes('.flac') ? '.flac' : `.${params.audioFormat || 'mp3'}`;
        const filename = `${jobId}_${audioUrls.length}${ext}`;
        const destPath = path.join(AUDIO_DIR, filename);
        await downloadAudioFromApi(apiAudioPath, destPath);
        if (audioUrls.length === 0) actualDuration = getAudioDuration(destPath);
        audioUrls.push(`/audio/${filename}`);
      }

      const finalDuration = actualDuration > 0 ? actualDuration : (apiResult.metas?.duration || params.duration || 60);
      job.status = 'succeeded';
      job.result = {
        audioUrls,
        duration: finalDuration,
        bpm: apiResult.metas?.bpm || params.bpm,
        keyScale: apiResult.metas?.keyscale || params.keyScale,
        timeSignature: apiResult.metas?.timesignature || params.timeSignature,
      };
      console.log(`Job ${jobId}: Completed via API with ${audioUrls.length} audio files`);
    } catch (error) {
      console.error(`Job ${jobId}: API generation failed`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'API generation failed';
    }
    return;
  }

  // Fallback: spawn the CLI directly
  console.log(`Job ${jobId}: ACE-Step API not available — falling back to direct Python spawn`);
  job.status = 'failed';
  job.error = 'ACE-Step API is not running. Start the API server first (see start-all-macos.sh).';
}

export async function getJobStatus(jobId: string): Promise<{
  status: string; queuePosition?: number; etaSeconds?: number; result?: ActiveJob['result']; error?: string;
}> {
  const job = activeJobs.get(jobId);
  if (!job) return { status: 'failed', error: 'Job not found' };
  if (job.status === 'succeeded') return { status: 'succeeded', result: job.result };
  if (job.status === 'failed') return { status: 'failed', error: job.error || 'Generation failed' };
  if (job.status === 'queued') return { status: 'queued', queuePosition: job.queuePosition, etaSeconds: (job.queuePosition || 1) * 180 };
  return { status: 'running', etaSeconds: Math.max(0, 180 - Math.floor((Date.now() - job.startTime) / 1000)) };
}

export function cleanupJob(jobId: string): void {
  activeJobs.delete(jobId);
}

export async function getAudioStream(audioPath: string): Promise<Response> {
  if (audioPath.startsWith('http')) return fetch(audioPath);
  if (audioPath.startsWith('/audio/')) {
    const localPath = path.join(AUDIO_DIR, audioPath.replace('/audio/', ''));
    try {
      const { readFile } = await import('fs/promises');
      const buffer = await readFile(localPath);
      const ext = localPath.endsWith('.flac') ? 'flac' : 'mpeg';
      return new Response(buffer, { status: 200, headers: { 'Content-Type': `audio/${ext}` } });
    } catch (err) {
      console.error('Failed to read local audio file:', localPath, err);
      return new Response(null, { status: 404 });
    }
  }
  const url = `${ACESTEP_API}/v1/audio?path=${encodeURIComponent(audioPath)}`;
  return fetch(url);
}

export async function downloadAudioToBuffer(remoteUrl: string): Promise<{ buffer: Buffer; size: number }> {
  const response = await getAudioStream(remoteUrl);
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, size: buffer.length };
}

export function discoverEndpoints(): Promise<unknown> {
  return Promise.resolve({ provider: 'acestep-local', endpoint: ACESTEP_API });
}

export async function checkSpaceHealth(): Promise<boolean> {
  return isApiAvailable();
}

// ---------------------------------------------------------------------------
// Local AI helpers (backed by ACE-Step API — no external services)
// ---------------------------------------------------------------------------
async function localApiCall(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${ACESTEP_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json.detail || json.error || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  if (json.error) throw new Error(json.error);
  return json.data;
}

export async function localCreateSample(query: string, instrumental: boolean, vocalLanguage: string): Promise<Record<string, unknown>> {
  const data = await localApiCall('/v1/create_sample', { query, instrumental, vocal_language: vocalLanguage });
  return data || {};
}

export async function localFormatInput(params: {
  prompt: string; lyrics: string; bpm?: number; duration?: number; key_scale?: string; time_signature?: string;
}): Promise<Record<string, unknown>> {
  const paramObj: Record<string, unknown> = {};
  if (params.bpm && params.bpm > 0) paramObj.bpm = params.bpm;
  if (params.duration && params.duration > 0) paramObj.duration = params.duration;
  if (params.key_scale) paramObj.key = params.key_scale;
  if (params.time_signature) paramObj.time_signature = params.time_signature;
  const data = await localApiCall('/format_input', {
    prompt: params.prompt,
    lyrics: params.lyrics,
    param_obj: paramObj,
  });
  return data || {};
}

export async function localRandomSample(sampleType: string): Promise<Record<string, unknown>> {
  const data = await localApiCall('/create_random_sample', { sample_type: sampleType });
  return data || {};
}