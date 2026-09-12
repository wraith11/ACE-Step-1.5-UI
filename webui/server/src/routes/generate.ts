import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { generateUUID } from '../db/sqlite.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import {
  generateMusicViaAPI, getJobStatus, getAudioStream, discoverEndpoints,
  checkSpaceHealth, cleanupJob, downloadAudioToBuffer,
  localCreateSample, localFormatInput, localRandomSample,
} from '../services/acestep.js';
import { getStorageProvider } from '../services/storage/factory.js';

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm'];
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm', '.opus'];
    const fileExt = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (allowedTypes.includes(file.mimetype) || (fileExt && allowedExtensions.includes(fileExt))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only common audio formats are allowed.'));
    }
  }
});

// ---- Upload reference audio ----
router.post('/upload-audio', authMiddleware, audioUpload.single('audio'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Audio file is required' });
      return;
    }
    const storage = getStorageProvider();
    const extFromName = path.extname(req.file.originalname || '').toLowerCase();
    const key = `references/${req.user!.id}/${Date.now()}-${generateUUID()}${extFromName || '.mp3'}`;
    const publicUrl = await storage.upload(key, req.file.buffer, req.file.mimetype);
    res.json({ url: publicUrl, key: storage.getPublicUrl(key) });
  } catch (error) {
    console.error('Upload reference audio error:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

// ---- Start generation ----
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params = req.body;
    if (!params.prompt && !params.style && !params.sourceAudioUrl) {
      res.status(400).json({ error: 'Caption/style, lyrics, or source audio required' });
      return;
    }

    const localJobId = generateUUID();
    await pool.query(
      `INSERT INTO generation_jobs (id, user_id, status, params, created_at, updated_at)
       VALUES (?, ?, 'queued', ?, datetime('now'), datetime('now'))`,
      [localJobId, req.user!.id, JSON.stringify(params)]
    );

    const { jobId: apiJobId } = await generateMusicViaAPI(params);

    await pool.query(
      `UPDATE generation_jobs SET acestep_task_id = ?, status = 'running', updated_at = datetime('now') WHERE id = ?`,
      [apiJobId, localJobId]
    );

    res.json({ jobId: localJobId, status: 'queued', queuePosition: 1 });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: (error as Error).message || 'Generation failed' });
  }
});

// ---- Job status ----
router.get('/status/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobResult = await pool.query(
      `SELECT id, user_id, acestep_task_id, status, params, result, error FROM generation_jobs WHERE id = ?`,
      [req.params.jobId]
    );
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const job = jobResult.rows[0];
    if (job.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (['pending', 'queued', 'running'].includes(job.status) && job.acestep_task_id) {
      try {
        const aceStatus = await getJobStatus(job.acestep_task_id);

        if (aceStatus.status !== job.status) {
          let updateQuery = `UPDATE generation_jobs SET status = ?, updated_at = datetime('now')`;
          const updateParams: unknown[] = [aceStatus.status];

          if (aceStatus.status === 'succeeded' && aceStatus.result) {
            updateQuery += `, result = ?`;
            updateParams.push(JSON.stringify(aceStatus.result));
          } else if (aceStatus.status === 'failed' && aceStatus.error) {
            updateQuery += `, error = ?`;
            updateParams.push(aceStatus.error);
          }
          updateQuery += ` WHERE id = ?`;
          updateParams.push(req.params.jobId);
          await pool.query(updateQuery, updateParams);

          if (aceStatus.status === 'succeeded' && aceStatus.result) {
            const params = typeof job.params === 'string' ? JSON.parse(job.params) : job.params;
            const audioUrls = aceStatus.result.audioUrls.filter((url: string) =>
              url.endsWith('.mp3') || url.endsWith('.flac') || url.endsWith('.opus') || url.endsWith('.wav')
            );
            const localPaths: string[] = [];
            const storage = getStorageProvider();

            for (let i = 0; i < audioUrls.length; i++) {
              const audioUrl = audioUrls[i];
              const variationSuffix = audioUrls.length > 1 ? ` (v${i + 1})` : '';
              const songTitle = (params.title || 'Untitled') + variationSuffix;
              const songId = generateUUID();

              try {
                const { buffer } = await downloadAudioToBuffer(audioUrl);
                const ext = audioUrl.includes('.flac') ? '.flac' : (audioUrl.includes('.opus') ? '.opus' : (audioUrl.includes('.wav') ? '.wav' : '.mp3'));
                const storageKey = `${req.user!.id}/${songId}${ext}`;
                const storedPath = await storage.upload(storageKey, buffer, `audio/${ext.slice(1)}`);

                await pool.query(
                  `INSERT INTO songs (id, user_id, title, lyrics, style, caption, audio_url, duration, bpm, key_scale, time_signature, tags, is_public, generation_params, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
                  [
                    songId, req.user!.id, songTitle,
                    params.instrumental ? '[Instrumental]' : (params.lyrics || ''),
                    params.style || params.prompt || '',
                    params.style || params.prompt || '',
                    storedPath,
                    aceStatus.result.duration && aceStatus.result.duration > 0 ? aceStatus.result.duration : (params.duration && params.duration > 0 ? params.duration : 60),
                    aceStatus.result.bpm || params.bpm,
                    aceStatus.result.keyScale || params.keyScale,
                    aceStatus.result.timeSignature || params.timeSignature,
                    JSON.stringify([]),
                    JSON.stringify(params),
                  ]
                );
                localPaths.push(storedPath);
              } catch (downloadError) {
                console.error(`Failed to download audio ${i + 1}:`, downloadError);
                await pool.query(
                  `INSERT INTO songs (id, user_id, title, lyrics, style, caption, audio_url, duration, bpm, key_scale, time_signature, tags, is_public, generation_params, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
                  [
                    songId, req.user!.id, songTitle,
                    params.instrumental ? '[Instrumental]' : (params.lyrics || ''),
                    params.style || params.prompt || '',
                    params.style || params.prompt || '',
                    audioUrl,
                    aceStatus.result.duration && aceStatus.result.duration > 0 ? aceStatus.result.duration : (params.duration && params.duration > 0 ? params.duration : 60),
                    aceStatus.result.bpm || params.bpm,
                    aceStatus.result.keyScale || params.keyScale,
                    aceStatus.result.timeSignature || params.timeSignature,
                    JSON.stringify([]),
                    JSON.stringify(params),
                  ]
                );
                localPaths.push(audioUrl);
              }
            }
            aceStatus.result.audioUrls = localPaths;
            cleanupJob(job.acestep_task_id);
          }
        }

        res.json({
          jobId: req.params.jobId,
          status: aceStatus.status,
          queuePosition: aceStatus.queuePosition,
          etaSeconds: aceStatus.etaSeconds,
          result: aceStatus.result,
          error: aceStatus.error,
        });
        return;
      } catch (aceError) {
        console.error('ACE-Step status check error:', aceError);
      }
    }

    res.json({
      jobId: req.params.jobId,
      status: job.status,
      result: job.result && typeof job.result === 'string' ? JSON.parse(job.result) : job.result,
      error: job.error,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Audio proxy ----
router.get('/audio', async (req, res: Response) => {
  try {
    const audioPath = req.query.path as string;
    if (!audioPath) {
      res.status(400).json({ error: 'Path required' });
      return;
    }
    const audioResponse = await getAudioStream(audioPath);
    if (!audioResponse.ok) {
      res.status(audioResponse.status).json({ error: 'Failed to fetch audio' });
      return;
    }
    const contentType = audioResponse.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = audioResponse.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const reader = audioResponse.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: 'Failed to read audio stream' });
      return;
    }
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
      return pump();
    };
    await pump();
  } catch (error) {
    console.error('Audio proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- History ----
router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, acestep_task_id, status, params, result, error, created_at
       FROM generation_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    res.json({ jobs: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/endpoints', authMiddleware, async (_req, res: Response) => {
  try {
    const endpoints = await discoverEndpoints();
    res.json({ endpoints });
  } catch (error) {
    res.status(500).json({ error: 'Failed to discover endpoints' });
  }
});

router.get('/health', async (_req, res: Response) => {
  try {
    const healthy = await checkSpaceHealth();
    res.json({ healthy });
  } catch (error) {
    res.json({ healthy: false, error: (error as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Local AI endpoints (replace Gemini — 100% local via ACE-Step API)
// ---------------------------------------------------------------------------
router.post('/local/sample', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, instrumental, vocal_language } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const data = await localCreateSample(query, !!instrumental, vocal_language || 'unknown');
    res.json({ data, code: 200, error: null });
  } catch (error) {
    console.error('Local sample error:', error);
    res.status(500).json({ error: (error as Error).message || 'Local AI sample failed' });
  }
});

router.post('/local/format', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, lyrics, bpm, duration, key_scale, time_signature } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    const data = await localFormatInput({ prompt, lyrics: lyrics || '', bpm, duration, key_scale, time_signature });
    res.json({ data, code: 200, error: null });
  } catch (error) {
    console.error('Local format error:', error);
    res.status(500).json({ error: (error as Error).message || 'Local AI format failed' });
  }
});

router.post('/local/random', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sample_type } = req.body;
    const data = await localRandomSample(sample_type || 'simple_mode');
    res.json({ data, code: 200, error: null });
  } catch (error) {
    console.error('Local random error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to load random sample' });
  }
});

export default router;