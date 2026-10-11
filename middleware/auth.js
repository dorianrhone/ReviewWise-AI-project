
const { supabase } = require("../services/supabase");

// Verify the Supabase access token
async function requireAuth(req, res, next) {
    try {
        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Please sign in to continue."
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                error: "Authentication token is missing."
            });
        }

        // Verify token with Supabase Auth
        const { data, error } =
            await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: "Your session is invalid or expired."
            });
        }

        // Attach verified user to the request
        req.user = data.user;
        req.accessToken = token;

        next();

    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(500).json({
            error: "Unable to verify authentication."
        });
    }
}

module.exports = { requireAuth };
