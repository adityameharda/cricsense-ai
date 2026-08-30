# CricScore - Cricket Scoring & Fantasy Cricket Platform

A full-stack web application for real-time cricket match scoring, fantasy cricket contests, and team predictions.

## Prerequisites

- Node.js (v14+)
- npm or yarn
- MongoDB
- Git

## Installation & Setup

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd cric
   
   cd server && npm install
   cd ../client && npm install
   ```

2. **Configure Environment**
   
   Create `.env` in the `server` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/cricscore
   JWT_SECRET=your_secret_key
   NODE_ENV=development
   ```

## Running the Application

**Backend:**
```bash
cd server
npm run dev    # Development with nodemon
npm start      # Production
```

**Frontend:**
```bash
cd client
npm run dev    # Development server (http://localhost:5173)
npm run build  # Production build
```

## Project Structure

```
cric/
├── server/              # Express.js backend + MongoDB
│   ├── models/          # User, Match, FantasyTeam, Contest, Prediction
│   ├── routes/          # API endpoints (auth, fantasy, contests, liveScore)
│   └── index.js         # Server entry point
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   └── App.jsx
│   └── vite.config.js
└── live-data-automation/  # Real-time data sync
```

## Key Features

- **Live Scoring** - Real-time match updates via Socket.io
- **Fantasy Cricket** - Create & manage teams
- **Contests** - Create and join contests
- **Predictions** - Match outcome predictions
- **Authentication** - JWT-based user auth
- **Leaderboards** - Live rankings

## API Endpoints

- `/api/auth` - Login, Register, Profile
- `/api/matches` - Match data & details
- `/api/fantasy` - Fantasy teams CRUD
- `/api/contests` - Contest management
- `/api/predictions` - Predictions CRUD
- `/api/liveScore` - Live match updates

## License

ISC
