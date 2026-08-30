const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchId: { type: String, required: true },
  contestId: { type: String, default: 'general' },
  predictions: {
    totalRuns: { type: Number, min: 0 },
    topScorer: String,
    totalWickets: { type: Number, min: 0 }
  },
  actualResults: {
    totalRuns: { type: Number, default: 0 },
    topScorer: String,
    totalWickets: { type: Number, default: 0 }
  },
  points: { type: Number, default: 0 },
  isCalculated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Ensure one prediction per user per match per contest
predictionSchema.index({ userId: 1, matchId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);