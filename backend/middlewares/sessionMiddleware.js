const SessionService = require("../services/sessionService");
const { appLogger } = require("../utils/logger/index");
const ResponseHandler = require("../utils/responseHandler");


/**
 * Middleware to attach session user data from Redis if sessionId cookie exists
 */
async function attachSession(req, res, next) {
    const sessionId = req.cookies?.sessionId;

    if (sessionId) {
        try {
            const sessionData = await SessionService.getSession(sessionId);
            appLogger.info("Session data retrieved from Redis", { session_id: sessionId });
            appLogger.info("Session data", { session_data: sessionData });
            if (sessionData) {
                req.user = sessionData; // ✅ attach user/session payload
            }
        } catch (err) {
            appLogger.error("Redis session retrieval error", { error: err.message, stack: err.stack, session_id: sessionId });
        }
    }

    next();
}


function requireAuth(req, res, next) {
    appLogger.info("Checking authentication for protected route", { user: req.user });
    if (!req.user) {
        appLogger.warn("Unauthorized access attempt to protected route");
        return ResponseHandler.error(res, 401, "Unauthorized: Please log in to access this resource");
    }
    next();
}


async function verifySession(req, res, next) {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "No session found" });
    }

    const sessionData = await SessionService.getSession(sessionId);
    if (!sessionData) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    req.user = sessionData; // contains id, email, role, etc.
    next();
  } catch (err) {
    console.error("Session verification failed:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function verifyUser(req, res, next) {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "No session found" });
    }
    const sessionData = await SessionService.getSession(sessionId);
    if (!sessionData) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    if (sessionData.role !== "user" && sessionData.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Insufficient permissions" });
    }
    req.user = sessionData; // contains id, email, role, etc.
    next();
  } catch (err) {
    console.error("User verification failed:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function verifyAdmin(req, res, next) {
  try {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "No session found" });
    }
    const sessionData = await SessionService.getSession(sessionId);
    if (!sessionData) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    if (sessionData.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }
    req.user = sessionData; // contains id, email, role, etc.
    next();
  }
  catch (err) {
    console.error("Admin verification failed:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
    attachSession,
    requireAuth,
    verifySession,
    verifyUser,
    verifyAdmin,
};
