const cron = require('node-cron');
const axios = require('axios');
const Match = require('./models/match');
const cricketService = require('./services/cricketLiveService');
require('dotenv').config();

let io = null;
let isSyncing = false;

const init = (serverIo) => {
  io = serverIo;
};

const calculateAndDispatchPoints = async (matchId, playerName, diff, type) => {
  let pointsToAdd = 0;
  if (type === 'runs') {
    pointsToAdd = diff * 1; // 1 point per run
    if (diff === 4) pointsToAdd += 1;
    if (diff >= 6) pointsToAdd += 2;
  } else if (type === 'wickets') {
    pointsToAdd = diff * 20; // 20 points per wicket
  }

  if (pointsToAdd > 0) {
    try {
      const PORT = process.env.PORT || 5000;
      await axios.post(`http://localhost:${PORT}/api/fantasy/update-score`, {
        matchId,
        playerName,
        pointsToAdd
      });
      console.log(`🏆 Awarded ${pointsToAdd} points to ${playerName} for ${diff} ${type}`);
    } catch (err) {
      console.error('⚠️ Failed to update fantasy points', err.message);
    }
  }
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
        const oldMatch = await Match.findOne(query);

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

        // If match is live in progress, fetch detailed miniscore for live batter & bowler figures
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

        // Calculate fantasy point deltas
        if (oldMatch && updatedMatch) {
          if (oldMatch.striker === updatedMatch.striker && updatedMatch.strikerRuns > oldMatch.strikerRuns) {
            await calculateAndDispatchPoints(rm.matchId, updatedMatch.striker, updatedMatch.strikerRuns - oldMatch.strikerRuns, 'runs');
          }
          if (oldMatch.nonStriker === updatedMatch.nonStriker && updatedMatch.nonStrikerRuns > oldMatch.nonStrikerRuns) {
            await calculateAndDispatchPoints(rm.matchId, updatedMatch.nonStriker, updatedMatch.nonStrikerRuns - oldMatch.nonStrikerRuns, 'runs');
          }
          if (oldMatch.bowler === updatedMatch.bowler && updatedMatch.bowlerWickets > oldMatch.bowlerWickets) {
            await calculateAndDispatchPoints(rm.matchId, updatedMatch.bowler, updatedMatch.bowlerWickets - oldMatch.bowlerWickets, 'wickets');
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