const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  teamA: {
    type: String,
    required: true
  },
  teamB: {
    type: String,
    required: true
  },
  scoreA: {
    type: Number,
    default: 0
  },
  scoreB: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    default: 'Sama Indoor Complex, Vadodara'
  },
  date: {
    type: Date,
    required: true
  }
});

module.exports = mongoose.model('Match', matchSchema);