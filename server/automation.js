const cron = require('node-cron');
const Match = require('./models/match');
const FantasyTeam = require('./models/fantasyTeam');
const cricketService = require('./services/cricketLiveService');
const fantasyPointsService = require('./services/fantasyPointsService');
require('dotenv').config();

let io = null;
let isSyncing = false;

// Matches currently listed on Cricbuzz's live-scores page (refreshed every feed sync)
let feedMatchIds = new Set();

// Periodic authentic synchronization of the live-scores feed (every 25 seconds)
const syncLiveFeed = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const realMatches = await cricketService.fetchAllRealMatches();

    if (Array.isArray(realMatches) && realMatches.length > 0) {
      feedMatchIds = new Set(realMatches.map((rm) => rm.matchId));
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
        if (rm.startTime) liveUpdates.startTime = rm.startTime;

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

        const existing = await Match.findOne(query, '-squadA -squadB').lean();
        const changed = !existing || Object.keys(liveUpdates).some(
          (k) => String(existing[k] ?? '') !== String(liveUpdates[k] ?? '')
        );

        // Sync fantasy points only where someone actually has a fantasy team, and for
        // concluded matches only once (on the cycle where the match finishes).
        // The leaderboard page can still trigger a manual sync via /api/fantasy/sync-points.
        const isLive = rm.matchStarted && !rm.matchEnded;
        const justEnded = rm.matchEnded && existing && !existing.matchEnded;
        if (isLive || justEnded) {
          try {
            if (await FantasyTeam.exists({ matchId: rm.matchId })) {
              await fantasyPointsService.syncMatchPointsThrottled(rm.matchId, io);
            }
          } catch (ptsErr) {
            console.warn(`Point sync warning for ${rm.matchId}:`, ptsErr.message);
          }
        }

        // Nothing changed since the last cycle: skip the write and the broadcast.
        if (!changed) continue;

        const updatedMatch = await Match.findOneAndUpdate(
          query,
          { $set: liveUpdates },
          {
            upsert: true,
            returnDocument: 'after',
            setDefaultsOnInsert: true,
            projection: '-squadA -squadB -__v',
          }
        ).lean();

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
};

const emitMatch = (match) => {
  if (!io || !match) return;
  io.to('live_matches').emit('match_update', match);
  io.to(`match_${match.matchId}`).emit('match_update', match);
};

// ── Stale match reconciler ─────────────────────────────────────────
// Cricbuzz's live-scores page only lists recent matches. Once a match drops off it,
// the feed sync above never touches it again, so it could stay "live" or "upcoming"
// forever. This job checks such matches on their own Cricbuzz page and stores the
// real result.
const RECONCILE_BATCH = 8;
const RECHECK_AFTER_MS = 10 * 60 * 1000;
// If Cricbuzz has no page for a match this long after its start, stop showing it as live.
const GIVE_UP_AFTER_MS = 10 * 24 * 60 * 60 * 1000;
let isReconciling = false;

const reconcileStaleMatches = async () => {
  if (isReconciling || feedMatchIds.size === 0) return;
  isReconciling = true;
  try {
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];
    const candidates = await Match.find(
      {
        matchEnded: { $ne: true },
        matchId: { $nin: [...feedMatchIds] },
        $and: [
          { $or: [{ matchStarted: true }, { startTime: { $lt: now } }, { startTime: null, date: { $lt: today } }] },
          { $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: new Date(now - RECHECK_AFTER_MS) } }] },
        ],
      },
      '-squadA -squadB -__v'
    )
      .sort({ matchStarted: -1, lastCheckedAt: 1 })
      .limit(RECONCILE_BATCH)
      .lean();

    for (const m of candidates) {
      let update = null;
      try {
        update = await cricketService.fetchMatchState(m.matchId, m);
      } catch (e) {
        update = null;
      }

      const set = { lastCheckedAt: new Date() };
      if (update) {
        Object.assign(set, update);
      } else {
        const started = m.startTime || Date.parse(m.date);
        if (started && now - started > GIVE_UP_AFTER_MS) {
          set.matchStarted = true;
          set.matchEnded = true;
          set.status = 'Result not available';
        }
      }

      const changed = Object.keys(set).some(
        (k) => k !== 'lastCheckedAt' && String(m[k] ?? '') !== String(set[k] ?? '')
      );
      const updated = await Match.findOneAndUpdate(
        { matchId: m.matchId },
        { $set: set },
        { returnDocument: 'after', projection: '-squadA -squadB -__v' }
      ).lean();

      if (changed) {
        emitMatch(updated);
        // Final fantasy points once a match that had entries finishes
        if (set.matchEnded && !m.matchEnded && (await FantasyTeam.exists({ matchId: m.matchId }))) {
          fantasyPointsService.syncMatchPointsThrottled(m.matchId, io).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error('❌ Reconcile Error:', error.message);
  } finally {
    isReconciling = false;
  }
};

// Jobs start only when the server calls init(), so requiring this file is side-effect free.
let started = false;
const init = (serverIo) => {
  io = serverIo;
  if (started) return;
  started = true;
  cron.schedule('*/25 * * * * *', syncLiveFeed);
  cron.schedule('40 * * * * *', reconcileStaleMatches); // once a minute
};

module.exports = { init, syncLiveFeed, reconcileStaleMatches };