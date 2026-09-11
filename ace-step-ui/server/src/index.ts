import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { config } from './config/index.js';
import authRoutes from './routes/auth.js';
import songsRoutes from './routes/songs.js';
import generateRoutes from './routes/generate.js';
import playlistsRoutes from './routes/playlists.js';
import referenceTrackRoutes from './routes/referenceTrack.js';
import { pool } from './db/pool.js';
import './db/migrate.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.nodeEnv === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
      const lanPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
      if (lanPattern.test(origin)) return callback(null, true);
    }
    if (origin === config.frontendUrl) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));

// Serve stored audio
app.use('/audio', express.static(path.join(__dirname, '../public/audio')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ACE-Step UI API' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/reference-tracks', referenceTrackRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Bind to 0.0.0.0 so the UI is reachable from any LAN device
app.listen(config.port, '0.0.0.0', () => {
  console.log(`ACE-Step UI Server running on http://localhost:${config.port}`);
  console.log(`ACE-Step API: ${config.acestep.apiUrl}`);
  import('os').then((os) => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`LAN access: http://${net.address}:${config.port}`);
        }
      }
    }
  });
});

// Clean shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await pool.end();
  process.exit(0);
});