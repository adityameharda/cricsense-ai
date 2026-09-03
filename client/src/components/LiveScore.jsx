import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';

const SOCKET_URL = API_BASE_URL;

const LiveScore = () => {
  const { matchId } = useParams();
  const [liveData, setLiveData] = useState(null);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    const joinRoom = () => {
      socket.emit('join-match', matchId);
      setSocketStatus('connected');
    };

    const leaveRoom = () => {
      socket.emit('leave-match', matchId);
      setSocketStatus('disconnected');
    };

    joinRoom();

    socket.on('score-update', (data) => {
      setLiveData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
    });

    return () => {
      leaveRoom();
      socket.disconnect();
    };
  }, [matchId]);

  if (!liveData) return <div>Loading live scores...</div>;

  const { teams, score, batsmen, bowler, lastBall, runRate } = liveData;

  return (
    <div>
      <h1>Live Cricket Score</h1>
      <h2>{teams[0]} vs {teams[1]}</h2>
      <p>{score.r}/{score.w} in {score.o} overs</p>
      <p>Current Batsmen:</p>
      <ul>
        {batsmen.map((batsman, index) => (
          <li key={index}>{batsman.name}: {batsman.runs} ({batsman.balls})</li>
        ))}
      </ul>
      <p>Current Bowler: {bowler.name} - {bowler.overs} overs, {bowler.runs} runs, {bowler.wickets} wickets</p>
      <p>Last Ball: {lastBall}</p>
      <p>Run Rate: {runRate}</p>

      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid red' }}>
          <h3>Debug Info</h3>
          <p>Match ID: {matchId}</p>
          <p>Socket Status: {socketStatus}</p>
          <p>Last Updated: {lastUpdated}</p>
          <p>Match: {teams[0]} vs {teams[1]}</p>
        </div>
      )}
    </div>
  );
};

export default LiveScore;