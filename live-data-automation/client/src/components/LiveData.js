import React, { useEffect, useState } from 'react';
import axios from 'axios';

const LiveData = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLiveData = async () => {
    try {
      const response = await axios.get('/api/matches'); // Adjust the endpoint as necessary
      setMatches(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // Fetch data every 30 seconds
    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Live Kabaddi Matches</h1>
      <ul>
        {matches.map((match) => (
          <li key={match._id}>
            {match.teamA} vs {match.teamB} - Score: {match.scoreA}:{match.scoreB} - Status: {match.status}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LiveData;