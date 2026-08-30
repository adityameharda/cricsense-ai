require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');

async function deleteDummyMatch() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kabaddi');
    console.log('Connected to MongoDB');

    const result = await Match.deleteOne({ matchId: 'ipl_mi_kkr' });

    if (result.deletedCount > 0) {
      console.log('✅ Deleted the fake ipl_mi_kkr match successfully.');
    } else {
      console.log('ℹ️ No matching record found — it may already be deleted.');
    }
  } catch (err) {
    console.error('❌ Error deleting match:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deleteDummyMatch();