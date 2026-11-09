const express = require('express');
const router = express.Router();
const FantasyTeam = require('../models/fantasyTeam');
const MatchPoint = require('../models/matchPoint');
const Match = require('../models/match');
const User = require('../models/user');
const Contest = require('../models/contest');
const { requireAuth } = require('./auth');
const { requireAdmin } = require('../helpers/adminAuth');
const { checkMatchEntryEligibility } = require('../helpers/matchTiming');
const fantasyPointsService = require('../services/fantasyPointsService');

const playerName = (p) => (typeof p === 'object' && p ? p.name || '' : String(p || '')).trim();

// Handler for creating / updating a fantasy squad (strictly requires logged in user)
const handleFantasyTeamSubmission = async (req, res) => {
  try {
    const { matchId, players, captain, viceCaptain, contestId = 'general' } = req.body;
    const userId = req.user._id.toString();

    if (!matchId || !Array.isArray(players) || players.length !== 11) {
      return res.status(400).json({ error: 'Must provide matchId and exactly 11 players.' });
    }

    if (new Set(players.map((p) => String(p).trim().toLowerCase())).size !== 11) {
      return res.status(400).json({ error: 'Each of the 11 players must be different.' });
    }

    if (!captain || !viceCaptain) {
      return res.status(400).json({ error: 'Captain and Vice-Captain are required.' });
    }

    if (captain === viceCaptain) {
      return res.status(400).json({ error: 'Captain and Vice-Captain must be different players.' });
    }

    if (!players.includes(captain) || !players.includes(viceCaptain)) {
      return res.status(400).json({ error: 'Captain and Vice-Captain must be in your selected squad.' });
    }

    const match = await Match.findOne({
      $or: [{ matchId }, { _id: matchId.length === 24 ? matchId : null }]
    });

    if (!match) return res.status(404).json({ error: 'Match fixture not found.' });

    // Validate match timing (Rule: only before match start, locked 2 min before)
    const eligibility = checkMatchEntryEligibility(match);
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.error });
    }

    const matchIdentifier = match.matchId || match._id.toString();

    // Every picked player must belong to one of the two real squads
    const squadNames = new Set(
      [...(match.squadA || []), ...(match.squadB || [])].map((p) => playerName(p).toLowerCase())
    );
    if (squadNames.size > 0) {
      const unknown = players.filter((p) => !squadNames.has(String(p).trim().toLowerCase()));
      if (unknown.length > 0) {
        return res.status(400).json({
          error: `These players are not in either squad: ${unknown.join(', ')}. Please refresh the squads and pick again.`
        });
      }
    }

    // Validate contest if not general
    let finalContestId = (contestId || 'general').trim();
    if (finalContestId.toLowerCase() !== 'general') {
      finalContestId = finalContestId.toUpperCase();
      const contest = await Contest.findOne({ contestId: finalContestId });

      if (!contest) {
        return res.status(404).json({ error: `Contest room "${finalContestId}" not found. Please check the code.` });
      }
      if (!contest.isActive) {
        return res.status(400).json({ error: 'Not applicable now. Contest is no longer active.' });
      }
      if (contest.matchId !== matchIdentifier && contest.matchId !== matchId) {
        return res.status(400).json({ error: 'This contest code belongs to a different match fixture.' });
      }

      const isParticipant = contest.participants.some((p) => p.toString() === userId);
      if (!isParticipant) {
        if (contest.entryFee > 0) {
          return res.status(400).json({ error: 'Please join this contest first (it has an entry fee).' });
        }
        // Free contest: join now, atomically, so two people can't take the last seat
        const joined = await Contest.findOneAndUpdate(
          {
            _id: contest._id,
            participants: { $ne: req.user._id },
            $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
          },
          { $addToSet: { participants: req.user._id } },
          { returnDocument: 'after' }
        );
        if (!joined) {
          return res.status(400).json({ error: `Contest room is full (${contest.maxParticipants} players max).` });
        }
      }
    } else {
      finalContestId = 'general';
    }

    // One team per user, per match, per contest. A user can enter the public arena
    // and several private rooms for the same match with different teams.
    const team = await FantasyTeam.findOneAndUpdate(
      { userId, matchId: matchIdentifier, contestId: finalContestId },
      { $set: { players, captain, viceCaptain } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    res.json({
      message: 'Fantasy squad locked and registered successfully!',
      team,
      contestId: finalContestId,
      username: req.user.username
    });
  } catch (err) {
    console.error('Error saving fantasy team:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// ── POST /api/fantasy/team & POST /api/fantasy/create-team ──────────
router.post('/team', requireAuth, handleFantasyTeamSubmission);
router.post('/create-team', requireAuth, handleFantasyTeamSubmission);

// ── GET /api/fantasy/team/:matchId ──────────────────────────────────
router.get('/team/:matchId', requireAuth, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;
    const userId = req.user._id.toString();

    const cId = contestId && contestId !== 'general' ? contestId.toUpperCase() : 'general';
    const team = await FantasyTeam.findOne({ userId, matchId, contestId: cId });

    if (!team) return res.status(404).json({ error: 'No fantasy team found.' });

    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/fantasy/leaderboard/:matchId ───────────────────────────
router.get('/leaderboard/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;

    const match = await Match.findOne({
      $or: [{ matchId }, { _id: matchId.length === 24 ? matchId : null }]
    });

    const effectiveMatchId = match?.matchId || matchId;

    // Calculate & sync points from the real scorecard if started or finished
    // (throttled inside the service, so many viewers don't each trigger a recalculation)
    if (match && (match.matchStarted || match.matchEnded)) {
      try {
        await fantasyPointsService.syncMatchPointsThrottled(effectiveMatchId, req.app.get('io'));
      } catch (syncErr) {
        console.warn('Leaderboard auto-sync warning:', syncErr.message);
      }
    }

    // Each contest has its own leaderboard; "general" is the public arena only
    const query = {
      matchId: effectiveMatchId,
      contestId: contestId && contestId !== 'general' ? contestId.toUpperCase() : 'general',
    };

    const teams = await FantasyTeam.find(query)
      .sort({ totalPoints: -1 })
      .limit(100);

    // Fetch MatchPoints for this match to attach player breakdowns
    const matchPoints = await MatchPoint.find({ matchId: effectiveMatchId });
    const matchPointMap = new Map();
    matchPoints.forEach(mp => {
      matchPointMap.set(fantasyPointsService.cleanPlayerName(mp.playerName), mp);
    });

    // Populate user info (username, email) for every team
    const enrichedLeaderboard = await Promise.all(
      teams.map(async (t) => {
        let userObj = { _id: t.userId, username: 'Player' };

        try {
          if (t.userId && t.userId.length === 24) {
            const u = await User.findById(t.userId).select('username email virtualCoins');
            if (u && u.username) {
              userObj = { _id: u._id.toString(), username: u.username, email: u.email };
            }
          } else if (t.userId) {
            const u = await User.findOne({ username: t.userId }).select('username email');
            if (u && u.username) {
              userObj = { _id: u._id.toString(), username: u.username, email: u.email };
            } else {
              userObj = { _id: t.userId, username: t.userId };
            }
          }
        } catch (uErr) {
          // fallback
        }

        // Build player breakdown with points
        const playerBreakdown = (t.players || []).map(p => {
          const clean = fantasyPointsService.cleanPlayerName(p);
          let mpRecord = null;
          for (const [key, val] of matchPointMap.entries()) {
            if (fantasyPointsService.isSamePlayer(key, clean)) {
              mpRecord = val;
              break;
            }
          }

          const basePoints = mpRecord ? mpRecord.points : 0;
          const isC = fantasyPointsService.isSamePlayer(t.captain, clean);
          const isVC = fantasyPointsService.isSamePlayer(t.viceCaptain, clean);
          const multiplier = isC ? 2 : isVC ? 1.5 : 1;
          const finalPoints = Math.round(basePoints * multiplier * 10) / 10;

          return {
            name: p,
            basePoints,
            multiplier,
            finalPoints,
            isCaptain: isC,
            isViceCaptain: isVC,
            stats: mpRecord?.stats || null
          };
        });

        return {
          ...t.toObject(),
          user: userObj,
          userId: userObj,
          playerBreakdown
        };
      })
    );

    res.json(enrichedLeaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/fantasy/sync-points/:matchId (Explicit sync trigger) ────
router.post('/sync-points/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await fantasyPointsService.syncMatchPointsThrottled(matchId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/fantasy/update-score & POST /api/fantasy/:matchId/points
const handlePointsUpdate = async (req, res) => {
  try {
    const matchId = req.params.matchId || req.body.matchId;
    const { playerName, pointsToAdd } = req.body;

    if (!matchId || !playerName || pointsToAdd === undefined) {
      return res.status(400).json({ error: 'Missing matchId, playerName, or pointsToAdd' });
    }

    const cleanPlayer = playerName.trim().toLowerCase();

    // 1. Update MatchPoint ledger for this player in this match
    await MatchPoint.findOneAndUpdate(
      { matchId, playerName },
      { $inc: { points: pointsToAdd } },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Award points with Captain (2x) and Vice-Captain (1.5x) multipliers across fantasy teams
    const teams = await FantasyTeam.find({ matchId });

    for (const team of teams) {
      const hasPlayer = (team.players || []).some(p =>
        fantasyPointsService.isSamePlayer(p, cleanPlayer)
      );

      if (hasPlayer) {
        let multiplier = 1;
        if (team.captain && fantasyPointsService.isSamePlayer(team.captain, cleanPlayer)) {
          multiplier = 2;
        } else if (team.viceCaptain && fantasyPointsService.isSamePlayer(team.viceCaptain, cleanPlayer)) {
          multiplier = 1.5;
        }

        const delta = pointsToAdd * multiplier;
        team.totalPoints = Math.round(((team.totalPoints || 0) + delta) * 10) / 10;
        await team.save();
      }
    }

    res.json({ success: true, matchId, playerName, pointsAwarded: pointsToAdd });
  } catch (err) {
    console.error('Error awarding fantasy points:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// Manual point adjustments: admin only (points normally come from the real scorecard)
router.post('/update-score', requireAdmin, handlePointsUpdate);
router.post('/:matchId/points', requireAdmin, handlePointsUpdate);

module.exports = router;
