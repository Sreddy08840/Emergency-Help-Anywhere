import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = express.Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, description, lat, lng } = req.body;
    const result = await query(
      'INSERT INTO alerts (user_id, title, description, lat, lng) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, title, description, lat, lng, created_at',
      [req.user.id, title || 'Emergency', description || null, lat, lng]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const result = await query('SELECT id, user_id, title, description, lat, lng, created_at FROM alerts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});
