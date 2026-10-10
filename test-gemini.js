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