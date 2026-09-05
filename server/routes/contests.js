const express = require('express');
const Contest = require('../models/contest');
const Match = require('../models/match');
const FantasyTeam = require('../models/fantasyTeam');
const User = require('../models/user');
const { authenticateToken } = require('./auth');
const { checkMatchEntryEligibility } = require('../helpers/matchTiming');
const router = express.Router();

// Create a new contest (Only allowed before match starts and > 2 min before start)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, matchId, entryFee = 0, maxParticipants = 20 } = req.body;

    if (!name || !matchId) {
      return res.status(400).json({ error: 'Contest name and match fixture ID are required' });
    }

    // Find the match
    const match = await Match.findOne({
      $or: [{ matchId }, { _id: matchId.length === 24 ? matchId : null }]
    });

    if (!match) {
      return res.status(404).json({ error: 'Match fixture not found' });
    }

    // Check entry eligibility (Rule: only before match start, locked 2 min before)
    const eligibility = checkMatchEntryEligibility(match);
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.error });
    }

    // Generate unique 6-character contest code
    const contestId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const contest = new Contest({
      contestId,
      name: name.trim(),
      createdBy: req.user._id,
      matchId: match.matchId || match._id.toString(),
      entryFee: Number(entryFee) || 0,
      maxParticipants: Number(maxParticipants) || 20,
      participants: [req.user._id]
    });

    await contest.save();

    res.status(201).json({
      message: 'Contest created successfully',
      contest
    });
  } catch (error) {
    console.error('Contest creation error:', error);
    res.status(500).json({ error: error.message || 'Server error during contest creation' });
  }
});

// Join a contest (Only allowed before match starts and > 2 min before start)
router.post('/join/:contestId', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const cleanContestId = (contestId || '').trim().toUpperCase();
    const contest = await Contest.findOne({ contestId: cleanContestId });

    if (!contest) {
      return res.status(404).json({ error: `Contest room "${cleanContestId}" not found. Please check the code.` });
    }

    if (!contest.isActive) {
      return res.status(400).json({ error: 'Not applicable now. Contest is no longer active.' });
    }

    // Find match for this contest and verify timing
    const match = await Match.findOne({
      $or: [{ matchId: contest.matchId }, { _id: contest.matchId.length === 24 ? contest.matchId : null }]
    });

    if (match) {
      const eligibility = checkMatchEntryEligibility(match);
      if (!eligibility.eligible) {
        return res.status(400).json({ error: eligibility.error });
      }
    }

    const userIdStr = req.user._id.toString();
    const alreadyJoined = contest.participants.some(p => p.toString() === userIdStr);

    if (alreadyJoined) {
      return res.json({
        message: 'You have already joined this contest room.',
        contest,
        matchId: contest.matchId
      });
    }

    if (contest.participants.length >= contest.maxParticipants) {
      return res.status(400).json({ error: `Contest room is full (${contest.maxParticipants} players max).` });
    }

    // Check virtual coin balance
    if (req.user.virtualCoins < contest.entryFee) {
      return res.status(400).json({ error: 'Insufficient fantasy points/coins balance.' });
    }

    // Deduct entry fee if any
    if (contest.entryFee > 0) {
      req.user.virtualCoins -= contest.entryFee;
      await req.user.save();
    }

    contest.participants.push(req.user._id);
    contest.prizePool += contest.entryFee;
    await contest.save();

    res.json({
      message: 'Successfully joined contest room!',
      contest,
      matchId: contest.matchId
    });
  } catch (error) {
    console.error('Join contest error:', error);
    res.status(500).json({ error: 'Server error while joining contest' });
  }
});

// Get contest details by 6-char code
router.get('/:contestId', async (req, res) => {
  try {
    const { contestId } = req.params;
    const cleanContestId = (contestId || '').trim().toUpperCase();

    const contest = await Contest.findOne({ contestId: cleanContestId })
      .populate('createdBy', 'username')
      .populate('participants', 'username');

    if (!contest) {
      return res.status(404).json({ error: `No contest room found with code "${cleanContestId}".` });
    }

    // Fetch associated match
    const match = await Match.findOne({
      $or: [{ matchId: contest.matchId }, { _id: contest.matchId.length === 24 ? contest.matchId : null }]
    });

    res.json({
      contest,
      match: match ? {
        matchId: match.matchId || match._id,
        teamA: match.teamA,
        teamB: match.teamB,
        teamALogo: match.teamALogo,
        teamBLogo: match.teamBLogo,
        matchStarted: match.matchStarted,
        matchEnded: match.matchEnded,
        status: match.status,
        venue: match.venue,
        date: match.date,
        matchType: match.matchType
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching contest' });
  }
});

// Get contests for a match
router.get('/match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const contests = await Contest.find({ matchId, isActive: true })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ contests });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching match contests' });
  }
});

// Get user's active contests
router.get('/user/contests', authenticateToken, async (req, res) => {
  try {
    const contests = await Contest.find({
      participants: req.user._id
    })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ contests });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;