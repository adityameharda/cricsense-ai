const express = require('express');
const Contest = require('../models/contest');
const FantasyTeam = require('../models/fantasyTeam');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Create a new contest
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, matchId, entryFee = 0, maxParticipants = 20 } = req.body;

    if (!name || !matchId) {
      return res.status(400).json({ error: 'Contest name and match ID are required' });
    }

    // Generate unique contest ID
    const contestId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const contest = new Contest({
      contestId,
      name,
      createdBy: req.user._id,
      matchId,
      entryFee,
      maxParticipants,
      participants: [req.user._id]
    });

    await contest.save();

    res.status(201).json({
      message: 'Contest created successfully',
      contest
    });
  } catch (error) {
    console.error('Contest creation error:', error);
    res.status(500).json({ error: 'Server error during contest creation' });
  }
});

// Join a contest
router.post('/join/:contestId', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const contest = await Contest.findOne({ contestId });

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    if (!contest.isActive) {
      return res.status(400).json({ error: 'Contest is no longer active' });
    }

    if (contest.participants.includes(req.user._id)) {
      return res.status(400).json({ error: 'Already joined this contest' });
    }

    if (contest.participants.length >= contest.maxParticipants) {
      return res.status(400).json({ error: 'Contest is full' });
    }

    // Check if user has enough coins
    if (req.user.virtualCoins < contest.entryFee) {
      return res.status(400).json({ error: 'Insufficient virtual coins' });
    }

    // Deduct entry fee
    req.user.virtualCoins -= contest.entryFee;
    await req.user.save();

    // Add user to contest
    contest.participants.push(req.user._id);
    contest.prizePool += contest.entryFee;
    await contest.save();

    res.json({
      message: 'Successfully joined contest',
      contest
    });
  } catch (error) {
    console.error('Join contest error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get contest details
router.get('/:contestId', async (req, res) => {
  try {
    const { contestId } = req.params;
    const contest = await Contest.findOne({ contestId })
      .populate('createdBy', 'username')
      .populate('participants', 'username');

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    res.json({ contest });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's contests
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

// Settle contest (Admin or System)
// BUG 2 FIX: use User.findById(team.userId) — userId is stored as ObjectId string
router.post('/settle/:contestId', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const contest = await Contest.findOne({ contestId }).populate('participants', 'username');

    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }

    if (!contest.isActive) {
      return res.status(400).json({ error: 'Contest is already settled' });
    }

    // Fetch leaderboard sorted by points desc
    const leaderboard = await FantasyTeam.find({
      matchId: contest.matchId,
      contestId: contest.contestId
    }).sort({ totalPoints: -1 });

    if (leaderboard.length === 0) {
      return res.status(400).json({ error: 'No teams found for this contest' });
    }

    // Prize distribution: 1st=50%, 2nd=30%, 3rd=20%
    const prizePool = contest.prizePool;
    const payouts = [0.5, 0.3, 0.2];

    for (let i = 0; i < leaderboard.length; i++) {
      const team = leaderboard[i];
      // BUG 2 FIX: userId is stored as ObjectId string — use findById
      const dbUser = await require('../models/user').findById(team.userId);
      if (dbUser) {
        dbUser.totalMatches = (dbUser.totalMatches || 0) + 1;
        // Update best rank (lower rank number = better)
        if (!dbUser.bestRank || (i + 1) < dbUser.bestRank) {
          dbUser.bestRank = i + 1;
        }
        if (i < payouts.length && prizePool > 0) {
          const winnings = Math.floor(prizePool * payouts[i]);
          dbUser.virtualCoins = (dbUser.virtualCoins || 0) + winnings;
          if (i === 0) dbUser.totalWins = (dbUser.totalWins || 0) + 1;
        }
        await dbUser.save();
      }
    }

    contest.isActive = false;
    await contest.save();

    res.json({ message: 'Contest settled successfully', contest });
  } catch (error) {
    console.error('Contest settlement error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;