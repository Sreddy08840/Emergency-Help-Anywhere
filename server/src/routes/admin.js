import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = express.Router();

// Simple check to ensure only admin users can access these routes.
function ensureAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// GET /api/admin/sos
// Returns all SOS requests with basic details and response times.
router.get('/sos', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const result = await query(
      `SELECT s.id, s.type, s.status, s.latitude, s.longitude,
              s.created_at, s.assigned_at,
              EXTRACT(EPOCH FROM (s.assigned_at - s.created_at)) AS response_seconds,
              u.id AS user_id, u.name AS user_name, u.phone AS user_phone,
              h.id AS helper_id, hu.name AS helper_name
         FROM sos_requests s
         JOIN users u ON u.id = s.user_id
    LEFT JOIN helpers h ON h.id = s.helper_id
    LEFT JOIN users hu ON hu.id = h.user_id
        ORDER BY s.created_at DESC`
    );

    res.json({ sos: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/helpers
// Lists all helper profiles with their current status. Admins can see
// which helpers are blocked and whether they are available.
router.get('/helpers', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const result = await query(
      `SELECT h.id, h.user_id, h.role, h.lat, h.lng, h.available, h.blocked,
              u.name, u.email, u.phone
         FROM helpers h
         JOIN users u ON u.id = h.user_id
        ORDER BY h.id ASC`
    );

    res.json({ helpers: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/helpers/:id/block
router.post('/helpers/:id/block', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid helper id' });

    const result = await query(
      'UPDATE helpers SET blocked = true, available = false WHERE id = $1 RETURNING id, user_id, role, lat, lng, available, blocked',
      [id]
    );
    const helper = result.rows[0];
    if (!helper) return res.status(404).json({ error: 'Helper not found' });
    res.json({ success: true, helper });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/helpers/:id/unblock
router.post('/helpers/:id/unblock', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid helper id' });

    const result = await query(
      'UPDATE helpers SET blocked = false WHERE id = $1 RETURNING id, user_id, role, lat, lng, available, blocked',
      [id]
    );
    const helper = result.rows[0];
    if (!helper) return res.status(404).json({ error: 'Helper not found' });
    res.json({ success: true, helper });
  } catch (err) {
    next(err);
  }
});
