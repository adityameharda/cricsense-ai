import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const Predictions = ({ user }) => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [predictions, setPredictions] = useState({
    totalRuns: '',
    topScorer: '',
    totalWickets: ''
  });
  const [existingPrediction, setExistingPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMatchAndPredictions();
  }, [matchId]);

  const fetchMatchAndPredictions = async () => {
    try {
      const token = localStorage.getItem('token');
      const [matchRes, predictionRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/matches/${matchId}`),
        axios.get(`http://localhost:5000/api/predictions/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setMatch(matchRes.data);
      if (predictionRes.data.prediction) {
        setExistingPrediction(predictionRes.data.prediction);
        setPredictions(predictionRes.data.prediction.predictions);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPredictions({
      ...predictions,
      [name]: name === 'totalRuns' || name === 'totalWickets' ? Number(value) : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/predictions', {
        matchId,
        predictions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Predictions submitted successfully!');
      fetchMatchAndPredictions(); // Refresh data
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit predictions');
    } finally {
      setLoading(false);
    }
  };

  if (!match) return <div>Loading...</div>;

  const isLive = match.status && match.status.toLowerCase().includes('live');
  const canPredict = !isLive && !existingPrediction?.isCalculated;

  return (
    <div className="predictions-container">
      <div className="predictions-header">
        <h2>Match Predictions</h2>
        <h3>{match.teamA} vs {match.teamB}</h3>
        <p>Make your predictions before the match starts!</p>
      </div>

      {existingPrediction?.isCalculated && (
        <div className="results-card">
          <h3>Results</h3>
          <div className="results-grid">
            <div className="result-item">
              <span>Total Runs: {existingPrediction.actualResults.totalRuns}</span>
              <span className={existingPrediction.predictions.totalRuns === existingPrediction.actualResults.totalRuns ? 'correct' : 'wrong'}>
                Your prediction: {existingPrediction.predictions.totalRuns}
              </span>
            </div>
            <div className="result-item">
              <span>Top Scorer: {existingPrediction.actualResults.topScorer}</span>
              <span className={existingPrediction.predictions.topScorer === existingPrediction.actualResults.topScorer ? 'correct' : 'wrong'}>
                Your prediction: {existingPrediction.predictions.topScorer}
              </span>
            </div>
            <div className="result-item">
              <span>Total Wickets: {existingPrediction.actualResults.totalWickets}</span>
              <span className={existingPrediction.predictions.totalWickets === existingPrediction.actualResults.totalWickets ? 'correct' : 'wrong'}>
                Your prediction: {existingPrediction.predictions.totalWickets}
              </span>
            </div>
          </div>
          <div className="points-earned">
            <strong>Points Earned: {existingPrediction.points}</strong>
          </div>
        </div>
      )}

      {canPredict && (
        <form onSubmit={handleSubmit} className="predictions-form">
          <div className="form-group">
            <label>Total Match Runs</label>
            <input
              type="number"
              name="totalRuns"
              value={predictions.totalRuns}
              onChange={handleChange}
              required
              min="0"
              placeholder="e.g., 320"
            />
            <small>Predict the total runs scored in the match</small>
          </div>

          <div className="form-group">
            <label>Top Scorer</label>
            <select
              name="topScorer"
              value={predictions.topScorer}
              onChange={handleChange}
              required
            >
              <option value="">Select player...</option>
              {[...(match.squadA || []), ...(match.squadB || [])].map(player => (
                <option key={player} value={player}>{player}</option>
              ))}
            </select>
            <small>Who will score the most runs?</small>
          </div>

          <div className="form-group">
            <label>Total Wickets</label>
            <input
              type="number"
              name="totalWickets"
              value={predictions.totalWickets}
              onChange={handleChange}
              required
              min="0"
              max="20"
              placeholder="e.g., 8"
            />
            <small>Predict the total wickets taken in the match</small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Submitting...' : 'Submit Predictions'}
          </button>
        </form>
      )}

      {!canPredict && !existingPrediction?.isCalculated && (
        <div className="cannot-predict">
          <p>Predictions are closed for this match.</p>
          {isLive && <p>The match is currently live!</p>}
        </div>
      )}

      <div className="prediction-rules">
        <h3>Scoring Rules</h3>
        <ul>
          <li>Correct total runs: 10 points</li>
          <li>Correct top scorer: 15 points</li>
          <li>Correct total wickets: 10 points</li>
          <li>All three correct: Bonus 10 points</li>
        </ul>
      </div>
    </div>
  );
};

export default Predictions;