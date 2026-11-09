const express = require('express');
const Contest = require('../models/contest');
const Match = require('../models/match');
const FantasyTeam = require('../models/fantasyTeam');
const User = require('../models/user');
const { requireAuth } = require('./auth');
const { checkMatchEntryEligibility } = require('../helpers/matchTiming');
const crypto = require('crypto');
const router = express.Router();

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeContestCode = () =>
  Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

// Create a new contest (Only logged-in users, before match starts and > 2 min before start)
router.post('/create', requireAuth, async (req, res) => {
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

    const fee = Math.max(0, Math.floor(Number(entryFee) || 0));
    const seats = Math.min(100, Math.max(2, Math.floor(Number(maxParticipants) || 20)));

    // The creator is the first participant, so they pay the entry fee too
    if (fee > 0) {
      const charged = await User.updateOne(
        { _id: req.user._id, virtualCoins: { $gte: fee } },
        { $inc: { virtualCoins: -fee } }
      );
      if (charged.modifiedCount === 0) {
        return res.status(400).json({ error: 'Insufficient fantasy points/coins balance for this entry fee.' });
      }
    }

    // Unique 6-character code without look-alike characters (no 0/O, 1/I/L)
    let contest = null;
    for (let attempt = 0; attempt < 5 && !contest; attempt++) {
      try {
        contest = await Contest.create({
          contestId: makeContestCode(),
          name: String(name).trim().slice(0, 60),
          createdBy: req.user._id,
          matchId: match.matchId || match._id.toString(),
          entryFee: fee,
          maxParticipants: seats,
          prizePool: fee,
          participants: [req.user._id]
        });
      } catch (e) {
        if (e.code !== 11000) throw e; // duplicate code: try another
      }
    }
    if (!contest) {
      if (fee > 0) await User.updateOne({ _id: req.user._id }, { $inc: { virtualCoins: fee } });
      return res.status(500).json({ error: 'Could not generate a contest code. Please try again.' });
    }

    res.status(201).json({
      message: 'Contest created successfully',
      contest
    });
  } catch (error) {
    console.error('Contest creation error:', error);
    res.status(500).json({ error: error.message || 'Server error during contest creation' });
  }
});

// Join a contest (Only logged-in users, before match starts and > 2 min before start)
router.post('/join/:contestId', requireAuth, async (req, res) => {
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

    const fee = contest.entryFee || 0;

    // Take the entry fee first, only if the balance covers it (atomic, no double spend)
    if (fee > 0) {
      const charged = await User.updateOne(
        { _id: req.user._id, virtualCoins: { $gte: fee } },
        { $inc: { virtualCoins: -fee } }
      );
      if (charged.modifiedCount === 0) {
        return res.status(400).json({ error: 'Insufficient fantasy points/coins balance.' });
      }
    }

    // Take a seat atomically: never more than maxParticipants, even if several people
    // join at the same moment
    const updated = await Contest.findOneAndUpdate(
      {
        _id: contest._id,
        isActive: true,
        participants: { $ne: req.user._id },
        $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
      },
      { $addToSet: { participants: req.user._id }, $inc: { prizePool: fee } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      if (fee > 0) await User.updateOne({ _id: req.user._id }, { $inc: { virtualCoins: fee } }); // refund
      const fresh = await Contest.findById(contest._id);
      if (fresh && fresh.participants.some((p) => p.toString() === userIdStr)) {
        return res.json({ message: 'You have already joined this contest room.', contest: fresh, matchId: fresh.matchId });
      }
      return res.status(400).json({ error: `Contest room is full (${contest.maxParticipants} players max).` });
    }

    res.json({
      message: 'Successfully joined contest room!',
      contest: updated,
      matchId: updated.matchId
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
router.get('/user/contests', requireAuth, async (req, res) => {
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