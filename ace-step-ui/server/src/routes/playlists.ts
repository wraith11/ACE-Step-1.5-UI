import { Router, Response } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count
       FROM playlists p WHERE p.user_id = ? ORDER BY p.created_at DESC`,
      [req.user!.id]
    );
    res.json({ playlists: result.rows });
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name required' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO playlists (user_id, name, description, is_public) VALUES (?, ?, ?, ?) RETURNING *',
      [req.user!.id, name, description || '', isPublic !== false ? 1 : 0]
    );
    res.status(201).json({ playlist: result.rows[0] });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res: Response) => {
  try {
    const playlist = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (playlist.rows.length === 0) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }
    const songs = await pool.query(
      `SELECT s.* FROM songs s
       JOIN playlist_songs ps ON s.id = ps.song_id
       WHERE ps.playlist_id = ?
       ORDER BY ps.position ASC`,
      [req.params.id]
    );
    res.json({ playlist: playlist.rows[0], songs: songs.rows });
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/songs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { songId } = req.body;
    if (!songId) {
      res.status(400).json({ error: 'songId required' });
      return;
    }
    await pool.query(
      'INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_songs WHERE playlist_id = ?))',
      [req.params.id, songId, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Add song to playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/songs/:songId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [req.params.id, req.params.songId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove song from playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, isPublic } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (isPublic !== undefined) { updates.push('is_public = ?'); values.push(isPublic ? 1 : 0); }
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    updates.push(`updated_at = datetime('now')`);
    values.push(req.params.id);
    await pool.query(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;