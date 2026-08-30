const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

router.get('/matches', async (req, res) => {
  try {
    const matches = await Match.find({});
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching matches', error: error.message });
  }
});

module.exports = router;