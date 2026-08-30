const express = require('express');
const router = express.Router();
const FantasyTeam = require('../models/fantasyTeam');
const MatchPoint = require('../models/matchPoint');
const User = require('../models/user');
const Contest = require('../models/contest');
const { authenticateToken } = require('./auth');

// ── POST /api/fantasy/team ──────────────────────────────────────────
router.post('/team', async (req, res) => {
  try {
    const { matchId, players, captain, viceCaptain, contestId = 'general' } = req.body;
    
    // Extract userId from JWT auth header or request body
    let userId = req.body.userId;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        if (decoded?._id) userId = decoded._id.toString();
      } catch (jwtErr) {
        // fallback to body userId
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Please log in to submit your fantasy team.' });
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

    const Match = require('../models/match');
    const match = await Match.findOne({
      $or: [{ matchId }, { _id: matchId.length === 24 ? matchId : null }]
    });

    if (!match) return res.status(404).json({ error: 'Match not found.' });

    // Block only if match is officially concluded
    if (match.matchEnded) {
      return res.status(400).json({ error: 'Cannot submit a fantasy team for a concluded match.' });
    }

    // Validate contest if not general
    let finalContestId = contestId || 'general';
    if (finalContestId !== 'general') {
      let contest = await Contest.findOne({ contestId: finalContestId });

      if (!contest) {
        // Auto-create private contest with this code
        contest = new Contest({
          contestId: finalContestId,
          name: `Private League (${finalContestId})`,
          createdBy: userId,
          matchId,
          entryFee: 0,
          maxParticipants: 20,
          participants: [userId]
        });
        await contest.save();
      } else {
        if (contest.matchId !== matchId) {
          return res.status(400).json({ error: 'This contest code belongs to a different match.' });
        }

        // Count unique users already in this contest
        const existingTeamsCount = await FantasyTeam.countDocuments({ matchId, contestId: finalContestId });
        const userHasTeam = await FantasyTeam.findOne({ userId, matchId, contestId: finalContestId });

        if (!userHasTeam && existingTeamsCount >= contest.maxParticipants) {
          return res.status(400).json({
            error: `Contest is full. Maximum ${contest.maxParticipants} participants allowed.`
          });
        }

        if (!contest.participants.some(p => p.toString() === userId.toString())) {
          contest.participants.push(userId);
          await contest.save();
        }
      }
    }

    // Upsert: allow users to update their team
    const team = await FantasyTeam.findOneAndUpdate(
      { userId, matchId, contestId: finalContestId },
      { players, captain, viceCaptain },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: 'Fantasy team saved successfully!',
      team,
      contestId: finalContestId
    });
  } catch (err) {
    console.error('Error saving fantasy team:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'You have already submitted a team for this match/contest.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/fantasy/team/:matchId ──────────────────────────────────
router.get('/team/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { contestId = 'general' } = req.query;
    const userId = req.user._id.toString();

    const team = await FantasyTeam.findOne({ userId, matchId, contestId });
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

    const leaderboard = await FantasyTeam.find({ matchId, contestId })
      .populate('userId', 'username')
      .sort({ totalPoints: -1 })
      .limit(100);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/fantasy/update-score ──────────────────────────────────
// Called by automation engine to award fantasy points
router.post('/update-score', async (req, res) => {
  try {
    const { matchId, playerName, pointsToAdd } = req.body;

    if (!matchId || !playerName || !pointsToAdd) {
      return res.status(400).json({ error: 'matchId, playerName, pointsToAdd required.' });
    }

    // BUG 5 FIX: normalize player name to lowercase trim for comparison
    const normalizedName = playerName.trim().toLowerCase();

    // Update MatchPoint record
    await MatchPoint.findOneAndUpdate(
      { matchId, playerName },
      { $inc: { points: pointsToAdd } },
      { upsert: true }
    );

    // Update totalPoints in ALL fantasy teams containing this player
    // Uses aggregation pipeline to correctly apply 2× captain / 1.5× VC multipliers
    const allTeams = await FantasyTeam.find({
      matchId,
      // BUG 5 FIX: case-insensitive player name match
      players: { $regex: new RegExp(`^${playerName.trim()}$`, 'i') }
    });

    for (const team of allTeams) {
      let points = pointsToAdd;
      if (team.captain?.trim().toLowerCase() === normalizedName) {
        points = pointsToAdd * 2;
      } else if (team.viceCaptain?.trim().toLowerCase() === normalizedName) {
        points = pointsToAdd * 1.5;
      }
      team.totalPoints = (team.totalPoints || 0) + points;
      await team.save();
    }

    // Emit updated leaderboard to all affected contest rooms
    const affectedContests = [...new Set(allTeams.map(t => t.contestId))];
    const io = req.app.get('io');

    if (io && affectedContests.length > 0) {
      for (const contestId of affectedContests) {
        const newLeaderboard = await FantasyTeam.find({ matchId, contestId })
          .populate('userId', 'username')
          .sort({ totalPoints: -1 })
          .limit(100);
        io.to(`match_${matchId}_${contestId}`).emit('leaderboard_update', newLeaderboard);
        io.to(`match_${matchId}`).emit('leaderboard_update', newLeaderboard);
      }
    }

    res.json({ message: `Points updated: ${pointsToAdd} pts for ${playerName}`, affectedTeams: allTeams.length });
  } catch (err) {
    console.error('Error updating scores:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
