const { databaseLogger } = require("../utils/logger/index");
const { hashPassword, comparePassword } = require("../utils/authHelper");
const pool = require("../connections/postgres/index");

class AuthService {
  constructor() {}

  static async registerUser(name, email, password, role = "user") {
    try {
      const validRoles = ["admin", "user", "viewer"];
      if (!validRoles.includes(role)) throw new Error("Invalid role");

      const hashedPassword = password ? await hashPassword(password) : null;

      const insertQuery = `
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      const insertResult = await pool.query(insertQuery, [name, email, hashedPassword, role]);
      const userId = insertResult.rows[0].id;

      const selectQuery = `
        SELECT id, name, email, role, created_at, updated_at
        FROM users WHERE id = $1
      `;
      const selectResult = await pool.query(selectQuery, [userId]);
      return selectResult.rows[0];
    } catch (err) {
      databaseLogger.error("User registration failed", { error: err.message, email });
      throw err;
    }
  }

  static async registerWithGoogle(name, email, googleId, role = "user") {
    try {
      const validRoles = ["admin", "user", "viewer"];
      if (!validRoles.includes(role)) throw new Error("Invalid role");

      // 1️⃣ Check if user already exists
      const existingUserQuery = `
      SELECT id, name, email, google_id, role, created_at, updated_at
      FROM users WHERE email = $1
    `;
      const existingUserResult = await pool.query(existingUserQuery, [email]);
      databaseLogger.info("Google registration check", existingUserResult.rows);
      if (existingUserResult.rows.length > 0) {
        const existingUser = existingUserResult.rows[0];
        databaseLogger.info("User already exists with Google registration", { email });

        // ✅ If user exists but doesn't have google_id, link it now
        if (!existingUser.google_id) {
          await pool.query(
            `UPDATE users SET google_id = $1, updated_at = NOW() WHERE email = $2`,
            [googleId, email]
          );
          existingUser.google_id = googleId;
        }

        return existingUser; // Return the existing user (no new record)
      }

      // 2️⃣ Create a new user if not found
      const insertQuery = `
      INSERT INTO users (name, email, google_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, google_id, role, created_at, updated_at
    `;
      const insertResult = await pool.query(insertQuery, [name, email, googleId, role]);
      return insertResult.rows[0];
    } catch (err) {
      databaseLogger.error("Google registration failed", { error: err.message, email });
      throw err;
    }
  }


  static async findUserByEmail(email) {
    try {
      const query = `SELECT * FROM users WHERE email = $1`;
      const result = await pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (err) {
      databaseLogger.error("Database query failed", { error: err.message, email });
      throw err;
    }
  }

  static async validatePassword(inputPassword, storedHashedPassword, email) {
    try {
      return await comparePassword(inputPassword, storedHashedPassword);
    } catch (err) {
      databaseLogger.error("Password validation failed", { error: err.message, email });
      throw err;
    }
  }

  static async deleteUserById(userId) {
    try {
      const deleteQuery = `DELETE FROM users WHERE id = $1 RETURNING id, email`;
      const result = await pool.query(deleteQuery, [userId]);
      if (result.rowCount === 0) {
        throw new Error("User not found");
      }
      databaseLogger.info("User deleted successfully", { user_id: userId });
      return result.rows[0];
    } catch (err) {
      databaseLogger.error("User deletion failed", { error: err.message, user_id: userId });
      throw err;
    }
  }

}

module.exports = AuthService;
