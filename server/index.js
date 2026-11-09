require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');

const automation = require('./automation');

// CricScore High-Performance Backend API Server
const app = express();
const server = http.createServer(app);

// Middlewares
app.use(compression());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', require('./routes/api'));
app.use('/api', require('./routes/liveScore'));
app.use('/api/fantasy', require('./routes/fantasy'));

// Auth & Contests
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/contests', require('./routes/contests'));
app.use('/api/cricsense', require('./routes/cricsense'));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Compress socket payloads too (match_update events are sent frequently)
  perMessageDeflate: { threshold: 1024 },
});

app.set('io', io);
automation.init(io);

// Socket.io setup
io.on('connection', (socket) => {
  socket.on('join_match', (matchId) => {
    socket.join(`match_${matchId}`);
    socket.join(`match_${matchId}_general`);
  });

  socket.on('join_live_matches', () => {
    socket.join('live_matches');
  });

  socket.on('leave_match', (matchId) => {
    socket.leave(`match_${matchId}`);
    socket.leave(`match_${matchId}_general`);
  });
});

// Health check
app.get('/api/health/cricket', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running correctly' });
});

const PORT = process.env.PORT || 5000;

// Start listening immediately so the host sees the port open as soon as possible
// after a cold start. Mongoose buffers queries until the DB connection is ready.
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Keep-alive: Render's free tier sleeps after 15 minutes without traffic, which
// makes the first visitor wait for a cold start. Render sets RENDER_EXTERNAL_URL
// automatically, so this only runs in production.
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (KEEP_ALIVE_URL) {
  const pingUrl = `${KEEP_ALIVE_URL.replace(/\/$/, '')}/api/health/cricket`;
  setInterval(() => {
    axios.get(pingUrl, { timeout: 10000 }).catch(() => {});
  }, 10 * 60 * 1000);
  console.log(`Keep-alive enabled: ${pingUrl}`);
}
