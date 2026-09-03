require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');

async function deleteDummyMatches() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Delete fake ipl matches (ipl_mi_kkr, ipl_srh_rcb, ipl_csk_rr, ipl_dc_gt, etc.)
    const result = await Match.deleteMany({
      $or: [
        { matchId: { $regex: /^ipl_/i } },
        { matchId: 'ipl_mi_kkr' },
        { teamA: 'Mumbai Indians', teamB: 'Kolkata Knight Riders' }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} fake match record(s) successfully.`);
  } catch (err) {
    console.error('❌ Error deleting match:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deleteDummyMatches();