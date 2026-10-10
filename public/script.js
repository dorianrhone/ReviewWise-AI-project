const reviews = document.getElementById("reviews");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const analyze = document.getElementById("analyze");
const ask = document.getElementById("ask");

async function sendQuestion(text) {
  analyze.disabled = true;
  ask.disabled = true;
  answer.textContent = "Analyzing reviews...";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews: reviews.value, question: text })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    answer.textContent = data.answer;
  } catch (error) {
    answer.textContent = `Error: ${error.message}`;
  } finally {
    analyze.disabled = false;
    ask.disabled = false;
  }
}

analyze.addEventListener("click", () =>
  sendQuestion("Summarize praise, complaints, and next steps.")
);

ask.addEventListener("click", () =>
  sendQuestion(question.value.trim() || "Summarize the reviews.")
);