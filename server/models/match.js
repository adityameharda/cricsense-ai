const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true },
  teamA: String,
  teamB: String,
  teamALogo: String,
  teamBLogo: String,
  scoreA: { type: String, default: '0/0 (0)' }, // Total Cricket runs/wickets for team A
  scoreB: { type: String, default: '0/0 (0)' }, // Total Cricket runs/wickets for team B
  status: String, // e.g., "Live", "Upcoming", "Final"
  matchStarted: { type: Boolean, default: false },
  matchEnded: { type: Boolean, default: false },
  venue: String,
  date: String,
  matchType: String,
  // This stores the players for the Fantasy Team Builder
  squadA: [String], 
  squadB: [String],
  squadFetched: { type: Boolean, default: false },
  // Live Detailed Stats
  striker: { type: String, default: '' },
  nonStriker: { type: String, default: '' },
  bowler: { type: String, default: '' },
  strikerRuns: { type: Number, default: 0 },
  strikerBalls: { type: Number, default: 0 },
  nonStrikerRuns: { type: Number, default: 0 },
  nonStrikerBalls: { type: Number, default: 0 },
  bowlerOvers: { type: Number, default: 0 },
  bowlerRuns: { type: Number, default: 0 },
  bowlerWickets: { type: Number, default: 0 }
});

module.exports = mongoose.model('Match', matchSchema);