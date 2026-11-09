/**
 * How Striker itself works, as documents for the CricSense knowledge base.
 *
 * These describe the app's own rules, so they mirror the code:
 *  - fantasy scoring → services/fantasyPointsService.js
 *  - team rules      → routes/fantasy.js
 *  - contests        → routes/contests.js, helpers/matchTiming.js
 * If any of those rules change, update the matching section here (the ingestion job
 * re-embeds a section automatically when its text changes).
 */
module.exports = [
  {
    id: 'fantasy-batting',
    title: 'Fantasy points: batting',
    text: [
      'Striker fantasy batting points:',
      '1 point per run. +1 bonus per four. +2 bonus per six.',
      'Milestones (only the highest applies): 30 runs +4, 50 runs +8, 100 runs +16.',
      'Duck: -2 if the batter is dismissed for 0 after facing at least one ball.',
      'Strike rate bonus or penalty, only after facing at least 10 balls: 170 or more +6, 150 to 169.99 +4, 130 to 149.99 +2, 60 to 70 -2, below 60 -4.',
    ].join('\n'),
  },
  {
    id: 'fantasy-bowling',
    title: 'Fantasy points: bowling',
    text: [
      'Striker fantasy bowling points:',
      '25 points per wicket. +8 bonus for each wicket that is LBW or bowled.',
      'Wicket hauls (only the highest applies): 3 wickets +4, 4 wickets +8, 5 or more wickets +16.',
      'Maiden over: +12 each.',
      'Economy rate bonus or penalty, only after bowling at least 2 overs: below 5 runs per over +6, 5 to 6 +4, above 6 to 7 +2, 10 to 11 -2, above 11 -4.',
    ].join('\n'),
  },
  {
    id: 'fantasy-fielding',
    title: 'Fantasy points: fielding',
    text: [
      'Striker fantasy fielding points:',
      'Catch: +8 each, plus a +4 bonus for taking 3 or more catches.',
      'Stumping: +12 each. Run out: +12 each.',
      'Points are calculated automatically from the live scorecard while the match is in progress.',
    ].join('\n'),
  },
  {
    id: 'fantasy-team',
    title: 'Building a fantasy team',
    text: [
      'How to build a Striker fantasy team:',
      'Pick exactly 11 different players from the two teams in the match, using the real squads.',
      'Choose a captain and a vice-captain from your 11; they must be different players.',
      'The captain earns 2x points and the vice-captain earns 1.5x points.',
      'Only players who actually play score points, so check the playing XI after the toss.',
      'Team entries close 2 minutes before the scheduled start of the match. After that the team is locked.',
    ].join('\n'),
  },
  {
    id: 'contests',
    title: 'Contests and coins',
    text: [
      'Striker contests:',
      'Every new user starts with 1000 virtual coins. Coins are not real money.',
      'You can create a private contest for a match, set an entry fee in coins (0 for free) and the number of seats (2 to 100).',
      'Each contest gets a short code. Friends join by entering the code, and the entry fee is taken when they join.',
      'A contest is full when all seats are taken. You need a separate team for each contest you enter.',
      'The contest leaderboard ranks everyone by fantasy points and updates live during the match.',
      'A win counts when you finish first in a completed match with at least 2 entrants.',
    ].join('\n'),
  },
  {
    id: 'cricsense',
    title: 'About CricSense',
    text: [
      'CricSense is the cricket assistant in Striker.',
      'It answers from live match data (scores, scorecards, squads), ball-by-ball commentary, player career stats, match results it has recorded, and these app rules.',
      'It does not predict results or give win probabilities, because there is no verified model behind such numbers; instead it shows the live situation and real past results.',
    ].join('\n'),
  },
];
