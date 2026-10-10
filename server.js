require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Allow incoming JSON data
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Backend health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "ReviewWise AI backend is running!"
    });
});


 // Analyze customer reviews
app.post("/api/analyze", async (req, res) => {
    try {
        const { reviews } = req.body;

        if (typeof reviews !== "string" || !reviews.trim()) {
            return res.status(400).json({
                error: "Please enter customer reviews."
            });
        }

        // Temporary test response
        res.json({
            summary: "Customers enjoy the food but mention slow service.",
            positives: ["Good food", "Friendly employees"],
            negatives: ["Slow service"],
            recommendations: ["Improve service speed"]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong analyzing reviews."
        });
    }
});

// Answer follow-up questions
app.post("/api/chat", async (req, res) => {
    try {
        const { reviews, question } = req.body;

        if (
            typeof reviews !== "string" || !reviews.trim() ||
            typeof question !== "string" || !question.trim()
        ) {
            return res.status(400).json({
                error: "Reviews and a question are required."
            });
        }

        // Temporary test response
        res.json({
            answer: "Based on the reviews, improving service speed should be the priority."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong answering the question."
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});