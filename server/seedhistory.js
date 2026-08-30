require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match'); // Ensure path is correct

const historyData = [
  {
    matchId: "ipl_srh_rcb",
    teamA: "Sunrisers Hyderabad",
    teamB: "Royal Challengers Bengaluru",
    scoreA: "187/6 (20.0)",
    scoreB: "162/9 (20.0)",
    status: "Final",
    matchStarted: true,
    matchEnded: true,
    venue: "M. Chinnaswamy Stadium, Bengaluru",
    date: "10 August 2026",
    squadA: [
      "Pat Cummins (C)", "Abhishek Sharma", "Travis Head", "Heinrich Klaasen", "Nitish Kumar Reddy", 
      "Abdul Samad", "Shahbaz Ahmed", "Mayank Markande", "Bhuvneshwar Kumar", "T Natarajan", 
      "Jaydev Unadkat", "Umran Malik", "Aiden Markram", "Marco Jansen", "Rahul Tripathi", 
      "Mayank Agarwal", "Glenn Phillips", "Washington Sundar", "Upendra Yadav", "Sanvir Singh", 
      "Anmolpreet Singh", "Akash Singh", "Fazalhaq Farooqi", "Jhathavedh Subramanyan", "Vijayakanth Viyaskanth"
    ],
    squadB: [
      "Faf du Plessis (C)", "Virat Kohli", "Rajat Patidar", "Glenn Maxwell", "Cameron Green", 
      "Will Jacks", "Dinesh Karthik", "Mahipal Lomror", "Karn Sharma", "Mohammed Siraj", 
      "Yash Dayal", "Reece Topley", "Lockie Ferguson", "Tom Curran", "Alzarri Joseph", 
      "Anuj Rawat", "Saurav Chauhan", "Akash Deep", "Vijaykumar Vyshak", "Rajan Kumar", 
      "Himanshu Sharma", "Mayank Dagar", "Swapnil Singh", "Manoj Bhandage", "Suyash Prabhudessai"
    ]
  },
  {
    matchId: "ipl_mi_kkr",
    teamA: "Mumbai Indians",
    teamB: "Kolkata Knight Riders",
    scoreA: "45/2 (5.2)",
    scoreB: "0/0 (0)",
    status: "Live - 1st Inning",
    matchStarted: true,
    matchEnded: false,
    venue: "Wankhede Stadium, Mumbai",
    date: "10 August 2026",
    squadA: [
      "Hardik Pandya (C)", "Rohit Sharma", "Suryakumar Yadav", "Jasprit Bumrah", "Ishan Kishan", 
      "Tilak Varma", "Tim David", "Gerald Coetzee", "Piyush Chawla", "Mohammad Nabi", 
      "Nuwan Thushara", "Romario Shepherd", "Nehal Wadhera", "Akash Madhwal", "Dewald Brevis", 
      "Naman Dhir", "Shreyas Gopal", "Kumar Kartikeya", "Luke Wood", "Kwena Maphaka"
    ],
    squadB: ["Shreyas Iyer (C)", "Sunil Narine", "Andre Russell", "Phil Salt", "Rinku Singh", "Venkatesh Iyer", "Ramandeep Singh", "Mitchell Starc", "Varun Chakaravarthy", "Harshit Rana", "Vaibhav Arora"]
  },
  {
    matchId: "ipl_csk_rr",
    teamA: "Chennai Super Kings",
    teamB: "Rajasthan Royals",
    scoreA: "0/0 (0)",
    scoreB: "0/0 (0)",
    status: "Upcoming - Tomorrow",
    matchStarted: false,
    matchEnded: false,
    venue: "M. A. Chidambaram Stadium, Chennai",
    date: "11 August 2026",
    squadA: [
      "Ruturaj Gaikwad (C)", "MS Dhoni", "Ravindra Jadeja", "Shivam Dube", "Matheesha Pathirana", 
      "Daryl Mitchell", "Rachin Ravindra", "Sameer Rizvi", "Deepak Chahar", "Maheesh Theekshana", 
      "Shardul Thakur", "Devon Conway", "Mitchell Santner", "Mustafizur Rahman", "Tushar Deshpande", 
      "Ajinkya Rahane", "Shaik Rasheed", "Nishant Sindhu", "Mukesh Choudhary", "Simarjeet Singh"
    ],
    squadB: ["Sanju Samson (C)", "Yashasvi Jaiswal", "Jos Buttler", "Riyan Parag", "Dhruv Jurel", "Shimron Hetmyer", "Rovman Powell", "Ravichandran Ashwin", "Trent Boult", "Avesh Khan", "Yuzvendra Chahal"]
  },
  {
    matchId: "ipl_dc_gt",
    teamA: "Delhi Capitals",
    teamB: "Gujarat Titans",
    scoreA: "0/0 (0)",
    scoreB: "0/0 (0)",
    status: "Upcoming",
    venue: "Arun Jaitley Stadium, Delhi",
    date: "11 August 2026",
    squadA: ["Rishabh Pant (C)", "David Warner", "Prithvi Shaw", "Jake Fraser-McGurk", "Tristan Stubbs", "Axar Patel", "Kuldeep Yadav", "Anrich Nortje", "Khaleel Ahmed", "Mukesh Kumar", "Ishant Sharma"],
    squadB: ["Shubman Gill (C)", "Sai Sudharsan", "David Miller", "Kane Williamson", "Azmatullah Omarzai", "Rahul Tewatia", "Rashid Khan", "Mohit Sharma", "Noor Ahmad", "Umesh Yadav", "Spencer Johnson"]
  }
];

// Connection Logic
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore')
  .then(async () => {
    console.log("Connected to MongoDB. Wiping old (Cricket) matches...");
    // 1. Delete all old matches
    await Match.deleteMany({});
    console.log("Old matches deleted.");
    
    // 2. Insert new Cricket matches
    await Match.insertMany(historyData);
    console.log("✅ 2026 IPL Match Database Restored & Updated!");
    
    process.exit();
}).catch(err => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
});