const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/match');

const upcomingMatches = [
  {
    matchId: 'upcoming-ind-aus-2026',
    teamA: 'India',
    teamB: 'Australia',
    teamALogo: 'https://g.cricapi.com/iapi/2-637877073238914614.webp?w=48',
    teamBLogo: 'https://g.cricapi.com/iapi/3-637877073400262100.webp?w=48',
    scoreA: '0/0 (0)',
    scoreB: '0/0 (0)',
    status: 'Starts Tomorrow at 19:30 GMT • Toss in 18 hrs',
    matchStarted: false,
    matchEnded: false,
    venue: 'Wankhede Stadium, Mumbai',
    date: '2026-09-02T19:30:00Z',
    matchType: 'T20 International',
    squadFetched: true,
    squadA: [
      'Rohit Sharma (c)', 'Yashasvi Jaiswal', 'Virat Kohli', 'Suryakumar Yadav (vc)',
      'Rishabh Pant (wk)', 'Hardik Pandya', 'Ravindra Jadeja', 'Axar Patel',
      'Kuldeep Yadav', 'Jasprit Bumrah', 'Mohammed Siraj', 'Arshdeep Singh',
      'Sanju Samson (wk)', 'Shivam Dube', 'Yuzvendra Chahal'
    ],
    squadB: [
      'Mitchell Marsh (c)', 'Travis Head', 'David Warner', 'Glenn Maxwell (vc)',
      'Marcus Stoinis', 'Tim David', 'Matthew Wade (wk)', 'Pat Cummins',
      'Mitchell Starc', 'Adam Zampa', 'Josh Hazlewood', 'Nathan Ellis',
      'Josh Inglis (wk)', 'Cameron Green', 'Ashton Agar'
    ]
  },
  {
    matchId: 'upcoming-eng-sa-2026',
    teamA: 'England',
    teamB: 'South Africa',
    teamALogo: 'https://g.cricapi.com/iapi/23-637877072894080569.webp?w=48',
    teamBLogo: 'https://g.cricapi.com/iapi/4-637877073550389332.webp?w=48',
    scoreA: '0/0 (0)',
    scoreB: '0/0 (0)',
    status: 'Scheduled for Friday • Fantasy Room Active',
    matchStarted: false,
    matchEnded: false,
    venue: "Lord's, London",
    date: '2026-09-04T15:00:00Z',
    matchType: 'ODI Series',
    squadFetched: true,
    squadA: [
      'Jos Buttler (c)(wk)', 'Phil Salt', 'Will Jacks', 'Harry Brook (vc)',
      'Liam Livingstone', 'Sam Curran', 'Moeen Ali', 'Chris Woakes',
      'Jofra Archer', 'Adil Rashid', 'Mark Wood', 'Reece Topley',
      'Jonny Bairstow', 'Ben Duckett', 'Gus Atkinson'
    ],
    squadB: [
      'Aiden Markram (c)', 'Quinton de Kock (wk)', 'Reeza Hendricks', 'Heinrich Klaasen',
      'David Miller (vc)', 'Tristan Stubbs', 'Marco Jansen', 'Keshav Maharaj',
      'Kagiso Rabada', 'Anrich Nortje', 'Tabraiz Shamsi', 'Lungi Ngidi',
      'Ryan Rickelton (wk)', 'Ottneil Baartman', 'Bjorn Fortuin'
    ]
  },
  {
    matchId: 'upcoming-wi-pak-2026',
    teamA: 'West Indies',
    teamB: 'Pakistan',
    teamALogo: 'https://g.cricapi.com/iapi/7-637877074026362544.webp?w=48',
    teamBLogo: 'https://g.cricapi.com/iapi/66-637877075103236690.webp?w=48',
    scoreA: '0/0 (0)',
    scoreB: '0/0 (0)',
    status: 'Registration Open • 24 hrs to start',
    matchStarted: false,
    matchEnded: false,
    venue: 'Kensington Oval, Bridgetown, Barbados',
    date: '2026-09-05T18:00:00Z',
    matchType: 'T20 World Clash',
    squadFetched: true,
    squadA: [
      'Rovman Powell (c)', 'Brandon King', 'Johnson Charles', 'Nicholas Pooran (wk)',
      'Shimron Hetmyer', 'Andre Russell (vc)', 'Romario Shepherd', 'Roston Chase',
      'Akeal Hosein', 'Alzarri Joseph', 'Gudakesh Motie', 'Shamar Joseph',
      'Shai Hope (wk)', 'Sherfane Rutherford', 'Obed McCoy'
    ],
    squadB: [
      'Babar Azam (c)', 'Mohammad Rizwan (wk)', 'Saim Ayub', 'Fakhar Zaman',
      'Usman Khan', 'Iftikhar Ahmed', 'Shadab Khan (vc)', 'Imad Wasim',
      'Shaheen Shah Afridi', 'Naseem Shah', 'Haris Rauf', 'Mohammad Amir',
      'Azam Khan (wk)', 'Abbas Afridi', 'Abrar Ahmed'
    ]
  }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore')
  .then(async () => {
    console.log('Connected to MongoDB.');
    for (const matchData of upcomingMatches) {
      await Match.findOneAndUpdate(
        { matchId: matchData.matchId },
        matchData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Seeded upcoming match: ${matchData.teamA} vs ${matchData.teamB} (${matchData.matchId})`);
    }
    console.log('Finished seeding upcoming matches.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
