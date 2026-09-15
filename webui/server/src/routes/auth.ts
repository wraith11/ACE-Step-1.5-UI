import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { generateUUID } from '../db/sqlite.js';
import { config } from '../config/index.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

function signToken(user: { id: string; username: string; isAdmin?: boolean }): string {
  return jwt.sign(user, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });
}

// Auto-login for local single-user app
router.get('/auto', async (_req, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at ASC LIMIT 1');
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No user found' });
      return;
    }
    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username, isAdmin: !!user.is_admin });
    res.json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin, avatar_url: user.avatar_url }, token });
  } catch (error) {
    console.error('Auto-login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Setup first user
router.post('/setup', async (req, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      res.status(400).json({ error: 'Username required' });
      return;
    }
    const clean = username.trim().slice(0, 30);
    const existing = await pool.query('SELECT * FROM users LIMIT 1');
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const token = signToken({ id: user.id, username: user.username, isAdmin: !!user.is_admin });
      res.json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin, avatar_url: user.avatar_url }, token });
      return;
    }
    const userId = generateUUID();
    await pool.query(
      'INSERT INTO users (id, username) VALUES (?, ?)',
      [userId, clean]
    );
    const token = signToken({ id: userId, username: clean });
    res.json({ user: { id: userId, username: clean }, token });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    res.json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin, avatar_url: user.avatar_url } });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req, res: Response) => {
  res.json({ success: true });
});

router.post('/refresh', async (req, res: Response) => {
  try {
    const token = req.body.token;
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; username: string };
    const result = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    const newToken = signToken({ id: user.id, username: user.username, isAdmin: !!user.is_admin });
    res.json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin, avatar_url: user.avatar_url }, token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.patch('/username', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      res.status(400).json({ error: 'Username required' });
      return;
    }
    const clean = username.trim().slice(0, 30);
    await pool.query('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE id = ?', [clean, req.user!.id]);
    const token = signToken({ id: req.user!.id, username: clean });
    res.json({ user: { id: req.user!.id, username: clean }, token });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;