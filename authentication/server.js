require("dotenv").config();
console.log("MONGO_URI:", process.env.MONGO_URI ? "Loaded" : "Missing");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing"); // Debugging
//console.log("GEMINI_ENDPOINT:", process.env.GEMINI_ENDPOINT ? "Loaded" : "Missing");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: ["http://localhost:5000", "http://localhost:8100"], // Link the backend to the your frontend URL
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};
app.use(cors(corsOptions));

// Rate limiting (Limits 100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error("❌ MongoDB URI is missing! Check your .env file.");
  process.exit(1);
}
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// User Schema & Model
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ["admin", "editor", "user"], default: "user" },
});
const User = mongoose.model("User", UserSchema);

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET;

// **User Registration**
app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashedPassword, role });

  await user.save();
  res.json({ message: "User registered successfully!" });
});

// **User Login**
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ token });
});

// **Role-Based Access Control Middleware**
const authMiddleware = (roles) => (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Access denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!roles.includes(decoded.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// **Admin-only Route**
app.get("/admin", authMiddleware(["admin"]), (req, res) => {
  res.json({ message: "Welcome, Admin!" });
});

// **Get All Students**
app.get("/students", async (req, res) => {
  try {
    const students = await User.find({}, "name email"); // Adjust based on your schema
    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// **Get All Students**
app.get("/students", async (req, res) => {
  try {
    const students = await User.find({}, "name email");
    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// **Google Gemini API Configuration**
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "models/gemini-1.5-flash-002"; // Free model
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// **AI Chatbot API Endpoint**
app.post("/chat", async (req, res) => {
  console.log("Received request:", req.body); // Debugging log
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const response = await axios.post(GEMINI_ENDPOINT, {
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const aiResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
    res.json({ response: aiResponse });
  } catch (error) {
    console.error("❌ AI Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// **Start Server**
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



/*
// **Azure OpenAI & Cognitive Search Configuration**
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT;
/*const SEARCH_API_KEY = process.env.SEARCH_API_KEY;
const SEARCH_ENDPOINT = process.env.SEARCH_ENDPOINT;
const SEARCH_INDEX = process.env.SEARCH_INDEX;*/

// **Function to Query Cognitive Search**
/*async function searchDocuments(query) {
  const url = `${SEARCH_ENDPOINT}/indexes/${SEARCH_INDEX}/docs/search?api-version=2023-07-01-preview`;
  const response = await axios.post(
    url,
    { search: query },
    { headers: { "Content-Type": "application/json", "api-key": SEARCH_API_KEY } }
  );
  return response.data.value.map((doc) => doc.content).join("\n");
}

// **AI Chatbot API Endpoint**
app.post("/chat", async (req, res) => {
  try {
    const userQuery = req.body.message;
    //const retrievedDocs = await searchDocuments(userQuery);
    if (!userQuery) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const openaiResponse = await axios.post(
      /*`${OPENAI_ENDPOINT}/deployments/gpt-4-turbo/chat/completions?api-version=2024-02-01-preview`,
      {
        messages: [
          { role: "system", content: "You are an AI assistant using retrieved knowledge." },
          { role: "user", content: `${userQuery}\n\nContext:\n${retrievedDocs}` },
        ],
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" } }
    );
      `${OPENAI_ENDPOINT}`,
      {
        model: "gpt-3.5-turbo", // Or "gpt-4"
        messages: [{ role: "user", content: userQuery }],
      },
      {
        headers: { 
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ reply: openaiResponse.data.choices[0].message.content });
  } catch (error) {
    console.error("Chatbot API Error:", error?.response?.data || error.message);
    res.status(500).json({ error: "An error occurred while processing the request" });
  }
});

// **Start Server**
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
*/
