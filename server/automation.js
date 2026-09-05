const cron = require('node-cron');
const Match = require('./models/match');
const FantasyTeam = require('./models/fantasyTeam');
const cricketService = require('./services/cricketLiveService');
const fantasyPointsService = require('./services/fantasyPointsService');
require('dotenv').config();

let io = null;
let isSyncing = false;

const init = (serverIo) => {
  io = serverIo;
};

// Periodic authentic synchronization (every 25 seconds)
cron.schedule('*/25 * * * * *', async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const realMatches = await cricketService.fetchAllRealMatches();

    if (Array.isArray(realMatches) && realMatches.length > 0) {
      for (const rm of realMatches) {
        const query = { matchId: rm.matchId };

        let liveUpdates = {
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
          matchType: rm.matchType
        };

        // If match is live in progress, fetch detailed miniscore for live figures
        if (rm.matchStarted && !rm.matchEnded) {
          try {
            const sc = await cricketService.fetchMatchScorecard(rm.matchId);
            if (sc && sc.miniscore) {
              const ms = sc.miniscore;
              const sName = typeof ms.striker === 'object' ? ms.striker?.name : ms.striker;
              const nsName = typeof ms.nonStriker === 'object' ? ms.nonStriker?.name : ms.nonStriker;
              const bName = typeof ms.bowler === 'object' ? ms.bowler?.name : ms.bowler;

              if (sName) liveUpdates.striker = sName;
              if (ms.striker?.runs !== undefined) liveUpdates.strikerRuns = ms.striker.runs;
              else if (ms.strikerRuns !== undefined) liveUpdates.strikerRuns = ms.strikerRuns;

              if (ms.striker?.balls !== undefined) liveUpdates.strikerBalls = ms.striker.balls;
              else if (ms.strikerBalls !== undefined) liveUpdates.strikerBalls = ms.strikerBalls;

              if (nsName) liveUpdates.nonStriker = nsName;
              if (ms.nonStriker?.runs !== undefined) liveUpdates.nonStrikerRuns = ms.nonStriker.runs;
              else if (ms.nonStrikerRuns !== undefined) liveUpdates.nonStrikerRuns = ms.nonStrikerRuns;

              if (ms.nonStriker?.balls !== undefined) liveUpdates.nonStrikerBalls = ms.nonStriker.balls;
              else if (ms.nonStrikerBalls !== undefined) liveUpdates.nonStrikerBalls = ms.nonStrikerBalls;

              if (bName) liveUpdates.bowler = bName;
              if (ms.bowler?.overs !== undefined) liveUpdates.bowlerOvers = ms.bowler.overs;
              else if (ms.bowlerOvers !== undefined) liveUpdates.bowlerOvers = ms.bowlerOvers;

              if (ms.bowler?.runs !== undefined) liveUpdates.bowlerRuns = ms.bowler.runs;
              else if (ms.bowlerRuns !== undefined) liveUpdates.bowlerRuns = ms.bowlerRuns;

              if (ms.bowler?.wickets !== undefined) liveUpdates.bowlerWickets = ms.bowler.wickets;
              else if (ms.bowlerWickets !== undefined) liveUpdates.bowlerWickets = ms.bowlerWickets;
            }
          } catch (e) {}
        }

        const updatedMatch = await Match.findOneAndUpdate(
          query,
          { $set: liveUpdates },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // Sync fantasy points from authentic scorecard for started or concluded matches
        if (rm.matchStarted || rm.matchEnded) {
          try {
            await fantasyPointsService.calculateAndSyncMatchPoints(rm.matchId, io);
          } catch (ptsErr) {
            console.warn(`Point sync warning for ${rm.matchId}:`, ptsErr.message);
          }
        }

        if (io && updatedMatch) {
          io.to('live_matches').emit('match_update', updatedMatch);
          io.to(`match_${rm.matchId}`).emit('match_update', updatedMatch);
        }
      }
    }
  } catch (error) {
    console.error('❌ Automation Error:', error.message);
  } finally {
    isSyncing = false;
  }
});

module.exports = { init };