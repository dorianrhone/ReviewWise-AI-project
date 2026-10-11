
require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Import Gemini AI functions
const {
    analyzeReviews,
    answerQuestion
} = require("./services/gemini");

const { requireAuth } = require("./middleware/auth");

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


// Test Supabase authentication
app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            email: req.user.email
        }
    });
});


// Get the authenticated user's subscription
app.get("/api/subscription", requireAuth, async (req, res) => {
    try {
        // Create a Supabase client using the user's token
        // so Row Level Security applies to their account.
        const userSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_PUBLISHABLE_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${req.accessToken}`
                    }
                },
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Read subscription from PostgreSQL
        const { data, error } = await userSupabase
            .from("subscriptions")
            .select("tier")
            .eq("user_id", req.user.id)
            .single();

        if (error) {
            throw error;
        }

        // Subscription limits
        const limits = {
            free: {
                chats: 10,
                prompts: 5
            },
            pro: {
                chats: 20,
                prompts: 10
            },
            advanced: {
                chats: 30,
                prompts: 15
            }
        };

        const tier = data.tier;

        if (!limits[tier]) {
            throw new Error("Invalid subscription tier.");
        }

        // Send subscription information to frontend
        res.json({
            tier: tier,
            chatsPerMonth: limits[tier].chats,
            promptsPerChat: limits[tier].prompts
        });

    } catch (error) {
        console.error("Subscription error:", error);

        res.status(500).json({
            error: "Unable to load subscription."
        });
    }
});

// Public Supabase configuration for browser authentication
app.get("/api/config", (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY
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
app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReviewWise AI server running on port ${PORT}`);
});