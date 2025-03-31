require("dotenv").config();
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY); // Debugging

const axios = require("axios");

const GEMINI_LIST_MODELS_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`;

async function listModels() {
  try {
    const response = await axios.get(GEMINI_LIST_MODELS_ENDPOINT);
    console.log("✅ Available Models:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error fetching models:", error?.response?.data || error.message);
  }
}

listModels();
