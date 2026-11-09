import React, { useState, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/common/Header';
import Matches from './components/Matches';
import { useMatches } from './store/matchesStore';
import './App.css';

// The home page loads immediately; every other page is downloaded only when visited.
const TeamBuilder = lazy(() => import('./components/TeamBuilder'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const MatchDetails = lazy(() => import('./components/MatchDetails'));
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ContestCreation = lazy(() => import('./components/ContestCreation'));
const Predictions = lazy(() => import('./components/Predictions'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const LiveScore = lazy(() => import('./components/LiveScore'));

const readSavedUser = () => {
  try {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    return token && savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
};

const PageFallback = () => (
  <div className="app-loading" style={{ minHeight: '50vh', background: 'transparent' }}>
    <div className="spinner" />
  </div>
);

function App() {
  const [user, setUser] = useState(readSavedUser);
  const { matches } = useMatches();

  const liveCount = useMemo(
    () => matches.filter((m) => m.matchStarted && !m.matchEnded).length,
    [matches]
  );

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <Header user={user} onLogout={handleLogout} liveCount={liveCount} />

        <main className="main-container">
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
