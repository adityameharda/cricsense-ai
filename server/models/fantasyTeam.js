const mongoose = require('mongoose');

const fantasyTeamSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Nickname or ID for the user
  matchId: { type: String, required: true },
  contestId: { type: String, default: "general" }, // "general" or a unique private contest ID
  players: [{ type: String }], 
  captain: String,
  viceCaptain: String,
  totalPoints: { type: Number, default: 0 }
}, { timestamps: true });

// Ensure a user can only create one team per match in a specific contest
fantasyTeamSchema.index({ userId: 1, matchId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model('FantasyTeam', fantasyTeamSchema);
