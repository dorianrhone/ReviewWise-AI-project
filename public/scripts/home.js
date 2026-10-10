const reviews = document.getElementById("reviews");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const analyze = document.getElementById("analyze");
const ask = document.getElementById("ask");

function setBusy(busy, message = "Working...") {
  analyze.disabled = busy;
  ask.disabled = busy;
  if (busy) answer.textContent = message;
}

async function postJSON(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

analyze.addEventListener("click", async () => {
  const text = reviews.value.trim();
  if (!text) {
    answer.textContent = "Please paste reviews first.";
    return;
  }
  setBusy(true, "Analyzing reviews...");
  try {
    const data = await postJSON("/api/analyze", {
      reviews: text
    });
    const list = (value) =>
      Array.isArray(value) ? value.join("\n") : "None listed";
    
    answer.textContent = 
      `SUMMARY\n${data.summary || "No summary"}\n\n` +
      `POSITIVES\n- ${list(data.positives)}\n\n` +
      `NEGATIVES\n- ${list(data.negatives)}\n\n` +
      `RECOMMENDATIONS\n- ${list(data.recommendations)}`;
  } catch (error) {
    answer.textContent = `Error: ${error.message}`;
  } finally {
    setBusy(false);
  }
});

ask.addEventListener("click", async () => {
  const text = reviews.value.trim();
  const q = question.value.trim();
  if (!text || !q) {
    answer.textContent = "Enter reviews and a question first.";
    return;
  }
  setBusy(true, "Asking Gemini...");
  try {
    const data = await postJSON("/api/chat", {
      reviews: text,
      question: q
    });
    answer.textContent = data.answer || "No answer returned.";
  } catch (error) {
    answer.textContent = `Error: ${error.message}`;
  } finally {
    setBusy(false);
  }
});