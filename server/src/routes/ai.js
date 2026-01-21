import express from 'express';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth.js';

export const router = express.Router();

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = apiKey ? new OpenAI({ apiKey }) : null;

// POST /api/ai/classify
//
// Minimal AI-based emergency classification. The input is a free-text
// description (for example, transcribed from the user's voice). The
// output is a predicted emergency type such as Medical, Vehicle
// Breakdown, Accident, Police, or Other.
router.post('/classify', requireAuth, async (req, res, next) => {
  try {
    if (!client) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
    }

    const { description } = req.body || {};
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'description (text) is required' });
    }

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an emergency triage assistant. Classify the user description into one of: Medical, Vehicle Breakdown, Accident, Police, Other. Respond ONLY with strict JSON: {"type":"Medical|Vehicle Breakdown|Accident|Police|Other","reason":"short explanation"}.',
        },
        { role: 'user', content: description },
      ],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If parsing fails, fall back to a simple object with raw text.
      parsed = { type: 'Other', reason: 'Could not parse model output', raw: text };
    }

    res.json({
      type: parsed.type || 'Other',
      reason: parsed.reason || 'No explanation provided',
      raw: parsed.raw,
    });
  } catch (err) {
    next(err);
  }
});
