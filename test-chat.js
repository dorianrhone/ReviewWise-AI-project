
require("dotenv").config();

const { answerQuestion } = require("./services/gemini");

async function testChat() {
    const reviews = `
    Great food and friendly staff.
    The pasta was excellent but service was slow.
    Nice atmosphere, but we waited 30 minutes.
    `;

    console.log("Testing Gemini chatbot...");

    const answer = await answerQuestion(
        reviews,
        "What should the restaurant improve first?"
    );

    console.log(answer);
}

testChat().catch((error) => {
    console.error("Status:", error.status);
    console.error("Message:", error.message);
});
