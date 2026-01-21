import express from 'express';
import twilio from 'twilio';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = express.Router();

// Create a Twilio client using credentials from environment variables.
// If these are not set, the routes will respond with a clear error.
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

// Helper to build a human-friendly Google Maps link from coordinates.
function buildMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Load a single SOS request together with the user who created it.
async function getSosWithUser(sosId) {
  const result = await query(
    `SELECT s.id, s.type, s.latitude, s.longitude, s.status,
            u.id as user_id, u.name as user_name, u.phone as user_phone
       FROM sos_requests s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [sosId]
  );
  return result.rows[0] || null;
}

// POST /api/fallback/sms
//
// Sends an emergency SMS using Twilio. The message includes:
// - SOS type
// - User name and phone (if available)
// - A clickable Google Maps link with the SOS location.
//
// Body: { sosId: number, to?: string }
// - If "to" is omitted, EMERGENCY_FALLBACK_TO_NUMBER is used.
router.post('/sms', requireAuth, async (req, res, next) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      return res.status(500).json({ error: 'Twilio is not configured on the server' });
    }

    const { sosId, to } = req.body || {};
    const sosIdNum = parseInt(sosId, 10);
    if (!sosIdNum) {
      return res.status(400).json({ error: 'sosId is required' });
    }

    const destination = to || process.env.EMERGENCY_FALLBACK_TO_NUMBER;
    if (!destination) {
      return res.status(400).json({ error: 'No destination number configured for fallback SMS' });
    }

    const sos = await getSosWithUser(sosIdNum);
    if (!sos) {
      return res.status(404).json({ error: 'SOS not found' });
    }

    const mapLink = buildMapsLink(sos.latitude, sos.longitude);
    const bodyLines = [
      'Emergency Help Anywhere - SOS',
      `Type: ${sos.type}`,
      sos.user_name ? `User: ${sos.user_name}` : 'User: (unknown)',
      sos.user_phone ? `Phone: ${sos.user_phone}` : 'Phone: (unknown)',
      `Location: ${mapLink}`,
    ];

    const message = bodyLines.join('\n');

    const result = await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to: destination,
      body: message,
    });

    res.json({ success: true, sid: result.sid });
  } catch (err) {
    next(err);
  }
});

// POST /api/fallback/call
//
// Triggers a simple voice call via Twilio. The call will speak out a
// short message with the SOS type and user name. This is a minimal
// example that can be expanded to route calls to different numbers or
// IVR flows.
//
// Body: { sosId: number, to?: string }
// - If "to" is omitted, EMERGENCY_FALLBACK_TO_NUMBER is used.
router.post('/call', requireAuth, async (req, res, next) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      return res.status(500).json({ error: 'Twilio is not configured on the server' });
    }

    const { sosId, to } = req.body || {};
    const sosIdNum = parseInt(sosId, 10);
    if (!sosIdNum) {
      return res.status(400).json({ error: 'sosId is required' });
    }

    const destination = to || process.env.EMERGENCY_FALLBACK_TO_NUMBER;
    if (!destination) {
      return res.status(400).json({ error: 'No destination number configured for fallback calls' });
    }

    const sos = await getSosWithUser(sosIdNum);
    if (!sos) {
      return res.status(404).json({ error: 'SOS not found' });
    }

    const userName = sos.user_name || 'Unknown user';
    const type = sos.type || 'Emergency';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Emergency Help Anywhere alert. ${type} reported by ${userName}. Check your dashboard or messages for location details.</Say>
</Response>`;

    const call = await client.calls.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to: destination,
      twiml,
    });

    res.json({ success: true, sid: call.sid });
  } catch (err) {
    next(err);
  }
});
