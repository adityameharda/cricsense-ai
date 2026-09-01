require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const automation = require('./automation');

// CricScore High-Performance Backend API Server
const app = express();
const server = http.createServer(app);

// Middlewares
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
});

app.set('io', io);
automation.init(io);

// Socket.io setup
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_match', (matchId) => {
    console.log(`Client ${socket.id} joined match ${matchId}`);
    socket.join(`match_${matchId}`);
    socket.join(`match_${matchId}_general`);
  });

  socket.on('join_live_matches', () => {
    console.log(`Client ${socket.id} joined live_matches`);
    socket.join('live_matches');
  });

  socket.on('leave_match', (matchId) => {
    console.log(`Client ${socket.id} left match ${matchId}`);
    socket.leave(`match_${matchId}`);
    socket.leave(`match_${matchId}_general`);
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

// Health check
app.get('/api/health/cricket', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running correctly' });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore')
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });