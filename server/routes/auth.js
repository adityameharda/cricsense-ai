const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
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

// Lenient middleware for read-only or demo fallbacks
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      let guestUser = await User.findOne({ username: 'deepak_verma' });
      if (!guestUser) {
        guestUser = new User({
          username: 'deepak_verma',
          email: 'deepak_verma@cricscore.pro',
          password: 'password123',
          virtualCoins: 1000,
        });
        await guestUser.save();
      }
      req.user = guestUser;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const uId = decoded.userId || decoded._id || decoded.id;
      let user = await User.findById(uId);
      if (!user) {
        user = await User.findOne({ username: 'deepak_verma' });
        if (!user) {
          user = new User({
            username: 'deepak_verma',
            email: 'deepak_verma@cricscore.pro',
            password: 'password123',
            virtualCoins: 1000,
          });
          await user.save();
        }
      }
      req.user = user;
      return next();
    } catch (jwtErr) {
      let user = await User.findOne({ username: 'deepak_verma' });
      if (!user) {
        user = new User({
          username: 'deepak_verma',
          email: 'deepak_verma@cricscore.pro',
          password: 'password123',
          virtualCoins: 1000,
        });
        await user.save();
      }
      req.user = user;
      return next();
    }
  } catch (error) {
    res.status(401).json({ error: 'Authentication error' });
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
        virtualCoins: user.virtualCoins,
        totalWins: user.totalWins,
        totalMatches: user.totalMatches,
        bestRank: user.bestRank
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        virtualCoins: req.user.virtualCoins,
        totalWins: req.user.totalWins,
        totalMatches: req.user.totalMatches,
        bestRank: req.user.bestRank
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

module.exports = { router, authenticateToken, requireAuth };