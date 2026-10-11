const reviews = document.getElementById("reviews");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const analyze = document.getElementById("analyze");
const ask = document.getElementById("ask");
const activeTierName = document.getElementById("active-tier-name");
const chatHistoryList = document.getElementById("chat-history-list");
const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");
const userEmailDisplay = document.getElementById("user-email-display");
const quickLoginEmail = document.getElementById("quick-login-email");

// Check Authentication State
const isLoggedIn = localStorage.getItem("reviewWiseLoggedIn") === "true";
const savedEmail = localStorage.getItem("reviewWiseUserEmail") || "";

// Security Check: Verify paid subscription state
const isPaidActive = localStorage.getItem("reviewWisePaidStatus") === "active";
let currentTier = localStorage.getItem("reviewWiseTier");

if (!isPaidActive || (currentTier !== "pro" && currentTier !== "advanced")) {
  currentTier = "free";
  localStorage.setItem("reviewWiseTier", "free");
  localStorage.removeItem("reviewWisePaidStatus");
}

document.addEventListener("DOMContentLoaded", () => {
  const tierLabels = {
    free: "Free Tier ($0/mo)",
    pro: "Pro Tier ($5.99/mo)",
    advanced: "Advanced Tier ($11.99/mo)"
  };
  if (activeTierName) {
    activeTierName.textContent = tierLabels[currentTier] || "Free Tier ($0/mo)";
  }

  // Toggle auth display views in sidebar
  if (isLoggedIn) {
    if (loggedOutView) loggedOutView.style.display = "none";
    if (loggedInView) loggedInView.style.display = "block";
    if (userEmailDisplay) userEmailDisplay.textContent = savedEmail;
  } else {
    if (loggedOutView) loggedOutView.style.display = "block";
    if (loggedInView) loggedInView.style.display = "none";
  }

  loadChatHistoryUI();
});

function quickLogin() {
  const emailVal = quickLoginEmail ? quickLoginEmail.value.trim() : "";
  if (!emailVal) {
    alert("Please enter a valid email address.");
    return;
  }
  localStorage.setItem("reviewWiseLoggedIn", "true");
  localStorage.setItem("reviewWiseUserEmail", emailVal);
  window.location.reload();
}

function logout() {
  localStorage.removeItem("reviewWiseLoggedIn");
  localStorage.removeItem("reviewWiseUserEmail");
  window.location.reload();
}

function startNewChat() {
  if (reviews) reviews.value = "";
  if (question) question.value = "";
  if (answer) answer.textContent = "Results will appear here...";
  localStorage.removeItem("reviewWiseActiveSession");
}

function loadSuggestion(text) {
  if (reviews) {
    reviews.value = text;
    reviews.focus();
  }
}

function saveCurrentChatToHistory(summaryText) {
  let history = JSON.parse(localStorage.getItem("reviewWiseChatHistory") || "[]");
  const reviewSnippet = reviews.value.trim().substring(0, 30) || "Review Analysis";
  const sessionItem = {
    id: Date.now(),
    title: `Analysis: ${reviewSnippet}...`,
    reviewsText: reviews.value,
    answerText: summaryText
  };
  
  history.unshift(sessionItem);
  if (history.length > 10) history.pop();
  
  localStorage.setItem("reviewWiseChatHistory", JSON.stringify(history));
  localStorage.setItem("reviewWiseActiveSession", JSON.stringify(sessionItem));
  loadChatHistoryUI();
}

function loadChatHistoryUI() {
  if (!chatHistoryList) return;
  const history = JSON.parse(localStorage.getItem("reviewWiseChatHistory") || "[]");
  chatHistoryList.innerHTML = "";

  if (history.length === 0) {
    chatHistoryList.innerHTML = `<div style="font-size: 12px; color: #737373; padding: 8px;">No saved chats yet.</div>`;
    return;
  }

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.textContent = item.title;
    div.onclick = () => {
      reviews.value = item.reviewsText;
      answer.textContent = item.answerText;
    };
    chatHistoryList.appendChild(div);
  });
}

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
      const resultSummary = data.summary || "No summary returned.";
      answer.textContent = resultSummary;
      saveCurrentChatToHistory(resultSummary);
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
      const resultAnswer = data.answer || "No answer returned.";
      answer.textContent = resultAnswer;
      saveCurrentChatToHistory(resultAnswer);
    } catch (error) {
      answer.textContent = `Error: ${error.message}`;
    } finally {
      setBusy(false);
    }
  });
}