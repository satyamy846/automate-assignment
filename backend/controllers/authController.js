const AuthService = require("../services/authService");
const { appLogger } = require("../utils/logger/index");
const { generateUniqueSessionId } = require("../utils/common");
const ResponseHandler = require("../utils/responseHandler");
const SessionService = require("../services/sessionService");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

class AuthController {
    static async signup(req, res) {
        const { name, email, password, role } = req.body;
        try {
            if (!name || !email || !password) {
                return ResponseHandler.error(res, 400, "Name, email, and password are required");
            }

            const existingUser = await AuthService.findUserByEmail(email);
            if (existingUser) {
                appLogger.warn("Signup attempt with existing email", { email });
                return ResponseHandler.error(res, 400, "User already exists");
            }

            const newUser = await AuthService.registerUser(name, email, password, role);
            appLogger.info("User registered successfully", { email, user_id: newUser.id });

            return ResponseHandler.success(res, 201, "User registered successfully", {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    created_at: newUser.created_at,
                    updated_at: newUser.updated_at,
                },
            });
        } catch (err) {
            appLogger.error("Signup failed", { error: err.message, email });
            return ResponseHandler.error(res, 500, "Internal Server Error", err.message);
        }
    }

    static async login(req, res) {
        const { email, password } = req.body;
        try {
            if (!email || !password) {
                return ResponseHandler.error(res, 400, "Email and password are required");
            }

            const user = await AuthService.findUserByEmail(email);
            if (!user) {
                appLogger.warn("Login attempt with non-existing email", { email });
                return ResponseHandler.error(res, 400, "Invalid email or password");
            }

            const isValidPassword = await AuthService.validatePassword(password, user.password, email);
            if (!isValidPassword) {
                appLogger.warn("Login attempt with incorrect password", { email });
                return ResponseHandler.error(res, 400, "Invalid email or password");
            }
            const sessionId = generateUniqueSessionId();
            const sessionData = { id: user.id, email: user.email, role: user.role, name: user.name };

            // Store session in Redis (TTL = 1 day by default)
            await SessionService.createSession(sessionId, sessionData, process.env.REDIS_SESSION_TTL || 86400);

            res.cookie("sessionId", sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: process.env.COOKIE_MAX_AGE || 86400000,
            });

            appLogger.info("User logged in successfully", { email, user_id: user.id });

            return ResponseHandler.success(res, 200, "Login successful", {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
            });
        } catch (err) {
            appLogger.error("Login failed", { error: err.message, email });
            return ResponseHandler.error(res, 500, "Internal Server Error", err.message);
        }
    }

    static async googleLogin(req, res) {
        try {
            // Google ID Token
            appLogger.info("Initiating Google login");
            const { token } = req.body;

            if (!token) {
                return ResponseHandler.error(res, 400, "Missing Google ID token");
            }

            // Verify token with Google
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            const { email, name, sub: googleId } = payload;

            if (!email || !googleId) {
                return ResponseHandler.error(res, 400, "Invalid Google token payload");
            }

            // Register or login
            const user = await AuthService.registerWithGoogle(name, email, googleId);

            // Create session
            const sessionId = generateUniqueSessionId();
            const sessionData = { id: user.id, email: user.email, role: user.role, name: user.name };

            await SessionService.createSession(sessionId, sessionData, process.env.REDIS_SESSION_TTL || 86400);

            res.cookie("sessionId", sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: process.env.COOKIE_MAX_AGE || 86400000,
            });

            appLogger.info("User logged in with Google successfully", { email, user_id: user.id });

            return ResponseHandler.success(res, 200, "Google login successful", {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    google_id: user.google_id,
                    role: user.role,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
            });
        } catch (err) {
            appLogger.error("Google login failed", { error: err.message });
            return ResponseHandler.error(res, 500, "Failed to authenticate Google login", err.message);
        }
    }

    static async logout(req, res) {
        const sessionId = req.cookies.sessionId;
        try {
            if (sessionId) {
                res.clearCookie("sessionId");
                appLogger.info("User logged out", { session_id: sessionId });
                return ResponseHandler.success(res, 200, "Logout successful");
            }

            return ResponseHandler.error(res, 400, "No active session");
        } catch (err) {
            appLogger.error("Logout failed", { error: err.message, session_id: sessionId });
            return ResponseHandler.error(res, 500, "Internal Server Error", err.message);
        }
    }

    static async getCurrentUser(req, res) {
        if (req.user) {
            return ResponseHandler.success(res, 200, "Current user fetched successfully", {
                user: req.user,
            });
        }
        return ResponseHandler.error(res, 401, "Not logged in");
    }

    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const currentUser = req.user;

            if (!currentUser) {
                return ResponseHandler.error(res, 401, "Unauthorized: Please log in");
            }

            if (currentUser.role !== "admin") {
                return ResponseHandler.error(res, 403, "Access denied: Only admins can delete users");
            }

            if (!id) {
                return ResponseHandler.error(res, 400, "User ID is required");
            }

            const deletedUser = await AuthService.deleteUserById(id);

            return ResponseHandler.success(res, 200, "User deleted successfully", {
                deletedUser,
            });
        } catch (err) {
            appLogger.error("User deletion failed", { error: err.message });
            return ResponseHandler.error(res, 500, "Failed to delete user", err.message);
        }
    }

}

module.exports = AuthController;
