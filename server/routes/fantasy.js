const express = require('express');
const router = express.Router();
const FantasyTeam = require('../models/fantasyTeam');
const MatchPoint = require('../models/matchPoint');
const Match = require('../models/match');
const User = require('../models/user');
const Contest = require('../models/contest');
const { authenticateToken } = require('./auth');
const { checkMatchEntryEligibility } = require('../helpers/matchTiming');

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
          matchId: match.matchId || match._id.toString(),
          entryFee: 0,
          maxParticipants: 20,
          participants: [userId]
        });
        await contest.save();
      } else {
        const matchIdentifier = match.matchId || match._id.toString();
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

    const matchIdentifier = match.matchId || match._id.toString();

    // Clean upsert by userId + matchId
    let team = await FantasyTeam.findOne({ userId, matchId: matchIdentifier });
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

    const team = await FantasyTeam.findOne({ userId, matchId });
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

    const query = { matchId };
    if (contestId && contestId !== 'general') {
      query.contestId = contestId.toUpperCase();
    }

    const leaderboard = await FantasyTeam.find(query)
      .populate('userId', 'username')
      .sort({ totalPoints: -1 })
      .limit(100);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/fantasy/:matchId/points ───────────────────────────────
router.post('/:matchId/points', async (req, res) => {
  try {
    const { matchId } = req.params;
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
      const hasPlayer = (team.players || []).some(
        p => p.toLowerCase().includes(cleanPlayer) || cleanPlayer.includes(p.toLowerCase())
      );

      if (hasPlayer) {
        let multiplier = 1;
        if (team.captain && (team.captain.toLowerCase().includes(cleanPlayer) || cleanPlayer.includes(team.captain.toLowerCase()))) {
          multiplier = 2;
        } else if (team.viceCaptain && (team.viceCaptain.toLowerCase().includes(cleanPlayer) || cleanPlayer.includes(team.viceCaptain.toLowerCase()))) {
          multiplier = 1.5;
        }

        const delta = pointsToAdd * multiplier;
        team.totalPoints = (team.totalPoints || 0) + delta;
        await team.save();
      }
    }

    res.json({ success: true, matchId, playerName, pointsAwarded: pointsToAdd });
  } catch (err) {
    console.error('Error awarding fantasy points:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
