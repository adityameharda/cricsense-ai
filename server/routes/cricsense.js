const express = require('express');
const router = express.Router();
const { generateCricSenseResponse } = require('../services/cricSenseRAG');

const cleanId = (v) => (typeof v === 'string' || typeof v === 'number') && /^\d{1,12}$/.test(String(v)) ? String(v) : undefined;

// Last few turns of the chat, trimmed, so follow-ups ("what about him?") have context
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string' && h.text.trim())
    .slice(-8)
    .map((h) => ({ role: h.role, text: h.text.trim().slice(0, 1500) }));
}

/**
 * POST /api/cricsense/ask
 * body: {
 *   query: string,
 *   matchId?: string,              match page the user is on
 *   context?: { matchId, playerId } what the previous answer was about
 *   history?: [{ role: 'user'|'assistant', text }]
 * }
 */
router.post('/ask', async (req, res) => {
  try {
    const { query, matchId, context = {}, history } = req.body || {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query prompt is required' });
    }
    if (query.length > 500) {
      return res.status(400).json({ error: 'Please keep questions under 500 characters.' });
    }

    const response = await generateCricSenseResponse({
      query,
      pageMatchId: cleanId(matchId),
      lastMatchId: cleanId(context?.matchId),
      lastPlayerId: cleanId(context?.playerId),
      history: cleanHistory(history),
    });
    res.json(response);
  } catch (error) {
    console.error('CricSense error:', error);
    res.status(500).json({ error: 'CricSense could not process the query' });
  }
});

module.exports = router;
