const reviews = document.getElementById("reviews");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const analyze = document.getElementById("analyze");
const ask = document.getElementById("ask");
const activeTierName = document.getElementById("active-tier-name");

// SECURITY ENFORCEMENT: Check if user completed a valid paid checkout. 
// If they left the app or didn't pay, default back strictly to 'free'.
const isPaidActive = localStorage.getItem("reviewWisePaidStatus") === "active";
let currentTier = localStorage.getItem("reviewWiseTier");

if (!isPaidActive || (currentTier !== "pro" && currentTier !== "advanced")) {
  currentTier = "free";
  localStorage.setItem("reviewWiseTier", "free");
  localStorage.removeItem("reviewWisePaidStatus");
}

// Display current tier status badge on load
document.addEventListener("DOMContentLoaded", () => {
  const tierLabels = {
    free: "Free Tier ($0/mo)",
    pro: "Pro Tier ($5.99/mo)",
    advanced: "Advanced Tier ($11.99/mo)"
  };
  if (activeTierName) {
    activeTierName.textContent = tierLabels[currentTier] || "Free Tier ($0/mo)";
  }
});

function setBusy(busy, message = "Working...") {
  if (analyze) analyze.disabled = busy;
  if (ask) ask.disabled = busy;
  if (busy && answer) answer.textContent = message;
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

if (analyze) {
  analyze.addEventListener("click", async () => {
    const text = reviews.value.trim();
    if (!text) {
      answer.textContent = "Please paste reviews first.";
      return;
    }
    setBusy(true, `Analyzing reviews using ${currentTier.toUpperCase()} model...`);
    try {
      const data = await postJSON("/api/analyze", {
        reviews: text,
        tier: currentTier
      });
      answer.textContent = data.summary || "No summary returned.";
    } catch (error) {
      answer.textContent = `Error: ${error.message}`;
    } finally {
      setBusy(false);
    }
  });
}

if (ask) {
  ask.addEventListener("click", async () => {
    const text = reviews.value.trim();
    const q = question.value.trim();
    if (!text || !q) {
      answer.textContent = "Enter reviews and a question first.";
      return;
    }
    setBusy(true, `Asking Gemini (${currentTier.toUpperCase()})...`);
    try {
      const data = await postJSON("/api/chat", {
        reviews: text,
        question: q,
        tier: currentTier
      });
      answer.textContent = data.answer || "No answer returned.";
    } catch (error) {
      answer.textContent = `Error: ${error.message}`;
    } finally {
      setBusy(false);
    }
  });
}