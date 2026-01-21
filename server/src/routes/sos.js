import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = express.Router();

const ALLOWED_TYPES = ['Medical', 'Vehicle Breakdown', 'Accident', 'Police'];

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, latitude, longitude } = req.body;
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid emergency type' });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Location is required' });
    }
    const result = await query(
      'INSERT INTO sos_requests (user_id, type, latitude, longitude, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, type, latitude, longitude, status, created_at',
      [req.user.id, type, latitude, longitude, 'open']
    );
    res.status(201).json({ success: true, sos: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
