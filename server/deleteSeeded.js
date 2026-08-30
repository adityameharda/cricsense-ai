require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');

async function deleteSeededMatches() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kabaddi');
  console.log('Connected to MongoDB');

  // Delete all matches with short/fake matchIds (not real CricAPI UUIDs)
  const result = await Match.deleteMany({
    matchId: { $in: ['ipl_srh_rcb', 'ipl_mi_kkr', 'ipl_csk_rr', 'ipl_dc_gt'] }
  });

  console.log(`✅ Deleted ${result.deletedCount} seeded fake matches`);
  await mongoose.disconnect();
  process.exit(0);
}

deleteSeededMatches();