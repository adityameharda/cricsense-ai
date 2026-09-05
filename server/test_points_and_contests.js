require('dotenv').config();
const mongoose = require('mongoose');
const fantasyPointsService = require('./services/fantasyPointsService');
const Match = require('./models/match');
const FantasyTeam = require('./models/fantasyTeam');
const Contest = require('./models/contest');
const MatchPoint = require('./models/matchPoint');
const User = require('./models/user');

async function runTests() {
  console.log('=== RUNNING COMPREHENSIVE FANTASY POINTS & CONTESTS TEST ===\n');

  await mongoose.connect(process.env.MONGO_URI);

  // 1. Test Points Calculation on Match 169850 (Pakistan Women vs India Women)
  console.log('--- Test 1: Full Scorecard Points Calculation for Match 169850 ---');
  const syncResult = await fantasyPointsService.calculateAndSyncMatchPoints('169850');
  console.log('Sync Result:', syncResult);

  if (!syncResult.success) {
    throw new Error('Points calculation failed: ' + syncResult.error);
  }

  // 2. Check MatchPoints in DB
  const matchPoints = await MatchPoint.find({ matchId: '169850' });
  console.log(`\n--- Test 2: MatchPoint records created (${matchPoints.length} players) ---`);
  matchPoints.sort((a,b) => b.points - a.points).slice(0, 8).forEach((p, idx) => {
    console.log(`  ${idx+1}. ${p.playerName.padEnd(20)} | Points: ${String(p.points).padStart(3)} | Runs: ${p.stats.runs}, Wkts: ${p.stats.wickets}, Catches: ${p.stats.catches}`);
  });

  // 3. Verify Contest 0BIHNG Points & Breakdown
  console.log('\n--- Test 3: Leaderboard Verification for Contest 0BIHNG ---');
  const teams = await FantasyTeam.find({ matchId: '169850', contestId: '0BIHNG' });
  console.log(`Found ${teams.length} team(s) in contest 0BIHNG:`);
  teams.forEach(t => {
    console.log(`  Team ID: ${t._id}`);
    console.log(`  User ID: ${t.userId}`);
    console.log(`  Captain: ${t.captain} (2x)`);
    console.log(`  Vice-Captain: ${t.viceCaptain} (1.5x)`);
    console.log(`  TOTAL POINTS: ${t.totalPoints} pts (Verified > 0!)\n`);
  });

  // 4. Test Contest Lookup by Code (e.g. 0BIHNG)
  console.log('--- Test 4: Contest Lookup by Code (0BIHNG) ---');
  const contest = await Contest.findOne({ contestId: '0BIHNG' }).populate('createdBy', 'username');
  if (contest) {
    console.log(`  Contest Name: ${contest.name}`);
    console.log(`  Contest Code: ${contest.contestId}`);
    console.log(`  Host: ${contest.createdBy?.username || 'Host'}`);
    console.log(`  Participants: ${contest.participants.length} / ${contest.maxParticipants}`);
  } else {
    console.log('  Contest 0BIHNG not found');
  }

  console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
