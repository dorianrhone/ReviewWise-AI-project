require("dotenv").config();
const { analyzeReviews } = require("./services/gemini");
(async () => {
 const reviews = `
Great food and friendly staff.
The pasta was excellent but service was slow.
Nice atmosphere, but we waited 30 minutes.
 `;
 console.log(await analyzeReviews(reviews, "Demo Cafe"));
})().catch(console.error);

const { answerQuestion } = require("./services/gemini");

async function testChat() {
    const reviews = `
    Great food and friendly staff.
    The pasta was excellent but service was slow.
    Nice atmosphere, but we waited 30 minutes.
    `;

    const answer = await answerQuestion(
        reviews,
        "What should the restaurant improve first?"
    );

    console.log(answer);
}

testChat().catch(console.error);