
require("dotenv").config();

const {
    analyzeReviews,
    answerQuestion
} = require("./services/gemini");

async function testGemini() {

    const reviews = `
    Great food and friendly staff.
    The pasta was excellent but service was slow.
    Nice atmosphere, but we waited 30 minutes.
    `;

    // TEST 1: Review Analysis
    console.log("\n===== TEST 1: REVIEW ANALYSIS =====");

    const summary = await analyzeReviews(
        reviews,
        "Demo Cafe"
    );

    console.log(summary);

    // TEST 2: Chatbot
    console.log("\n===== TEST 2: CHATBOT =====");

    const answer = await answerQuestion(
        reviews,
        "What should the restaurant improve first?"
    );

    console.log(answer);

    console.log("\n===== BOTH TESTS COMPLETED =====");
}

testGemini().catch(console.error);
