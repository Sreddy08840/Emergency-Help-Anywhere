import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { getIo } from '../realtime/io.js';

export const router = express.Router();

// Allowed helper roles. These describe what kind of help a person can provide.
// In a real app you might keep these in a config file or database table.
const ALLOWED_HELPER_ROLES = ['mechanic', 'ambulance', 'police', 'volunteer'];

// Helper function to load the helper row for the current user.
// We assume there is at most one helper profile per user.
async function getHelperForUser(userId) {
  const result = await query(
    'SELECT id, user_id, role, lat, lng, available FROM helpers WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

// Small utility to convert degrees to radians (needed for trigonometry below).
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Haversine formula: computes the great-circle distance between two
// latitude/longitude points on a sphere (in our case, the Earth).
//
// Steps (in simple terms):
// 1) Convert all lat/lng values from degrees to radians.
// 2) Compute the difference between the latitudes and longitudes.
// 3) Plug into the Haversine formula to get "a".
// 4) Use "a" to get the central angle "c".
// 5) Multiply by Earth's radius to get distance in kilometers.
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Final distance in kilometers
  return R * c;
}

// GET /api/helpers/nearest?sosId=123
//
// 1) Look up the SOS request to get its latitude/longitude.
// 2) Load all available helpers that have a stored location.
// 3) Use the Haversine formula to compute the distance from the SOS
//    location to each helper.
// 4) Filter helpers to only those within 10km.
// 5) Sort the remaining helpers by distance (closest first).
// 6) Return the list with distance included.
router.get('/nearest', requireAuth, async (req, res, next) => {
  try {
    const sosId = parseInt(req.query.sosId, 10);
    if (!sosId) {
      return res.status(400).json({ error: 'sosId query parameter is required' });
    }

    // 1) Get the SOS request location
    const sosResult = await query(
      'SELECT latitude, longitude FROM sos_requests WHERE id = $1',
      [sosId]
    );
    const sos = sosResult.rows[0];
    if (!sos) {
      return res.status(404).json({ error: 'SOS request not found' });
    }

    const sosLat = sos.latitude;
    const sosLng = sos.longitude;

    // 2) Load all helpers that are available and have a known location.
    //    We also ensure their role is one of the allowed helper roles.
    const helpersResult = await query(
      'SELECT id, user_id, role, lat, lng, available FROM helpers WHERE available = true AND lat IS NOT NULL AND lng IS NOT NULL'
    );

    // 3) Compute distance for each helper using Haversine formula.
    const MAX_DISTANCE_KM = 10; // search radius
    const helpersWithDistance = helpersResult.rows
      .filter((h) => ALLOWED_HELPER_ROLES.includes(h.role))
      .map((h) => {
        const distanceKm = haversineDistanceKm(sosLat, sosLng, h.lat, h.lng);
        return { ...h, distanceKm };
      })
      // 4) Keep only helpers within the maximum distance.
      .filter((h) => h.distanceKm <= MAX_DISTANCE_KM)
      // 5) Sort by distance ascending (nearest first).
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // 6) Return helpers sorted by distance.
    res.json({
      sosId,
      origin: { latitude: sosLat, longitude: sosLng },
      helpers: helpersWithDistance,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/helpers/requests
//
// Simple "inbox" of SOS requests for helpers:
// 1) Ensure the logged-in user has the "helper" role.
// 2) Find the helper profile that belongs to this user.
// 3) Load SOS requests that are still open (not assigned or closed).
// 4) Return them sorted by time so helpers can decide which to take.
router.get('/requests', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'helper') {
      return res.status(403).json({ error: 'Only helpers can view SOS requests' });
    }

    const helper = await getHelperForUser(req.user.id);
    if (!helper) {
      return res.status(404).json({ error: 'Helper profile not found for this user' });
    }

    const sosResult = await query(
      'SELECT id, user_id, type, latitude, longitude, status, helper_id, created_at FROM sos_requests WHERE status = $1 ORDER BY created_at ASC',
      ['open']
    );

    res.json({ requests: sosResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/helpers/requests/:id/accept
//
// When a helper accepts an SOS:
// 1) We make sure the user is a helper and has a helper profile.
// 2) We update the SOS row to set status = 'assigned' and store helper_id.
// 3) We only do this if the SOS is still "open" so two helpers do not
//    accept the same request at the same time.
// 4) After assigning, this is the place where you would trigger a
//    notification to the original user (e.g. using Firebase Cloud
//    Messaging or SMS).
router.post('/requests/:id/accept', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'helper') {
      return res.status(403).json({ error: 'Only helpers can accept SOS requests' });
    }

    const sosId = parseInt(req.params.id, 10);
    if (!sosId) {
      return res.status(400).json({ error: 'Invalid SOS id' });
    }

    const helper = await getHelperForUser(req.user.id);
    if (!helper) {
      return res.status(404).json({ error: 'Helper profile not found for this user' });
    }

    const updateResult = await query(
      'UPDATE sos_requests SET status = $1, helper_id = $2, assigned_at = NOW() WHERE id = $3 AND status = $4 RETURNING id, user_id, type, latitude, longitude, status, helper_id, assigned_at, created_at',
      ['assigned', helper.id, sosId, 'open']
    );

    const sos = updateResult.rows[0];
    if (!sos) {
      return res.status(409).json({ error: 'SOS is not available to assign (maybe already assigned or closed)' });
    }

    // At this point the SOS has been assigned to this helper.
    // In a real system, you would send a notification to the user
    // who created the SOS. For example:
    // - Look up the user by sos.user_id.
    // - Load the users FCM token from the database.
    // - Use the Firebase Admin SDK to send a push notification.
    console.log(`SOS ${sos.id} assigned to helper ${helper.id}; notify user ${sos.user_id}`);

    res.json({ success: true, sos });
  } catch (err) {
    next(err);
  }
});

// POST /api/helpers/requests/:id/reject
//
// In this simple implementation, rejecting an SOS marks it as
// "rejected" so it no longer appears in the open queue. In a more
// complete system you might track rejections per helper instead and
// keep the SOS open for other helpers.
router.post('/requests/:id/reject', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'helper') {
      return res.status(403).json({ error: 'Only helpers can reject SOS requests' });
    }

    const sosId = parseInt(req.params.id, 10);
    if (!sosId) {
      return res.status(400).json({ error: 'Invalid SOS id' });
    }

    const helper = await getHelperForUser(req.user.id);
    if (!helper) {
      return res.status(404).json({ error: 'Helper profile not found for this user' });
    }

    const updateResult = await query(
      'UPDATE sos_requests SET status = $1 WHERE id = $2 AND status = $3 RETURNING id, user_id, type, latitude, longitude, status, helper_id, created_at',
      ['rejected', sosId, 'open']
    );

    const sos = updateResult.rows[0];
    if (!sos) {
      return res.status(409).json({ error: 'SOS is not open or has already been handled' });
    }

    res.json({ success: true, sos });
  } catch (err) {
    next(err);
  }
});

// POST /api/helpers/requests/:id/close
//
// Marks an assigned SOS as "closed" / resolved. Only the helper
// currently assigned to the SOS can close it. When the SOS is closed,
// the server emits a Socket.IO event so any connected clients can
// stop live tracking and remove helper markers from the map.
router.post('/requests/:id/close', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'helper') {
      return res.status(403).json({ error: 'Only helpers can close SOS requests' });
    }

    const sosId = parseInt(req.params.id, 10);
    if (!sosId) {
      return res.status(400).json({ error: 'Invalid SOS id' });
    }

    const helper = await getHelperForUser(req.user.id);
    if (!helper) {
      return res.status(404).json({ error: 'Helper profile not found for this user' });
    }

    const updateResult = await query(
      'UPDATE sos_requests SET status = $1 WHERE id = $2 AND helper_id = $3 AND status = $4 RETURNING id, user_id, type, latitude, longitude, status, helper_id, created_at',
      ['closed', sosId, helper.id, 'assigned']
    );

    const sos = updateResult.rows[0];
    if (!sos) {
      return res.status(409).json({ error: 'SOS is not assigned to you or already closed' });
    }

    const io = getIo();
    if (io) {
      io.to(`sos:${sos.id}`).emit('sos:closed', { sosId: sos.id });
    }

    res.json({ success: true, sos });
  } catch (err) {
    next(err);
  }
});
