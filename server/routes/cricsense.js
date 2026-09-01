const express = require('express');
const router = express.Router();
const {
  generateCricSenseResponse,
  retrieveVenueKnowledge,
  VENUE_KNOWLEDGE_STORE
} = require('../services/cricSenseRAG');

// POST /api/cricsense/ask - Primary RAG Endpoint
router.post('/ask', async (req, res) => {
  try {
    const { query, matchId, activeMatch } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query prompt is required' });
    }

    const response = await generateCricSenseResponse(query, matchId, activeMatch);
    res.json(response);
  } catch (error) {
    console.error('CricSense RAG execution error:', error);
    res.status(500).json({ error: 'CricSense AI could not process the query' });
  }
});

// GET /api/cricsense/venue/:venueName - Retrieve venue characteristics
router.get('/venue/:venueName', (req, res) => {
  try {
    const venue = retrieveVenueKnowledge(req.params.venueName);
    res.json({ venue });
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving venue knowledge' });
  }
});

// GET /api/cricsense/venues - List all indexed venues
router.get('/venues', (req, res) => {
  res.json({
    totalIndexed: Object.keys(VENUE_KNOWLEDGE_STORE).length,
    venues: Object.keys(VENUE_KNOWLEDGE_STORE)
  });
});

module.exports = router;
