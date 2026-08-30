const mongoose = require('mongoose');

const matchPointSchema = new mongoose.Schema({
  matchId: { type: String, required: true }, // Linked to matchId in match.js
  playerName: { type: String, required: true },
  points: { type: Number, default: 0 },
  stats: {
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    catches: { type: Number, default: 0 }
  }
}, { timestamps: true });

// One record per player per match
matchPointSchema.index({ matchId: 1, playerName: 1 }, { unique: true });

module.exports = mongoose.model('MatchPoint', matchPointSchema);
