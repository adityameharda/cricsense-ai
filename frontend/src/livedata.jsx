import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

const LiveData = () => {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/matches');
        const data = await response.json();
        setMatches(data);
      } catch (error) {
        console.error('❌ Error fetching matches:', error);
      }
    };

    fetchMatches();

    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('✅ Connected to live score socket:', socket.id);
      socket.emit('join_live_matches');
    });

    socket.on('match_update', (updatedMatch) => {
      setMatches((prevMatches) => {
        const index = prevMatches.findIndex((m) => m.matchId === updatedMatch.matchId);
        if (index === -1) {
          return [updatedMatch, ...prevMatches];
        }
        const updated = [...prevMatches];
        updated[index] = updatedMatch;
        return updated;
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from live score socket');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // A match is "live" only if it has started and has NOT ended
  const isLive = (match) => match.matchStarted && !match.matchEnded;

  const liveMatches = matches.filter(isLive);
  const otherMatches = matches.filter((m) => !isLive(m));

  const renderMatch = (match) => (
    <li key={match.matchId || match._id} style={{ marginBottom: '16px', listStyle: 'none' }}>
      <strong>{match.teamA} vs {match.teamB}</strong> - {match.status} <br />
      Score: {match.scoreA} - {match.scoreB} <br />
      Venue: {match.venue} <br />
      Date: {match.date}
    </li>
  );

  return (
    <div>
      <h1>Live Cricket Matches</h1>

      <h2 style={{ color: 'red' }}>🔴 Live Now ({liveMatches.length})</h2>
      {liveMatches.length === 0 ? (
        <p>No matches currently live.</p>
      ) : (
        <ul style={{ padding: 0 }}>
          {liveMatches.map(renderMatch)}
        </ul>
      )}

      <h2>Other Matches</h2>
      <ul style={{ padding: 0 }}>
        {otherMatches.map(renderMatch)}
      </ul>
    </div>
  );
};

export default LiveData;