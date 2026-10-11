
// ==========================================
// REVIEWWISE AI - PRICING PLANS
// ==========================================

// Demo subscription information
const PRICING_PLANS = {
    free: {
        price: 0,
        chats: 10,
        prompts: 5
    },
    pro: {
        price: 5.99,
        chats: 20,
        prompts: 10
    },
    advanced: {
        price: 11.99,
        chats: 30,
        prompts: 15
    }
};

// Activate Free Tier
function selectFreePlan() {
    localStorage.setItem("reviewWiseTier", "free");

    localStorage.removeItem("reviewWisePaidStatus");
    localStorage.removeItem("pendingCheckoutTier");

    alert("Free Tier activated!");

    window.location.href = "home.html";
}

// Go to demo checkout for paid tiers
function goToCheckout(tier) {
    if (tier !== "pro" && tier !== "advanced") {
        alert("Invalid subscription plan.");
        return;
    }

    localStorage.setItem("pendingCheckoutTier", tier);

    window.location.href = "checkout.html";
}
