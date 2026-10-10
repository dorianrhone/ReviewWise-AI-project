
require("dotenv").config();

const express = require("express");
const path = require("path");

// Import Gemini AI functions
const {
    analyzeReviews,
    answerQuestion
} = require("./services/gemini");

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Allow incoming JSON data
app.use(express.json({ limit: "100kb" }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Display the frontend homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Backend health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "ReviewWise AI backend is running!"
    });
});

// Analyze customer reviews using Gemini AI
app.post("/api/analyze", async (req, res) => {
    try {
        const { reviews, businessName } = req.body || {};

        // Validate customer reviews
        if (typeof reviews !== "string" || !reviews.trim()) {
            return res.status(400).json({
                error: "Please enter customer reviews."
            });
        }

        // Send reviews to Gemini AI
        const summary = await analyzeReviews(
            reviews,
            typeof businessName === "string" && businessName.trim()
                ? businessName.trim()
                : "this business"
        );

        // Return Gemini analysis to frontend
        res.json({
            summary: summary
        });

    } catch (error) {
        console.error("Review analysis error:", error);

        res.status(500).json({
            error: "Unable to analyze reviews. Please try again."
        });
    }
});

// Answer follow-up questions using Gemini AI
app.post("/api/chat", async (req, res) => {
    try {
        const { reviews, question } = req.body || {};

        // Validate reviews and question
        if (
            typeof reviews !== "string" ||
            !reviews.trim() ||
            typeof question !== "string" ||
            !question.trim()
        ) {
            return res.status(400).json({
                error: "Reviews and a question are required."
            });
        }

        // Send question and reviews to Gemini AI
        const answer = await answerQuestion(
            reviews,
            question
        );

        // Return Gemini answer to frontend
        res.json({
            answer: answer
        });

    } catch (error) {
        console.error("Chatbot error:", error);

        res.status(500).json({
            error: "Unable to answer your question. Please try again."
        });
    }
});

// Start backend server
app.listen(PORT, () => {
    console.log(`ReviewWise AI running at http://localhost:${PORT}`);
});
