const express = require('express');
const Prediction = require('../models/prediction');
const Match = require('../models/match');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Submit predictions
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { matchId, contestId = 'general', predictions } = req.body;

    if (!matchId || !predictions) {
      return res.status(400).json({ error: 'Match ID and predictions are required' });
    }

    const { totalRuns, topScorer, totalWickets } = predictions;

    if (totalRuns === undefined || !topScorer || totalWickets === undefined) {
      return res.status(400).json({ error: 'All prediction fields are required' });
    }

    // Check if match exists
    const match = await Match.findOne({ matchId });
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check if predictions are still allowed (before match starts)
    if (match.status && match.status.toLowerCase().includes('live')) {
      return res.status(400).json({ error: 'Cannot submit predictions for live matches' });
    }

    const prediction = await Prediction.findOneAndUpdate(
      { userId: req.user._id, matchId, contestId },
      {
        predictions: { totalRuns, topScorer, totalWickets }
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Predictions submitted successfully',
      prediction
    });
  } catch (error) {
    console.error('Prediction submission error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's predictions for a match
router.get('/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;

    const prediction = await Prediction.findOne({
      userId: req.user._id,
      matchId,
      contestId
    });

    res.json({ prediction });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all predictions for a match (admin/debug)
router.get('/match/:matchId/all', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;

    const predictions = await Prediction.find({ matchId, contestId })
      .populate('userId', 'username');

    res.json({ predictions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Calculate prediction points (called after match ends)
router.post('/calculate/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general', actualResults } = req.body;

    if (!actualResults) {
      return res.status(400).json({ error: 'Actual results are required' });
    }

    const { totalRuns, topScorer, totalWickets } = actualResults;

    // Update all predictions for this match
    const predictions = await Prediction.find({ matchId, contestId, isCalculated: false });

    for (const prediction of predictions) {
      let points = 0;

      // Calculate points
      if (prediction.predictions.totalRuns === totalRuns) points += 10;
      if (prediction.predictions.topScorer === topScorer) points += 15;
      if (prediction.predictions.totalWickets === totalWickets) points += 10;

      // Bonus for all correct
      if (points === 35) points += 10;

      prediction.actualResults = { totalRuns, topScorer, totalWickets };
      prediction.points = points;
      prediction.isCalculated = true;
      await prediction.save();
    }

    res.json({
      message: 'Prediction points calculated',
      processed: predictions.length
    });
  } catch (error) {
    console.error('Prediction calculation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;