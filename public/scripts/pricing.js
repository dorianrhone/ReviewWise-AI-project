
// ==========================================
// REVIEWWISE AI - PRICING
// ==========================================

const PRICING_PLANS = {
    free: { price: 0, chats: 10, prompts: 5 },
    pro: { price: 5.99, chats: 20, prompts: 10 },
    advanced: { price: 11.99, chats: 30, prompts: 15 }
};

let pricingSupabase = null;
let currentSubscription = null;

async function initializePricingSupabase() {
    if (pricingSupabase) return pricingSupabase;

    const response = await fetch("/api/config");

    if (!response.ok) {
        throw new Error("Unable to load configuration.");
    }

    const config = await response.json();

    pricingSupabase = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
    );

    return pricingSupabase;
}

async function getPricingSession() {
    await initializePricingSupabase();

    const { data, error } =
        await pricingSupabase.auth.getSession();

    if (error || !data.session) {
        throw new Error("Please sign in first.");
    }

    return data.session;
}

async function loadCurrentSubscription() {
    try {
        const session = await getPricingSession();

        const response = await fetch("/api/subscription", {
            headers: {
                Authorization:
                    `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to load subscription.");
        }

        currentSubscription = await response.json();

        updatePricingButtons();

    } catch (error) {
        console.error("Pricing error:", error);
        currentSubscription = null;
    }
}

function updatePricingButtons() {
    if (!currentSubscription) return;

    const tier = currentSubscription.tier;

    const buttons = {
        free: document.querySelector(
            '[onclick="selectFreePlan()"]'
        ),
        pro: document.querySelector(
            '[onclick="goToCheckout(\'pro\')"]'
        ),
        advanced: document.querySelector(
            '[onclick="goToCheckout(\'advanced\')"]'
        )
    };

    Object.entries(buttons).forEach(([plan, button]) => {
        if (!button) return;

        if (plan === tier) {
            button.textContent = "Current Plan - Active";
            button.disabled = true;
        }
    });
}

async function selectFreePlan() {
    try {
        const session = await getPricingSession();

        if (
            currentSubscription &&
            currentSubscription.tier === "free"
        ) {
            alert("Free Tier is already active.");
            return;
        }

        const { error } = await pricingSupabase.rpc(
            "activate_demo_subscription",
            { p_tier: "free" }
        );

        if (error) throw error;

        window.location.href = "home.html";

    } catch (error) {
        alert(error.message);
    }
}

async function goToCheckout(tier) {
    if (!["pro", "advanced"].includes(tier)) {
        alert("Invalid subscription plan.");
        return;
    }

    try {
        await getPricingSession();

        if (
            currentSubscription &&
            currentSubscription.tier === tier &&
            currentSubscription.status === "active"
        ) {
            alert("This subscription is already active.");
            return;
        }

        localStorage.setItem("pendingCheckoutTier", tier);

        window.location.href = "checkout.html";

    } catch (error) {
        alert(error.message);
        window.location.href = "login.html";
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadCurrentSubscription
);
