const express = require('express');
const Match = require('../models/Match');

const router = express.Router();

// GET endpoint to fetch live match data
router.get('/matches', async (req, res) => {
  try {
    const matches = await Match.find(); // Fetch all matches from MongoDB
    res.json(matches);
  } catch (error) {
    console.error('❌ Error fetching matches:', error.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET endpoint to fetch a single match by matchId or MongoDB _id
router.get('/matches/:matchId', async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const match = await Match.findOne({
      $or: [
        { matchId: matchId },
        { _id: matchId }
      ]
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(match);
  } catch (error) {
    console.error('❌ Error fetching match:', error.message);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

module.exports = router;