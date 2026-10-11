const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-input");
const welcomeContainer = document.getElementById("welcome-container");
const chatHistoryList = document.getElementById("chat-history-list");
const activeTierName = document.getElementById("active-tier-name");
const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");
const userEmailDisplay = document.getElementById("user-email-display");

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

// Define Tier Limits (Chats per week)
const TIER_LIMITS = {
  free: 10,
  pro: 50,
  advanced: 100
};

let currentConversation = []; // Array of {role: 'user' | 'assistant', content: string}
let activeSessionId = null;

document.addEventListener("DOMContentLoaded", () => {
  updateTierBadgeUI();

  if (isLoggedIn) {
    if (loggedOutView) loggedOutView.style.display = "none";
    if (loggedInView) loggedInView.style.display = "block";
    if (userEmailDisplay) userEmailDisplay.textContent = savedEmail;
  } else {
    if (loggedOutView) loggedOutView.style.display = "block";
    if (loggedInView) loggedInView.style.display = "none";
  }

  loadChatHistoryUI();
  renderChat();
});

// Manage weekly usage count & window reset (7-day window)
function getWeeklyUsage() {
  const usageData = JSON.parse(localStorage.getItem("reviewWiseUsage") || "{}");
  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  if (!usageData.startTime || (now - usageData.startTime > ONE_WEEK_MS)) {
    const newUsage = { count: 0, startTime: now };
    localStorage.setItem("reviewWiseUsage", JSON.stringify(newUsage));
    return newUsage;
  }

  return usageData;
}

function incrementWeeklyUsage() {
  const usageData = getWeeklyUsage();
  usageData.count += 1;
  localStorage.setItem("reviewWiseUsage", JSON.stringify(usageData));
  updateTierBadgeUI();
}

function updateTierBadgeUI() {
  if (!activeTierName) return;
  const usage = getWeeklyUsage();
  const limit = TIER_LIMITS[currentTier] || 10;
  
  const tierLabels = {
    free: "Free Tier ($0/mo)",
    pro: "Pro Tier ($5.99/mo)",
    advanced: "Advanced Tier ($11.99/mo)"
  };

  activeTierName.innerHTML = `${tierLabels[currentTier] || "Free Tier"}<br>` +
    `<span style="font-size: 11px; color: #9ca3af; font-weight: normal;">` +
    `Usage: ${usage.count} / ${limit} chats this week</span>`;
}

function loadSuggestion(text) {
  if (chatInput) {
    chatInput.value = text;
    chatInput.focus();
  }
}

function startNewChat() {
  saveCurrentChatToHistory();
  currentConversation = [];
  activeSessionId = Date.now();
  renderChat();
}

function saveCurrentChatToHistory() {
  if (currentConversation.length === 0) return;
  
  let history = JSON.parse(localStorage.getItem("reviewWiseChatHistory") || "[]");
  const firstUserMsg = currentConversation.find(m => m.role === 'user');
  const titleSnippet = firstUserMsg ? firstUserMsg.content.substring(0, 30) + '...' : 'Conversation';

  const sessionObj = {
    id: activeSessionId || Date.now(),
    title: titleSnippet,
    messages: currentConversation
  };

  const existingIdx = history.findIndex(item => item.id === sessionObj.id);
  if (existingIdx >= 0) {
    history[existingIdx] = sessionObj;
  } else {
    history.unshift(sessionObj);
  }

  if (history.length > 15) history.pop();

  localStorage.setItem("reviewWiseChatHistory", JSON.stringify(history));
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
      activeSessionId = item.id;
      currentConversation = item.messages;
      renderChat();
    };
    chatHistoryList.appendChild(div);
  });
}

function renderChat() {
  if (!chatFeed) return;
  chatFeed.innerHTML = "";

  if (currentConversation.length === 0) {
    if (welcomeContainer) welcomeContainer.style.display = "block";
    return;
  }

  if (welcomeContainer) welcomeContainer.style.display = "none";

  currentConversation.forEach(msg => {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${msg.role}`;

    if (msg.role === 'user') {
      msgDiv.innerHTML = `<div class="message-bubble">${escapeHtml(msg.content)}</div>`;
    } else {
      msgDiv.innerHTML = `
        <div class="message-content">${formatAssistantContent(msg.content)}</div>
        <div class="message-actions">
          <button class="action-btn" title="Copy" onclick="copyText(this)">📋</button>
          <button class="action-btn" title="Dislike">👎</button>
          <button class="action-btn" title="Share">📤</button>
          <button class="action-btn" title="Read Aloud">🔊</button>
          <button class="action-btn" title="Regenerate">🔄</button>
        </div>`;
    }
    chatFeed.appendChild(msgDiv);
  });

  chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Enforce tier weekly chat limit
  const usage = getWeeklyUsage();
  const limit = TIER_LIMITS[currentTier] || 10;

  if (usage.count >= limit) {
    alert(`You have reached your limit of ${limit} chats for this week on the ${currentTier.toUpperCase()} tier. Please upgrade your plan in Pricing to continue!`);
    return;
  }

  if (!activeSessionId) {
    activeSessionId = Date.now();
  }

  // Append user message
  currentConversation.push({ role: 'user', content: text });
  chatInput.value = "";
  renderChat();

  // Temporary indicator
  currentConversation.push({ role: 'assistant', content: `Thinking (${currentTier.toUpperCase()})...` });
  renderChat();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviews: currentConversation.map(m => `${m.role}: ${m.content}`).join("\n"),
        question: text,
        tier: currentTier
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");

    currentConversation[currentConversation.length - 1] = { role: 'assistant', content: data.answer || "No response." };
    incrementWeeklyUsage();
  } catch (error) {
    currentConversation[currentConversation.length - 1] = { role: 'assistant', content: `Error: ${error.message}` };
  }

  renderChat();
  saveCurrentChatToHistory();
}

function logout() {
  localStorage.removeItem("reviewWiseLoggedIn");
  localStorage.removeItem("reviewWiseUserEmail");
  window.location.reload();
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatAssistantContent(text) {
  return text.split("\n").map(line => `<p>${escapeHtml(line)}</p>`).join("");
}

function copyText(btn) {
  const content = btn.closest('.chat-message').querySelector('.message-content').innerText;
  navigator.clipboard.writeText(content);
  btn.textContent = "✓";
  setTimeout(() => btn.textContent = "📋", 1500);
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}