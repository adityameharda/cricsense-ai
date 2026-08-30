const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/match');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB.");
    const m = await Match.findOne({ teamA: /Tanzania/i });
    if (m) {
        m.squadA = [
            "Fatuma Kibasu (c)", "Saum Mtae", "Neema Pius", "Hudaa Omary", "Perice Kamunya",
            "Shufaa Mohamedi", "Aisha Mohamed", "Agnes Qwele", "Sophia Jerome", "Mwapwani Mohamedi",
            "Sheila Shamte", "Josephine Ulrik"
        ];
        m.squadB = [
            "Consylate Aweko (c)", "Janet Mbabazi", "Kevin Awino", "Proscovia Alako", "Irene Alumo",
            "Lorna Anyait", "Evelyn Anyipo", "Malisa Ariokot", "Phiona Kulume", "Patricia Malemikia",
            "Rita Musamali", "Immaculate Nakisuuyi"
        ];
        await m.save();
        console.log("Updated match:", m.matchId);
    }
    process.exit(0);
});
