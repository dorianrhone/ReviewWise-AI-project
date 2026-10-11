const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-input");
const welcomeContainer = document.getElementById("welcome-container");
const chatHistoryList = document.getElementById("chat-history-list");
const activeTierName = document.getElementById("active-tier-name");
const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");
const userEmailDisplay = document.getElementById("user-email-display");
const sendButton = document.getElementById("send-btn");

let supabaseClient = null;
let currentUser = null;

let currentConversation = [];
let activeSessionId = null;
let savedConversations = [];
let isSending = false;

// ==========================================
// SUBSCRIPTION TIERS - MONTHLY DEMO LIMITS
// ==========================================

const TIER_LIMITS = {
    free: {
        name: "Free",
        price: 0,
        chats: 10,
        prompts: 5
    },
    pro: {
        name: "Pro",
        price: 5.99,
        chats: 20,
        prompts: 10
    },
    advanced: {
        name: "Advanced",
        price: 11.99,
        chats: 30,
        prompts: 15
    }
};

let currentTier = "free";

let monthlyUsage = {
    month: "",
    chats: 0
};

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeHomeAuth();
        await loadChatHistoryUI();
        renderChat();
        updateTierBadgeUI();
    } catch (error) {
        console.error("Application initialization error:", error);
    }
});

// ==========================================
// SIDEBAR TOGGLE & SHORTCUT
// ==========================================

const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const appLayout = document.querySelector(".app-layout");

function toggleSidebar() {
    if (appLayout) {
        appLayout.classList.toggle("sidebar-closed");
    }
}

if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", toggleSidebar);
}

// Global Keyboard Shortcut: Ctrl + Shift + S
document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleSidebar();
    }
});

// ==========================================
// SUPABASE AUTHENTICATION
// ==========================================

async function initializeHomeAuth() {
    try {
        const response = await fetch("/api/config");

        if (!response.ok) {
            throw new Error("Unable to load Supabase configuration.");
        }

        const config = await response.json();

        if (!window.supabase) {
            throw new Error("Supabase library is not loaded.");
        }

        supabaseClient = window.supabase.createClient(
            config.supabaseUrl,
            config.supabaseKey
        );

        const { data, error } =
            await supabaseClient.auth.getUser();

        if (error && error.code !== "session_not_found") {
            throw error;
        }

        currentUser = data?.user || null;

        if (currentUser) {
            loggedOutView.style.display = "none";
            loggedInView.style.display = "block";
            userEmailDisplay.textContent = currentUser.email;

            loadSubscriptionTier();
        } else {
            loggedOutView.style.display = "block";
            loggedInView.style.display = "none";
            currentTier = "free";
        }

        updateTierBadgeUI();

    } catch (error) {
        console.error("Authentication error:", error);

        currentUser = null;
        currentTier = "free";

        loggedOutView.style.display = "block";
        loggedInView.style.display = "none";

        updateTierBadgeUI();
    }
}

// ==========================================
// DEMO SUBSCRIPTION MANAGEMENT
// ==========================================


async function loadSubscriptionTier() {
    if (!currentUser || !supabaseClient) {
        currentTier = "free";
        monthlyUsage = { month: "", chats: 0 };
        updateTierBadgeUI();
        return;
    }

    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        throw new Error("Please sign in again.");
    }

    const response = await fetch("/api/subscription", {
        headers: {
            Authorization:
                `Bearer ${sessionData.session.access_token}`
        }
    });

    if (!response.ok) {
        throw new Error("Unable to load subscription.");
    }

    const subscription = await response.json();

    if (!TIER_LIMITS[subscription.tier]) {
        throw new Error("Invalid subscription tier.");
    }

    currentTier = subscription.tier;

    await loadMonthlyUsage();
    updateTierBadgeUI();
}


// ==========================================
// MONTHLY USAGE TRACKING
// ==========================================


function getMonthlyUsage() {
    return monthlyUsage;
}

async function loadMonthlyUsage() {
    if (!currentUser || !supabaseClient) {
        monthlyUsage = { month: "", chats: 0 };
        updateTierBadgeUI();
        return;
    }

    // Get current month in UTC
    const month = new Date().toISOString().slice(0, 7);
    const monthStart = `${month}-01`;

    const { data, error } = await supabaseClient
        .from("monthly_usage")
        .select("chats_used")
        .eq("user_id", currentUser.id)
        .eq("month", monthStart)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    monthlyUsage = {
        month,
        chats: data?.chats_used ?? 0
    };

    updateTierBadgeUI();
}


// ==========================================
// CHAT SUGGESTIONS
// ==========================================

function loadSuggestion(text) {
    if (!chatInput) return;

    chatInput.value = text;
    chatInput.focus();
}

// ==========================================
// CREATE NEW CHAT
// ==========================================

function startNewChat() {
    if (isSending) return;

    currentConversation = [];
    activeSessionId = null;

    renderChat();
    loadChatHistoryUI();
}

// ==========================================
// CREATE CONVERSATION IN SUPABASE
// ==========================================


async function createConversation(firstMessage) {
    if (!currentUser || !supabaseClient) {
        throw new Error("Please sign in first.");
    }

    const title =
        firstMessage.substring(0, 40) || "New Chat";

    // Create conversation through the Supabase quota function
    const { data, error } = await supabaseClient.rpc(
        "create_limited_conversation",
        {
            p_title: title
        }
    );

    if (error) {
        throw new Error(error.message);
    }

    // The database function returns the conversation UUID
    activeSessionId = data;

    await loadChatHistoryUI();

    return { id: data };
}


// ==========================================
// SAVE MESSAGE TO SUPABASE
// ==========================================

async function saveMessage(role, content, conversationId = activeSessionId) {
    if (!currentUser || !conversationId) {
        throw new Error("No active conversation.");
    }

    const { error } = await supabaseClient
        .from("messages")
        .insert({
            conversation_id: conversationId,
            role,
            content
        });

    if (error) throw error;
}

// ==========================================
// LOAD CHAT HISTORY
// ==========================================

async function loadChatHistoryUI() {
    if (!chatHistoryList) return;

    chatHistoryList.innerHTML = "";

    if (!currentUser || !supabaseClient) {
        chatHistoryList.textContent =
            "Sign in to access saved chats.";
        return;
    }

    const { data, error } = await supabaseClient
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Unable to load conversations:", error);
        chatHistoryList.textContent =
            "Unable to load saved chats.";
        return;
    }

    savedConversations = data || [];

    if (savedConversations.length === 0) {
        chatHistoryList.textContent =
            "No saved chats yet.";
        return;
    }

    savedConversations.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";

        if (item.id === activeSessionId) {
            div.style.background =
                "rgba(255, 255, 255, 0.05)";
        }

        const titleSpan = document.createElement("span");
        titleSpan.textContent = item.title;
        titleSpan.style.flex = "1";
        titleSpan.style.overflow = "hidden";
        titleSpan.style.textOverflow = "ellipsis";
        titleSpan.style.whiteSpace = "nowrap";
        titleSpan.style.cursor = "pointer";

        titleSpan.onclick = () => {
            if (!isSending) {
                openChatSession(item.id);
            }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Delete Chat";
        deleteBtn.style.background = "transparent";
        deleteBtn.style.border = "none";
        deleteBtn.style.color = "#9ca3af";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.padding = "2px 6px";

        deleteBtn.onclick = async event => {
            event.stopPropagation();

            if (!isSending) {
                await deleteChatSession(item.id);
            }
        };

        div.appendChild(titleSpan);
        div.appendChild(deleteBtn);
        chatHistoryList.appendChild(div);
    });
}

// ==========================================
// OPEN SAVED CONVERSATION
// ==========================================

async function openChatSession(id) {
    if (!currentUser || isSending) return;

    const { data, error } = await supabaseClient
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

    if (error) {
        console.error("Unable to open chat:", error);
        alert("Unable to load this conversation.");
        return;
    }

    activeSessionId = id;

    currentConversation = (data || []).map(message => ({
        role: message.role,
        content: message.content
    }));

    renderChat();
    await loadChatHistoryUI();
}

// ==========================================
// DELETE CONVERSATION
// ==========================================

async function deleteChatSession(id) {
    if (!currentUser || isSending) return;

    const confirmed = confirm(
        "Are you sure you want to delete this conversation?"
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

    if (error) {
        console.error("Delete error:", error);
        alert("Unable to delete conversation.");
        return;
    }

    if (activeSessionId === id) {
        activeSessionId = null;
        currentConversation = [];
        renderChat();
    }

    await loadChatHistoryUI();
}

// ==========================================
// RENDER CHAT MESSAGES
// ==========================================

function renderChat() {
    if (!chatFeed) return;

    chatFeed.innerHTML = "";

    if (currentConversation.length === 0) {
        if (welcomeContainer) {
            welcomeContainer.style.display = "block";
        }
        return;
    }

    if (welcomeContainer) {
        welcomeContainer.style.display = "none";
    }

    currentConversation.forEach(msg => {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-message ${msg.role}`;

        if (msg.role === "user") {
            msgDiv.innerHTML = `
                <div class="message-bubble">
                    ${escapeHtml(msg.content)}
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="message-content">
                    ${formatAssistantContent(msg.content)}
                </div>
                <div class="message-actions">
                    <button class="action-btn"
                        title="Copy"
                        onclick="copyText(this)">📋</button>
                    <button class="action-btn" title="Dislike">👎</button>
                    <button class="action-btn" title="Share">📤</button>
                    <button class="action-btn" title="Read Aloud">🔊</button>
                    <button class="action-btn" title="Regenerate">🔄</button>
                </div>
            `;
        }

        chatFeed.appendChild(msgDiv);
    });

    chatFeed.scrollTop = chatFeed.scrollHeight;
}

// ==========================================
// SEND MESSAGE TO GEMINI
// ==========================================

async function sendMessage() {
    if (isSending) return;

    const text = chatInput.value.trim();
    if (!text) return;

    if (!currentUser || !supabaseClient) {
        alert("Please sign in to use ReviewWise AI.");
        window.location.href = "login.html";
        return;
    }

    const tier = TIER_LIMITS[currentTier];

    const promptsUsed = currentConversation.filter(
        message => message.role === "user"
    ).length;

    if (promptsUsed >= tier.prompts) {
        alert(
            `This chat has reached its limit of ${tier.prompts} prompts. Please start a new chat.`
        );
        return;
    }

    if (!activeSessionId) {
        const usage = getMonthlyUsage();

        if (usage.chats >= tier.chats) {
            alert(
                `You have reached your monthly limit of ${tier.chats} chats.`
            );
            return;
        }
    }

    isSending = true;

    if (sendButton) sendButton.disabled = true;

    const previousMessages = currentConversation.slice();
    const previousSessionId = activeSessionId;

    let pendingIndex = -1;
    let userMessageSaved = false;

    try {
        if (!activeSessionId) {
            await createConversation(text);
        }

        const conversationId = activeSessionId;

        // Save user prompt first
        await saveMessage("user", text, conversationId);
        userMessageSaved = true;

        currentConversation.push({
            role: "user",
            content: text
        });

        chatInput.value = "";

        pendingIndex = currentConversation.length;

        currentConversation.push({
            role: "assistant",
            content: `Thinking (${currentTier.toUpperCase()})...`
        });

        renderChat();

        // Existing Gemini endpoint
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                reviews: [
                    ...previousMessages,
                    { role: "user", content: text }
                ]
                    .map(message =>
                        `${message.role}: ${message.content}`
                    )
                    .join("\n"),
                question: text,
                tier: currentTier
            })
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                `Request failed (${response.status})`
            );
        }

        const answer =
            data.answer || "No response was returned.";

        // Save Gemini response
        await saveMessage(
            "assistant",
            answer,
            conversationId
        );

        currentConversation[pendingIndex] = {
            role: "assistant",
            content: answer
        };

    } catch (error) {
        console.error("Chat error:", error);

        const message = `Error: ${error.message}`;

        if (pendingIndex >= 0) {
            currentConversation[pendingIndex] = {
                role: "assistant",
                content: message
            };
        } else {
            alert(message);
        }

        if (!userMessageSaved && previousSessionId) {
            activeSessionId = previousSessionId;
        }

    } finally {
        isSending = false;

        if (sendButton) sendButton.disabled = false;

        renderChat();
        await loadChatHistoryUI();
        
        try {
            await loadMonthlyUsage();
        } catch (usageError) {
            console.error(
                "Unable to refresh monthly usage:",
                usageError
            );
        }

    }

    

}

// ==========================================
// SUPABASE LOGOUT
// ==========================================

async function logout() {
    try {
        if (!supabaseClient) {
            throw new Error(
                "Authentication is not initialized."
            );
        }

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) throw error;

        currentUser = null;
        currentTier = "free";
        currentConversation = [];
        activeSessionId = null;
        savedConversations = [];

        localStorage.removeItem("reviewWiseLoggedIn");
        localStorage.removeItem("reviewWiseUserEmail");

        window.location.href = "login.html";

    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to sign out. Please try again.");
    }
}

// ==========================================
// SAFE TEXT FORMATTING
// ==========================================

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatAssistantContent(text) {
    return String(text)
        .split("\n")
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join("");
}

// ==========================================
// COPY RESPONSE
// ==========================================

function copyText(btn) {
    const element = btn
        .closest(".chat-message")
        .querySelector(".message-content");

    if (!element) return;

    navigator.clipboard.writeText(element.innerText);

    btn.textContent = "✓";

    setTimeout(() => {
        btn.textContent = "📋";
    }, 1500);
}

// ==========================================
// ENTER KEY TO SEND
// ==========================================

if (chatInput) {
    chatInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
}