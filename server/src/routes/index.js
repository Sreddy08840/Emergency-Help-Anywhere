import express from 'express';
import { router as auth } from './auth.js';
import { router as alerts } from './alerts.js';
import { router as sos } from './sos.js';
import { router as helpers } from './helpers.js';
import { router as fallback } from './fallback.js';
import { router as admin } from './admin.js';
import { router as ai } from './ai.js';

export const router = express.Router();

router.use('/auth', auth);
router.use('/alerts', alerts);
router.use('/sos', sos);
router.use('/helpers', helpers);
router.use('/fallback', fallback);
router.use('/admin', admin);
router.use('/ai', ai);
