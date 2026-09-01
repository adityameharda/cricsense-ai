const axios = require('axios');

async function runTests() {
  console.log('--- Testing Fantasy and Contest Rules ---');

  // Test 1: Try creating a contest for a concluded match (should fail with "Not applicable now")
  try {
    const res = await axios.post('http://localhost:5000/api/contests/create', {
      name: 'Old Match Contest',
      matchId: 'd9c33252-aad4-46a8-bc6d-ca87211717a5',
      maxParticipants: 4
    });
    console.log('Test 1 FAIL: Expected error for concluded match, got:', res.status);
  } catch (err) {
    console.log('Test 1 PASS: Got expected rejection for concluded match:', err.response?.data?.error);
  }

  // Test 2: Try creating a contest for an upcoming match (should SUCCEED)
  let createdContestId = null;
  try {
    const res = await axios.post('http://localhost:5000/api/contests/create', {
      name: "Aditya's Premier Clash",
      matchId: 'upcoming-ind-aus-2026',
      maxParticipants: 10
    });
    console.log('Test 2 PASS: Successfully created contest for upcoming match:', res.data.contest?.contestId);
    createdContestId = res.data.contest?.contestId;
  } catch (err) {
    console.log('Test 2 FAIL: Error creating contest for upcoming match:', err.response?.data || err.message);
  }

  // Test 3: Try submitting a team for a concluded match (should fail with "Not applicable now")
  try {
    const res = await axios.post('http://localhost:5000/api/fantasy/team', {
      matchId: 'd9c33252-aad4-46a8-bc6d-ca87211717a5',
      players: ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11'],
      captain: 'P1',
      viceCaptain: 'P2'
    });
    console.log('Test 3 FAIL: Expected error for concluded match squad, got:', res.status);
  } catch (err) {
    console.log('Test 3 PASS: Got expected rejection for concluded match squad:', err.response?.data?.error);
  }

  // Test 4: Try submitting a team for an upcoming match (should SUCCEED)
  try {
    const res = await axios.post('http://localhost:5000/api/fantasy/team', {
      matchId: 'upcoming-ind-aus-2026',
      contestId: createdContestId || 'general',
      players: [
        'Rohit Sharma', 'Virat Kohli', 'Suryakumar Yadav', 'Rishabh Pant',
        'Hardik Pandya', 'Ravindra Jadeja', 'Kuldeep Yadav', 'Jasprit Bumrah',
        'Travis Head', 'David Warner', 'Pat Cummins'
      ],
      captain: 'Rohit Sharma',
      viceCaptain: 'Virat Kohli'
    });
    console.log('Test 4 PASS: Successfully submitted team for upcoming match:', res.data.message);
  } catch (err) {
    console.log('Test 4 FAIL: Error submitting team for upcoming match:', err.response?.data || err.message);
  }

  // Test 5: Verify /api/fantasy/create-team endpoint alias
  try {
    const res = await axios.post('http://localhost:5000/api/fantasy/create-team', {
      matchId: 'upcoming-ind-aus-2026',
      contestId: 'general',
      players: [
        'Rohit Sharma', 'Virat Kohli', 'Suryakumar Yadav', 'Rishabh Pant',
        'Hardik Pandya', 'Ravindra Jadeja', 'Kuldeep Yadav', 'Jasprit Bumrah',
        'Travis Head', 'David Warner', 'Pat Cummins'
      ],
      captain: 'Virat Kohli',
      viceCaptain: 'Jasprit Bumrah'
    });
    console.log('Test 5 PASS: /api/fantasy/create-team alias works cleanly:', res.data.message);
  } catch (err) {
    console.log('Test 5 FAIL: /api/fantasy/create-team alias failed:', err.response?.data || err.message);
  }
}

runTests();
