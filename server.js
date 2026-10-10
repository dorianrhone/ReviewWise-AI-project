
require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(express.json());
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  try {
    const { reviews, question } = req.body;

    if (!reviews || !question) {
      return res.status(400).json({
        error: "Reviews and a question are required."
      });
    }

    const prompt = `
You are an AI assistant for small business owners.

Analyze the following customer reviews.
Only use information supported by the reviews.
Do not invent complaints, statistics, or facts.

Customer reviews:
${reviews}

Business owner's question:
${question}

Give a concise, practical answer.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });

    res.json({ answer: response.text });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to analyze reviews."
    });
  }
});

app.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
