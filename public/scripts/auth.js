
let supabaseClient = null;
let authReady = false;

// Display messages on the page
function showAuthMessage(message, success = false) {
    const element = document.getElementById("error-msg");

    if (!element) return;

    element.style.display = "block";
    element.style.background = success
        ? "rgba(34, 197, 94, 0.15)"
        : "rgba(239, 68, 68, 0.15)";

    element.style.color = success ? "#86efac" : "#fca5a5";
    element.textContent = message;
}

// Initialize Supabase
async function initializeSupabase() {
    const response = await fetch("/api/config");

    if (!response.ok) {
        throw new Error(
            `Configuration request failed: ${response.status}`
        );
    }

    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseKey) {
        throw new Error("Supabase configuration is missing.");
    }

    if (!window.supabase) {
        throw new Error("Supabase JavaScript library did not load.");
    }

    supabaseClient = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseKey
    );

    authReady = true;
    console.log("Supabase authentication initialized.");
}

// Register a new account
async function handleSignup(event) {
    event.preventDefault();

    if (!authReady) {
        showAuthMessage("Authentication is still loading.");
        return;
    }

    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (password.length < 8) {
        showAuthMessage("Password must be at least 8 characters.");
        return;
    }

    try {
        showAuthMessage("Creating your account...", true);

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                },
                emailRedirectTo:
                    `${window.location.origin}/login.html`
            }
        });

        if (error) throw error;

        if (data.session) {
            window.location.href = "home.html";
        } else {
            showAuthMessage(
                "Account created! Check your email for a confirmation link.",
                true
            );
        }

    } catch (error) {
        console.error("Signup error:", error);
        showAuthMessage(error.message);
    }
}

// Sign in to an existing account
async function handleLogin(event) {
    event.preventDefault();

    if (!authReady) {
        showAuthMessage("Authentication is still loading.");
        return;
    }

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
        showAuthMessage("Signing in...", true);

        const { error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        window.location.href = "home.html";

    } catch (error) {
        console.error("Login error:", error);
        showAuthMessage(error.message);
    }
}

// Initialize when the HTML has loaded
document.addEventListener("DOMContentLoaded", async () => {
    const submitButtons = document.querySelectorAll(
        "#login-form button[type='submit'], " +
        "#signup-form button[type='submit']"
    );

    submitButtons.forEach(button => {
        button.disabled = true;
    });

    try {
        await initializeSupabase();

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data.session) {
            window.location.href = "home.html";
            return;
        }

        submitButtons.forEach(button => {
            button.disabled = false;
        });

    } catch (error) {
        console.error("Authentication initialization error:", error);
        showAuthMessage(error.message);
    }
});
