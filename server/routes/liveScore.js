const express = require('express');
const axios = require('axios');

const router = express.Router();

const CRICAPI_KEY = process.env.CRICAPI_KEY;
const CRICAPI_URL = 'https://api.cricapi.com/v1/currentMatches';

let cachedData = null;
let lastFetchTime = 0;

// Fetch live match data every 90 seconds (not 5 — free CricAPI plan only allows 100 hits/day)
const fetchLiveData = async () => {
  try {
    const now = Date.now();
    if (now - lastFetchTime > 90000) {
      const response = await axios.get(CRICAPI_URL, {
        params: { apikey: CRICAPI_KEY },
      });
      cachedData = response.data;
      lastFetchTime = now;
    }
  } catch (error) {
    console.error('Error fetching live data:', error.message);
  }
};

// Start fetching data in the background
setInterval(fetchLiveData, 90000);

// Route to get cached live data
router.get('/live-score', (req, res) => {
  if (cachedData) {
    res.json(cachedData);
  } else {
    res.status(503).json({ message: 'Live data not available yet' });
  }
});

module.exports = router;