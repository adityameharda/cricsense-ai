const axios = require('axios');

async function testRAG() {
  console.log('--- Testing CricSense RAG Pipeline ---');

  // Test 1: Ask Win Probability for India vs Australia
  try {
    const res = await axios.post('http://localhost:5000/api/cricsense/ask', {
      query: 'Who has the win probability advantage in India vs Australia at Wankhede?',
      matchId: 'upcoming-ind-aus-2026'
    });
    console.log('Test 1 PASS (Win Probability & Ground RAG):');
    console.log(res.data.reply);
    console.log('\nRetrieved Context Summary:', {
      venue: res.data.retrievedContext?.venue,
      scores: res.data.retrievedContext?.scores,
      winProbability: res.data.retrievedContext?.winProbability
    });
  } catch (err) {
    console.log('Test 1 FAIL:', err.response?.data || err.message);
  }

  console.log('\n----------------------------------------\n');

  // Test 2: Ask Fantasy Captaincy Strategy
  try {
    const res = await axios.post('http://localhost:5000/api/cricsense/ask', {
      query: 'Who is the best 2x Captain and 1.5x Vice Captain pick for my fantasy team?',
      matchId: 'upcoming-ind-aus-2026'
    });
    console.log('Test 2 PASS (Fantasy ROI & Captaincy RAG):');
    console.log(res.data.reply);
  } catch (err) {
    console.log('Test 2 FAIL:', err.response?.data || err.message);
  }

  console.log('\n----------------------------------------\n');

  // Test 3: Pitch & Dew Report
  try {
    const res = await axios.post('http://localhost:5000/api/cricsense/ask', {
      query: 'How will the pitch and dew play in the second innings?',
      matchId: 'upcoming-ind-aus-2026'
    });
    console.log('Test 3 PASS (Pitch & Dew RAG):');
    console.log(res.data.reply);
  } catch (err) {
    console.log('Test 3 FAIL:', err.response?.data || err.message);
  }

  console.log('\n----------------------------------------\n');

  // Test 4: Venue Knowledge endpoint
  try {
    const res = await axios.get("http://localhost:5000/api/cricsense/venue/Wankhede Stadium, Mumbai");
    console.log('Test 4 PASS (Venue Dictionary Retrieval):', res.data.venue?.pitchType);
  } catch (err) {
    console.log('Test 4 FAIL:', err.response?.data || err.message);
  }
}

testRAG();
