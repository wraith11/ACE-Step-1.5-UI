import { Router, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Get my songs
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ songs: result.rows });
  } catch (error) {
    console.error('Get my songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single song
router.get('/:id', async (req, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Song not found' });
      return;
    }
    res.json({ song: result.rows[0] });
  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create song (manual entries; generation route also creates songs)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, lyrics, style, audio_url } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO songs (user_id, title, lyrics, style, audio_url, is_public)
       VALUES (?, ?, ?, ?, ?, 1)
       RETURNING *`,
      [req.user!.id, title, lyrics || '', style || '', audio_url || '']
    );
    res.status(201).json({ song: result.rows[0] });
  } catch (error) {
    console.error('Create song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update song
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allowed = ['title', 'lyrics', 'style', 'caption', 'audio_url', 'cover_url', 'is_public', 'tags', 'duration', 'bpm', 'key_scale', 'time_signature'];
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    updates.push(`updated_at = datetime('now')`);
    values.push(req.params.id);
    await pool.query(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
    const result = await pool.query('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    res.json({ song: result.rows[0] });
  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete song
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM songs WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle like
router.post('/:id/like', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const song = await client.query('SELECT * FROM songs WHERE id = ?', [req.params.id]);
    if (song.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Song not found' });
      return;
    }
    const existing = await client.query(
      'SELECT * FROM liked_songs WHERE user_id = ? AND song_id = ?',
      [req.user!.id, req.params.id]
    );
    let liked: boolean;
    if (existing.rows.length > 0) {
      await client.query('DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?', [req.user!.id, req.params.id]);
      await client.query('UPDATE songs SET like_count = MAX(0, like_count - 1) WHERE id = ?', [req.params.id]);
      liked = false;
    } else {
      await client.query('INSERT INTO liked_songs (user_id, song_id) VALUES (?, ?)', [req.user!.id, req.params.id]);
      await client.query('UPDATE songs SET like_count = like_count + 1 WHERE id = ?', [req.params.id]);
      liked = true;
    }
    await client.query('COMMIT');
    res.json({ liked });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Liked songs list
router.get('/liked/list', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.* FROM songs s
       JOIN liked_songs l ON s.id = l.song_id
       WHERE l.user_id = ?
       ORDER BY l.liked_at DESC`,
      [req.user!.id]
    );
    res.json({ songs: result.rows });
  } catch (error) {
    console.error('Get liked songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track play
router.post('/:id/play', async (req, res: Response) => {
  try {
    await pool.query('UPDATE songs SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ viewCount: 1 });
  } catch (error) {
    console.error('Track play error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;