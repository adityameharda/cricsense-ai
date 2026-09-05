const express = require('express');
const router = express.Router();
const FantasyTeam = require('../models/fantasyTeam');
const MatchPoint = require('../models/matchPoint');
const Match = require('../models/match');
const User = require('../models/user');
const Contest = require('../models/contest');
const { authenticateToken } = require('./auth');
const { checkMatchEntryEligibility } = require('../helpers/matchTiming');
const fantasyPointsService = require('../services/fantasyPointsService');

// Handler for creating / updating a fantasy squad (supports /team and /create-team)
const handleFantasyTeamSubmission = async (req, res) => {
  try {
    const { matchId, players, captain, viceCaptain, contestId = 'general' } = req.body;

    // Extract userId from JWT auth header or request body
    let userId = req.body.userId;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const uId = decoded?.userId || decoded?._id || decoded?.id;
        if (uId) userId = uId.toString();
      } catch (jwtErr) {
        // Fallback
      }
    }

    if (!userId) {
      let defaultUser = await User.findOne({ username: 'deepak_verma' });
      if (!defaultUser) {
        defaultUser = new User({
          username: 'deepak_verma',
          email: 'deepak_verma@cricscore.pro',
          password: 'password123',
          virtualCoins: 1000,
        });
        await defaultUser.save();
      }
      userId = defaultUser._id.toString();
    }

    if (!matchId || !players || players.length !== 11) {
      return res.status(400).json({ error: 'Must provide matchId and exactly 11 players.' });
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

    // Validate contest if not general
    let finalContestId = (contestId || 'general').trim();
    if (finalContestId.toLowerCase() !== 'general') {
      finalContestId = finalContestId.toUpperCase();
      let contest = await Contest.findOne({ contestId: finalContestId });

      if (!contest) {
        // Auto-create private contest room with this code
        contest = new Contest({
          contestId: finalContestId,
          name: `Private League (${finalContestId})`,
          createdBy: userId,
          matchId: matchIdentifier,
          entryFee: 0,
          maxParticipants: 20,
          participants: [userId]
        });
        await contest.save();
      } else {
        if (contest.matchId !== matchIdentifier && contest.matchId !== matchId) {
          return res.status(400).json({ error: 'This contest code belongs to a different match fixture.' });
        }

        // Count unique teams in this contest
        const existingTeamsCount = await FantasyTeam.countDocuments({ matchId: matchIdentifier, contestId: finalContestId });
        const userHasTeam = await FantasyTeam.findOne({ userId, matchId: matchIdentifier, contestId: finalContestId });

        if (!userHasTeam && existingTeamsCount >= contest.maxParticipants) {
          return res.status(400).json({
            error: `Contest room is full. Maximum ${contest.maxParticipants} participants allowed.`
          });
        }

        if (!contest.participants.some(p => p.toString() === userId.toString())) {
          contest.participants.push(userId);
          await contest.save();
        }
      }
    } else {
      finalContestId = 'general';
    }

    // Clean upsert by userId + matchId + contestId
    let team = await FantasyTeam.findOne({ userId, matchId: matchIdentifier, contestId: finalContestId });
    if (!team) {
      team = await FantasyTeam.findOne({ userId, matchId: matchIdentifier });
    }

    if (team) {
      team.contestId = finalContestId;
      team.players = players;
      team.captain = captain;
      team.viceCaptain = viceCaptain;
      await team.save();
    } else {
      team = new FantasyTeam({
        userId,
        matchId: matchIdentifier,
        contestId: finalContestId,
        players,
        captain,
        viceCaptain
      });
      await team.save();
    }

    res.json({
      message: 'Fantasy squad locked and registered successfully!',
      team,
      contestId: finalContestId
    });
  } catch (err) {
    console.error('Error saving fantasy team:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

// ── POST /api/fantasy/team & POST /api/fantasy/create-team ──────────
router.post('/team', handleFantasyTeamSubmission);
router.post('/create-team', handleFantasyTeamSubmission);

// ── GET /api/fantasy/team/:matchId ──────────────────────────────────
router.get('/team/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;
    const userId = req.user._id.toString();

    let query = { userId, matchId };
    if (contestId && contestId !== 'general') {
      query.contestId = contestId.toUpperCase();
    }

    let team = await FantasyTeam.findOne(query);
    if (!team) {
      team = await FantasyTeam.findOne({ userId, matchId });
    }

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

    // Automatically calculate & sync points from match scorecard if started or finished
    if (match && (match.matchStarted || match.matchEnded)) {
      try {
        await fantasyPointsService.calculateAndSyncMatchPoints(effectiveMatchId, req.app.get('io'));
      } catch (syncErr) {
        console.warn('Leaderboard auto-sync warning:', syncErr.message);
      }
    }

    const query = { matchId: effectiveMatchId };
    if (contestId && contestId !== 'general') {
      query.contestId = contestId.toUpperCase();
    }

    const teams = await FantasyTeam.find(query)
      .sort({ totalPoints: -1 })
      .limit(100);

    // Fetch MatchPoints for this match to attach player breakdowns
    const matchPoints = await MatchPoint.find({ matchId: effectiveMatchId });
    const matchPointMap = new Map();
    matchPoints.forEach(mp => {
      matchPointMap.set(fantasyPointsService.cleanPlayerName(mp.playerName), mp);
    });

    // Populate user info and breakdown for every team
    const enrichedLeaderboard = await Promise.all(
      teams.map(async (t) => {
        let userObj = { _id: t.userId, username: 'Player' };

        try {
          if (t.userId && t.userId.length === 24) {
            const u = await User.findById(t.userId).select('username email virtualCoins');
            if (u) {
              userObj = { _id: u._id.toString(), username: u.username, email: u.email };
            }
          } else if (t.userId) {
            const u = await User.findOne({ username: t.userId }).select('username email');
            if (u) {
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
    const result = await fantasyPointsService.calculateAndSyncMatchPoints(matchId, req.app.get('io'));
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

router.post('/update-score', handlePointsUpdate);
router.post('/:matchId/points', handlePointsUpdate);

module.exports = router;
