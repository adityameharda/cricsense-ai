import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/common/Header';
import Matches from './components/Matches';
import TeamBuilder from './components/TeamBuilder';
import Leaderboard from './components/Leaderboard';
import MatchDetails from './components/MatchDetails';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ContestCreation from './components/ContestCreation';
import Predictions from './components/Predictions';
import UserProfile from './components/UserProfile';
import LiveScore from './components/LiveScore';
import axios from 'axios';
import socket from './socket';
import { API_BASE_URL } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);

    const fetchLiveCount = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/matches`);
        if (Array.isArray(res.data)) {
          const live = res.data.filter((m) => m.matchStarted && !m.matchEnded).length;
          setLiveCount(live);
        }
      } catch (e) {
        // silent fallback
      }
    };
    fetchLiveCount();

    socket.emit('join_live_matches');
    socket.on('match_update', () => {
      fetchLiveCount();
    });

    return () => {
      socket.off('match_update');
    };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <span>Loading CricScore…</span>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Header user={user} onLogout={handleLogout} liveCount={liveCount} />

        <main className="main-container">
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/dashboard"
              element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            />
            <Route
              path="/create-contest"
              element={user ? <ContestCreation user={user} /> : <Navigate to="/login" />}
            />
            <Route
              path="/predictions/:matchId"
              element={user ? <Predictions user={user} /> : <Navigate to="/login" />}
            />
            <Route path="/" element={<Matches user={user} />} />
            <Route path="/match-center/:matchId" element={<MatchDetails user={user} />} />
            <Route path="/build-team/:matchId" element={<TeamBuilder user={user} />} />
            <Route path="/leaderboard/:matchId" element={<Leaderboard user={user} />} />
            <Route path="/leaderboard" element={<Navigate to="/" />} />
            <Route path="/match/:matchId" element={<LiveScore />} />
            <Route
              path="/profile"
              element={user ? <UserProfile /> : <Navigate to="/login" />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;