
require("dotenv").config();

async function testAPIKey() {
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
            headers: {
                "x-goog-api-key": process.env.GEMINI_API_KEY
            }
        }
    );

    console.log("HTTP status:", response.status);

    if (response.ok) {
        console.log("SUCCESS! Google accepted the API key.");
    } else {
        const error = await response.text();
        console.log("Error:", error);
    }
}

testAPIKey().catch(console.error);
