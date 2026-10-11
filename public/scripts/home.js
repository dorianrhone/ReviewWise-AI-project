
"use strict";

// ==========================================
// REVIEWWISE AI - HOME.JS
// ==========================================

// DOM ELEMENTS

const chatFeed = document.getElementById("chat-feed");
const chatInput = document.getElementById("chat-input");
const welcomeContainer = document.getElementById("welcome-container");
const chatHistoryList = document.getElementById("chat-history-list");
const activeTierName = document.getElementById("active-tier-name");

const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");
const userEmailDisplay = document.getElementById("user-email-display");

const sendButton = document.getElementById("send-btn");
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");

const appLayout = document.getElementById("app-layout");
const chatMain = document.getElementById("chat-main");

// ==========================================
// APPLICATION STATE
// ==========================================

let supabaseClient = null;
let currentUser = null;

let currentConversation = [];
let activeSessionId = null;
let savedConversations = [];

let isSending = false;
let isRegenerating = false;

let currentTier = "free";
let subscriptionVerified = false;

let monthlyUsage = {
    month: "",
    chats: 0
};

// ==========================================
// SUBSCRIPTION TIERS
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

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // Hide sidebar by default
    appLayout?.classList.add("sidebar-closed");
    updateSidebarAccessibility();

    // Start on centered welcome screen
    updateChatLayout();

    initializeInput();

    try {
        await initializeHomeAuth();
        await loadChatHistoryUI();

        renderChat();
        updateTierBadgeUI();

    } catch (error) {
        console.error(
            "Application initialization error:",
            error
        );
    }
});

// ==========================================
// SIDEBAR CONTROLS
// ==========================================

function updateSidebarAccessibility() {
    const closed =
        appLayout?.classList.contains("sidebar-closed");

    toggleSidebarBtn?.setAttribute(
        "aria-expanded",
        String(!closed)
    );

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.inert = Boolean(closed);
    }
}

function toggleSidebar() {
    if (!appLayout) return;

    appLayout.classList.toggle("sidebar-closed");
    updateSidebarAccessibility();
}

toggleSidebarBtn?.addEventListener(
    "click",
    toggleSidebar
);

document.addEventListener("keydown", event => {
    if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "s"
    ) {
        event.preventDefault();
        toggleSidebar();
    }
});

// ==========================================
// DYNAMIC CHAT LAYOUT
// ==========================================

function updateChatLayout() {
    if (!chatMain) return;

    const hasMessages = currentConversation.length > 0;

    chatMain.classList.toggle(
        "empty-chat",
        !hasMessages
    );

    chatMain.classList.toggle(
        "has-messages",
        hasMessages
    );

    if (welcomeContainer) {
        welcomeContainer.style.display =
            hasMessages ? "none" : "block";
    }
}

// ==========================================
// INPUT BEHAVIOR
// ==========================================

function initializeInput() {
    if (!chatInput) return;

    chatInput.addEventListener("input", () => {
        resizeChatInput();
    });

    chatInput.addEventListener("keydown", event => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {
            event.preventDefault();
            sendMessage();
        }
    });
}

function resizeChatInput() {
    if (!chatInput) return;

    chatInput.style.height = "auto";

    chatInput.style.height =
        Math.min(chatInput.scrollHeight, 180) + "px";
}

// ==========================================
// SUPABASE INITIALIZATION
// ==========================================

async function initializeSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    const response = await fetch("/api/config");

    if (!response.ok) {
        throw new Error(
            "Unable to load Supabase configuration."
        );
    }

    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseKey) {
        throw new Error(
            "Supabase configuration is missing."
        );
    }

    if (!window.supabase) {
        throw new Error(
            "Supabase JavaScript library is not loaded."
        );
    }

    supabaseClient = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
    );

    return supabaseClient;
}

// ==========================================
// AUTHENTICATION
// ==========================================

async function initializeHomeAuth() {
    try {
        await initializeSupabase();

        const { data, error } =
            await supabaseClient.auth.getUser();

        if (
            error &&
            error.code !== "session_not_found"
        ) {
            throw error;
        }

        currentUser = data?.user || null;

        if (currentUser) {
            if (loggedOutView) {
                loggedOutView.style.display = "none";
            }

            if (loggedInView) {
                loggedInView.style.display = "block";
            }

            if (userEmailDisplay) {
                userEmailDisplay.textContent =
                    currentUser.email || "Signed-in user";
            }

            try {
                await loadSubscriptionTier();

            } catch (subscriptionError) {
                console.error(
                    "Unable to load subscription:",
                    subscriptionError
                );

                subscriptionVerified = false;
            }

        } else {
            showLoggedOutState();
        }

    } catch (error) {
        console.error("Authentication error:", error);
        showLoggedOutState();
    }

    updateTierBadgeUI();
}

function showLoggedOutState() {
    currentUser = null;
    currentTier = "free";
    subscriptionVerified = false;

    monthlyUsage = {
        month: "",
        chats: 0
    };

    if (loggedOutView) {
        loggedOutView.style.display = "block";
    }

    if (loggedInView) {
        loggedInView.style.display = "none";
    }
}

// ==========================================
// AUTHENTICATED API HELPERS
// ==========================================

async function getAccessToken() {
    if (!supabaseClient) {
        throw new Error(
            "Supabase has not been initialized."
        );
    }

    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error || !data.session) {
        throw new Error(
            "Your session has expired. Please sign in again."
        );
    }

    return data.session.access_token;
}

async function authenticatedFetch(url, options = {}) {
    const token = await getAccessToken();

    return fetch(url, {
        ...options,

        headers: {
            ...(options.headers || {}),

            Authorization: `Bearer ${token}`
        }
    });
}

// ==========================================
// LOAD SUBSCRIPTION
// ==========================================

async function loadSubscriptionTier() {
    if (!currentUser || !supabaseClient) {
        subscriptionVerified = false;
        updateTierBadgeUI();
        return;
    }

    subscriptionVerified = false;

    const response = await authenticatedFetch(
        "/api/subscription"
    );

    if (!response.ok) {
        throw new Error(
            "Unable to load subscription."
        );
    }

    const subscription = await response.json();

    if (!TIER_LIMITS[subscription.tier]) {
        throw new Error(
            "Invalid subscription tier."
        );
    }

    currentTier = subscription.tier;

    window.currentSubscriptionInfo = subscription;

    await loadMonthlyUsage();

    subscriptionVerified = true;
    updateTierBadgeUI();
}

// ==========================================
// MONTHLY USAGE
// ==========================================

function getMonthlyUsage() {
    return monthlyUsage;
}

async function loadMonthlyUsage() {
    if (!currentUser || !supabaseClient) {
        monthlyUsage = {
            month: "",
            chats: 0
        };

        updateTierBadgeUI();
        return;
    }

    const month = new Date()
        .toISOString()
        .slice(0, 7);

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
// SUBSCRIPTION SIDEBAR
// ==========================================

function updateTierBadgeUI() {
    if (!activeTierName) return;

    const tier =
        TIER_LIMITS[currentTier] || TIER_LIMITS.free;

    if (!currentUser) {
        activeTierName.innerHTML = `
            Free Tier ($0.00/mo)
            <span class="tier-details">
                Sign in to track usage
            </span>
        `;

        return;
    }

    if (!subscriptionVerified) {
        activeTierName.innerHTML = `
            Subscription unavailable
            <span class="tier-details">
                Unable to verify plan or usage
            </span>
        `;

        return;
    }

    const usage = getMonthlyUsage();

    activeTierName.innerHTML = `
        ${tier.name} Tier ($${tier.price.toFixed(2)}/mo)

        <span class="tier-details">
            Chats: ${usage.chats}/${tier.chats} this month
            <br>
            Prompts per chat: ${tier.prompts}
        </span>
    `;
}

// ==========================================
// SUGGESTION CHIPS
// ==========================================

function loadSuggestion(text) {
    if (!chatInput) return;

    chatInput.value = text;
    resizeChatInput();
    chatInput.focus();
}

// ==========================================
// NEW CHAT
// ==========================================

function startNewChat() {
    if (isSending || isRegenerating) return;

    currentConversation = [];
    activeSessionId = null;

    if (chatInput) {
        chatInput.value = "";
        resizeChatInput();
    }

    renderChat();

    loadChatHistoryUI().catch(console.error);

    chatInput?.focus();
}

// ==========================================
// CREATE SUPABASE CONVERSATION
// ==========================================

async function createConversation(firstMessage) {
    if (!currentUser || !supabaseClient) {
        throw new Error("Please sign in first.");
    }

    if (!subscriptionVerified) {
        throw new Error(
            "Subscription information is unavailable."
        );
    }

    const title =
        firstMessage.substring(0, 40) || "New Chat";

    const { data, error } = await supabaseClient.rpc(
        "create_limited_conversation",
        {
            p_title: title
        }
    );

    if (error) {
        throw new Error(error.message);
    }

    activeSessionId = data;

    await loadChatHistoryUI();

    return { id: data };
}

// ==========================================
// SAVE MESSAGE
// ==========================================

async function saveMessage(
    role,
    content,
    conversationId = activeSessionId
) {
    if (!currentUser || !conversationId) {
        throw new Error("No active conversation.");
    }

    const { data, error } = await supabaseClient
        .from("messages")
        .insert({
            conversation_id: conversationId,
            role,
            content
        })
        .select("id, role, content, created_at")
        .single();

    if (error) {
        throw error;
    }

    return data;
}

// ==========================================
// LOAD CHAT HISTORY
// ==========================================

async function loadChatHistoryUI() {
    if (!chatHistoryList) return;

    if (!currentUser || !supabaseClient) {
        chatHistoryList.textContent =
            "Sign in to access saved chats.";
        return;
    }

    const { data, error } = await supabaseClient
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error(
            "Unable to load conversations:",
            error
        );

        chatHistoryList.textContent =
            "Unable to load saved chats.";

        return;
    }

    savedConversations = data || [];

    chatHistoryList.innerHTML = "";

    if (savedConversations.length === 0) {
        chatHistoryList.textContent =
            "No saved chats yet.";
        return;
    }

    savedConversations.forEach(item => {
        const div = document.createElement("div");

        div.className = "history-item";

        if (item.id === activeSessionId) {
            div.classList.add("active");
        }

        const titleSpan = document.createElement("span");

        titleSpan.textContent =
            item.title || "New Chat";

        titleSpan.title =
            item.title || "New Chat";

        div.onclick = () => {
            if (!isSending && !isRegenerating) {
                openChatSession(item.id);
            }
        };

        div.tabIndex = 0;
        div.setAttribute("role", "button");

        div.addEventListener("keydown", event => {
            if (
                event.target === div &&
                (event.key === "Enter" ||
                 event.key === " ")
            ) {
                event.preventDefault();

                if (!isSending && !isRegenerating) {
                    openChatSession(item.id);
                }
            }
        });

        const deleteBtn =
            document.createElement("button");

        deleteBtn.type = "button";
        deleteBtn.textContent = "×";
        deleteBtn.title = "Delete Chat";
        deleteBtn.setAttribute(
            "aria-label",
            "Delete conversation"
        );

        deleteBtn.onclick = async event => {
            event.stopPropagation();

            if (!isSending && !isRegenerating) {
                await deleteChatSession(item.id);
            }
        };

        div.appendChild(titleSpan);
        div.appendChild(deleteBtn);

        chatHistoryList.appendChild(div);
    });
}

// ==========================================
// OPEN SAVED CHAT
// ==========================================

async function openChatSession(id) {
    if (
        !currentUser ||
        isSending ||
        isRegenerating
    ) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", {
            ascending: true
        })
        .order("id", {
            ascending: true
        });

    if (error) {
        console.error(
            "Unable to open chat:",
            error
        );

        alert("Unable to load this conversation.");
        return;
    }

    activeSessionId = id;

    currentConversation = (data || []).map(message => ({
        id: message.id,
        role: message.role,
        content: message.content
    }));

    renderChat();
    await loadChatHistoryUI();

    // Automatically hide sidebar on mobile
    if (window.innerWidth <= 768) {
        appLayout?.classList.add("sidebar-closed");
        updateSidebarAccessibility();
    }
}

// ==========================================
// DELETE CONVERSATION
// ==========================================

async function deleteChatSession(id) {
    if (
        !currentUser ||
        isSending ||
        isRegenerating
    ) {
        return;
    }

    const confirmed = confirm(
        "Delete this conversation? Its messages will be permanently removed, but your monthly chat allowance will not be restored."
    );

    if (!confirmed) return;

    const { data, error } = await supabaseClient
        .from("conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id)
        .select("id");

    if (error || !data?.length) {
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

    // Deletion does not refund monthly usage
    try {
        await loadMonthlyUsage();
    } catch (error) {
        console.error(
            "Unable to refresh usage:",
            error
        );
    }
}

// ==========================================
// RENDER CHAT MESSAGES
// ==========================================

function renderChat() {
    if (!chatFeed) return;

    chatFeed.innerHTML = "";

    updateChatLayout();

    if (currentConversation.length === 0) {
        return;
    }

    const lastAssistantIndex =
        currentConversation.findLastIndex(
            message => message.role === "assistant"
        );

    currentConversation.forEach((msg, index) => {
        const msgDiv =
            document.createElement("div");

        msgDiv.className =
            `chat-message ${msg.role}`;

        if (msg.role === "user") {
            const bubble =
                document.createElement("div");

            bubble.className = "message-bubble";
            bubble.textContent = msg.content;

            msgDiv.appendChild(bubble);

        } else {
            const content =
                document.createElement("div");

            content.className = "message-content";
            content.innerHTML =
                formatAssistantContent(msg.content);

            msgDiv.appendChild(content);

            // Only show Regenerate on the latest
            // completed assistant response.
            if (
                index === lastAssistantIndex &&
                index === currentConversation.length - 1 &&
                !isSending &&
                !isRegenerating &&
                activeSessionId &&
                msg.id &&
                !msg.content.startsWith("Error:")
            ) {
                const actions =
                    document.createElement("div");

                actions.className = "message-actions";

                const regenerateBtn =
                    document.createElement("button");

                regenerateBtn.type = "button";
                regenerateBtn.className = "action-btn";
                regenerateBtn.textContent =
                    "↻ Regenerate Response";

                regenerateBtn.onclick = () => {
                    regenerateResponse();
                };

                actions.appendChild(regenerateBtn);
                msgDiv.appendChild(actions);
            }
        }

        chatFeed.appendChild(msgDiv);
    });

    requestAnimationFrame(() => {
        chatFeed.scrollTop = chatFeed.scrollHeight;
    });
}

// ==========================================
// GEMINI REQUEST HELPER
// ==========================================

async function requestGemini(messages, question) {
    const reviews = messages
        .map(message =>
            `${message.role}: ${message.content}`
        )
        .join("\n");

    const response = await authenticatedFetch(
        "/api/chat",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                conversationId: activeSessionId,
                reviews,
                question
            })
        }
    );

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

    return data.answer ||
        "No response was returned.";
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {
    if (isSending || isRegenerating || !chatInput) {
        return;
    }

    const text = chatInput.value.trim();

    if (!text) return;

    if (!currentUser || !supabaseClient) {
        alert("Please sign in to use ReviewWise AI.");
        window.location.href = "login.html";
        return;
    }

    if (!subscriptionVerified) {
        alert(
            "Unable to verify your subscription. Please refresh and try again."
        );
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
    sendButton.disabled = true;

    let pendingIndex = -1;

    try {
        if (!activeSessionId) {
            await createConversation(text);
        }

        const savedUserMessage = await saveMessage(
            "user",
            text
        );

        currentConversation.push({
            id: savedUserMessage.id,
            role: "user",
            content: text
        });

        chatInput.value = "";
        resizeChatInput();

        pendingIndex = currentConversation.length;

        currentConversation.push({
            role: "assistant",
            content: "Thinking..."
        });

        renderChat();

        const context = currentConversation
            .slice(0, pendingIndex);

        const answer = await requestGemini(
            context,
            text
        );

        const savedAnswer = await saveMessage(
            "assistant",
            answer
        );

        currentConversation[pendingIndex] = {
            id: savedAnswer.id,
            role: "assistant",
            content: answer
        };

    } catch (error) {
        console.error("Chat error:", error);

        if (pendingIndex >= 0) {
            currentConversation[pendingIndex] = {
                role: "assistant",
                content: `Error: ${error.message}`
            };
        } else {
            alert(`Error: ${error.message}`);
        }

    } finally {
        isSending = false;
        sendButton.disabled = false;

        renderChat();

        try {
            await loadChatHistoryUI();
        } catch (error) {
            console.error("History refresh error:", error);
        }

        try {
            await loadMonthlyUsage();
        } catch (error) {
            console.error("Usage refresh error:", error);
        }
    }
}

// ==========================================
// REGENERATE RESPONSE
// ==========================================

async function regenerateResponse() {
    if (
        isSending ||
        isRegenerating ||
        !activeSessionId ||
        !currentUser
    ) {
        return;
    }

    if (!subscriptionVerified) {
        alert("Unable to verify subscription.");
        return;
    }

    const lastIndex = currentConversation.length - 1;

    const oldMessage = currentConversation[lastIndex];

    if (
        !oldMessage ||
        oldMessage.role !== "assistant" ||
        !oldMessage.id
    ) {
        return;
    }

    const messagesBeforeAnswer =
        currentConversation.slice(0, lastIndex);

    const lastUserMessage =
        [...messagesBeforeAnswer]
            .reverse()
            .find(message => message.role === "user");

    if (!lastUserMessage) return;

    const originalConversationId = activeSessionId;
    const originalMessage = { ...oldMessage };

    isRegenerating = true;

    currentConversation[lastIndex] = {
        ...oldMessage,
        content: "Regenerating response..."
    };

    renderChat();

    try {
        // Generate the replacement first, preserving
        // the old answer if Gemini fails.
        const newAnswer = await requestGemini(
            messagesBeforeAnswer,
            lastUserMessage.content
        );

        // Verify this is still the same conversation.
        if (activeSessionId !== originalConversationId) {
            throw new Error("Conversation changed.");
        }

        // Remove the previous assistant response.
        const { data: deleted, error: deleteError } =
            await supabaseClient
                .from("messages")
                .delete()
                .eq("id", originalMessage.id)
                .eq("conversation_id", originalConversationId)
                .eq("role", "assistant")
                .select("id");

        if (deleteError || !deleted?.length) {
            throw new Error(
                "Unable to replace the previous response."
            );
        }

        let savedAnswer;

        try {
            savedAnswer = await saveMessage(
                "assistant",
                newAnswer,
                originalConversationId
            );

        } catch (saveError) {
            // Best-effort recovery of original answer
            try {
                await saveMessage(
                    "assistant",
                    originalMessage.content,
                    originalConversationId
                );
            } catch (restoreError) {
                console.error(
                    "Unable to restore original answer:",
                    restoreError
                );
            }

            throw saveError;
        }

        currentConversation[lastIndex] = {
            id: savedAnswer.id,
            role: "assistant",
            content: newAnswer
        };

    } catch (error) {
        console.error("Regeneration error:", error);

        alert(
            `Unable to regenerate response: ${error.message}`
        );

        // Reload authoritative database messages.
        const { data, error: reloadError } =
            await supabaseClient
                .from("messages")
                .select("id, role, content, created_at")
                .eq("conversation_id", originalConversationId)
                .order("created_at", {
                    ascending: true
                })
                .order("id", {
                    ascending: true
                });

        if (!reloadError && data) {
            currentConversation = data.map(message => ({
                id: message.id,
                role: message.role,
                content: message.content
            }));
        } else {
            currentConversation[lastIndex] =
                originalMessage;
        }

    } finally {
        isRegenerating = false;
        renderChat();
    }
}

// ==========================================
// LOGOUT
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
        subscriptionVerified = false;

        monthlyUsage = {
            month: "",
            chats: 0
        };

        currentConversation = [];
        activeSessionId = null;
        savedConversations = [];

        localStorage.removeItem(
            "reviewWiseLoggedIn"
        );

        localStorage.removeItem(
            "reviewWiseUserEmail"
        );

        window.location.href = "login.html";

    } catch (error) {
        console.error("Logout error:", error);

        alert(
            "Unable to sign out. Please try again."
        );
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
        .map(line =>
            `<p>${escapeHtml(line) || "&nbsp;"}</p>`
        )
        .join("");
}
