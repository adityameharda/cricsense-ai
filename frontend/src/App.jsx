import React, { useState, useEffect } from 'react';
import LiveData from './livedata.jsx';

function App() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    // Basic fetch if needed, avoiding crashes
    setMatches([]);
  }, []);

  const pastMatches = matches.filter(m => m.date?.includes("2024") || (m.date?.includes("2026") && m.status?.includes("won")));

  return (
    <div style={{ padding: '20px' }}>
      <h1>Old Minimal Frontend</h1>
      <p style={{ color: 'red' }}><strong>Note:</strong> The full CricScore/Dream11 app is located in the <code>client/</code> directory.</p>
      <LiveData />
      
      <h2 style={{ borderTop: '2px solid #334155', paddingTop: '20px', color: '#94a3b8' }}>
         World Cup Archives
      </h2>
      <div style={{ display: 'flex', overflowX: 'auto', gap: '20px', paddingBottom: '20px' }}>
         {pastMatches.map(match => (
           <div key={match._id} style={{ minWidth: '300px', background: '#1e293b', padding: '15px', borderRadius: '10px' }}>
             <small>{match.date}</small>
             <h4>{match.teamA} vs {match.teamB}</h4>
             <p style={{ color: '#4ade80' }}>{match.status}</p>
           </div>
         ))}
      </div>
    </div>
  );
}

export default App;