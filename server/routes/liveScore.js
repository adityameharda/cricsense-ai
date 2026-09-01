const express = require('express');
const cricketService = require('../services/cricketLiveService');

const router = express.Router();

// Route to get authentic live match data
router.get('/live-score', async (req, res) => {
  try {
    const matches = await cricketService.fetchAllRealMatches();
    res.json({
      status: 'success',
      data: matches
    });
  } catch (error) {
    console.error('Error fetching live score:', error.message);
    res.status(500).json({ status: 'failure', message: 'Live data temporarily unavailable' });
  }
});

module.exports = router;