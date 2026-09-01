const { generateCricSenseResponse } = require('./services/cricSenseRAG');
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore');
  console.log('Connected to MongoDB.\n');

  const prompts = [
    "which team have higher chance to win in match between pakistan vs england test",
    "who will win india vs australia at wankhede",
    "best fantasy captain for west indies vs pakistan",
    "how will pitch play at lord's london",
    "tactical breakdown of south africa vs england odi"
  ];

  for (let i = 0; i < prompts.length; i++) {
    console.log(`==================== PROMPT ${i + 1} ====================`);
    console.log(`Prompt: "${prompts[i]}"`);
    const res = await generateCricSenseResponse(prompts[i], null, null);
    console.log('\nRetrieved Context:', res.retrievedContext);
    console.log('\nGenerated Reply:');
    console.log(res.reply);
    console.log('\n');
  }

  process.exit(0);
}

run().catch(console.error);
