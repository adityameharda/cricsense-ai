const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/match');
const cricketService = require('./services/cricketLiveService');

async function syncMatches() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kabaddi');
    console.log('✅ Connected to MongoDB.');

    // 1. Delete all fake/mock seeded matches or old non-numeric dummy matches
    await Match.deleteMany({
      $or: [
        { matchId: { $regex: /^(upcoming-|ipl_|dummy|test)/i } },
        { matchId: { $regex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i } }
      ]
    });
    console.log('🗑️ Removed all fake/mock seeded matches and obsolete records.');

    // 2. Fetch real matches from the authentic cricket service
    console.log('📡 Fetching genuine real-time cricket matches...');
    const realMatches = await cricketService.fetchAllRealMatches();
    console.log(`🏏 Found ${realMatches.length} genuine matches.`);

    let syncedCount = 0;
    for (const rm of realMatches) {
      // Upsert into Match collection
      await Match.findOneAndUpdate(
        { matchId: rm.matchId },
        {
          matchId: rm.matchId,
          teamA: rm.teamA,
          teamB: rm.teamB,
          teamALogo: rm.teamALogo,
          teamBLogo: rm.teamBLogo,
          scoreA: rm.scoreA,
          scoreB: rm.scoreB,
          status: rm.status,
          matchStarted: rm.matchStarted,
          matchEnded: rm.matchEnded,
          venue: rm.venue,
          date: rm.date,
          matchType: rm.matchType,
          squadFetched: false
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      syncedCount++;
    }

    console.log(`✅ Successfully synced ${syncedCount} real matches into MongoDB!`);
    
    // Print summary of synced matches
    const dbLive = await Match.find({ matchStarted: true, matchEnded: false });
    const dbUpcoming = await Match.find({ matchStarted: false, matchEnded: false });
    const dbCompleted = await Match.find({ matchEnded: true });
    console.log(`📊 DB State -> Live: ${dbLive.length}, Upcoming: ${dbUpcoming.length}, Completed: ${dbCompleted.length}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Sync error:', err.message);
    process.exit(1);
  }
}

syncMatches();
