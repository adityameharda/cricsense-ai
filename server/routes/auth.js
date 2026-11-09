const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const FantasyTeam = require('../models/fantasyTeam');
const Match = require('../models/match');
const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  });
};

// Strict middleware requiring authenticated user
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please log in to perform this action.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const uId = decoded.userId || decoded._id || decoded.id;

    const user = await User.findById(uId);
    if (!user) {
      return res.status(401).json({ error: 'User session expired. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in.' });
  }
};

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email or username' });
    }

    const user = new User({ username: cleanUsername, email: cleanEmail, password });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        virtualCoins: user.virtualCoins
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    const clean = email.trim();
    const user = await User.findOne({
      $or: [{ email: clean.toLowerCase() }, { username: clean }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        virtualCoins: user.virtualCoins
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * Career stats computed from the user's real fantasy entries:
 * - totalMatches: distinct matches the user entered a team for
 * - totalWins: contests finished 1st in (completed matches, at least 2 teams)
 * - bestRank: best finishing position in a completed match
 * - recentEntries: latest entries with points, rank and match state
 */
async function computeUserStats(userId) {
  const teams = await FantasyTeam.find({ userId: String(userId) })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  if (teams.length === 0) {
    return { totalMatches: 0, totalWins: 0, bestRank: 0, recentEntries: [] };
  }

  const matchIds = [...new Set(teams.map((t) => t.matchId))];
  const matches = await Match.find(
    { matchId: { $in: matchIds } },
    'matchId teamA teamB matchStarted matchEnded status date startTime'
  ).lean();
  const byId = new Map(matches.map((m) => [m.matchId, m]));

  let totalWins = 0;
  let bestRank = 0;
  const entries = await Promise.all(teams.map(async (t) => {
    const m = byId.get(t.matchId);
    const scope = { matchId: t.matchId, contestId: t.contestId || 'general' };
    const [ahead, entrants] = await Promise.all([
      FantasyTeam.countDocuments({ ...scope, totalPoints: { $gt: t.totalPoints || 0 } }),
      FantasyTeam.countDocuments(scope),
    ]);
    const rank = ahead + 1;
    if (m?.matchEnded) {
      if (rank === 1 && entrants >= 2) totalWins += 1;
      if (!bestRank || rank < bestRank) bestRank = rank;
    }
    return {
      matchId: t.matchId,
      contestId: t.contestId || 'general',
      fixture: m ? `${m.teamA} vs ${m.teamB}` : `Match ${t.matchId}`,
      state: m ? (m.matchEnded ? 'completed' : m.matchStarted ? 'live' : 'upcoming') : 'unknown',
      status: m?.status || '',
      points: t.totalPoints || 0,
      rank,
      entrants,
      updatedAt: t.updatedAt,
    };
  }));

  return {
    totalMatches: matchIds.length,
    totalWins,
    bestRank,
    recentEntries: entries.slice(0, 6),
  };
}

// Get user profile (with stats computed from real entries)
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const stats = await computeUserStats(req.user._id);
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        virtualCoins: req.user.virtualCoins,
        createdAt: req.user.createdAt,
        ...stats,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

module.exports = { router, requireAuth };