const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  contestId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchId: { type: String, required: true },
  entryFee: { type: Number, default: 0 }, // Virtual coins
  maxParticipants: { type: Number, default: 20 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  prizePool: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Contest', contestSchema);