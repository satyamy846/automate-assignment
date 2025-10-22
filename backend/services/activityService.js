const { Client } = require("pg");
const { appLogger, databaseLogger } = require("../utils/logger");

const conn = new Client({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
});

conn.connect();

class ActivityService {
  /**
   * Record an activity
   */
  static async recordActivity({ userId, action, assetId = null, status = "success", message = "" }) {
    try {
      const query = `
        INSERT INTO activity_logs (user_id, action, asset_id, status, message)
        VALUES ($1, $2, $3, $4, $5)
      `;
      const values = [userId, action, assetId, status, message];

      databaseLogger.info("Executing query: INSERT INTO activity_logs", { query, values });
      await conn.query(query, values);

      appLogger.info("Activity recorded", { userId, action, assetId, status });
      databaseLogger.info("Activity successfully inserted into activity_logs", {
        userId,
        action,
        assetId,
        status,
      });
    } catch (error) {
      appLogger.error("Error recording activity", { error: error.message, userId, action });
      databaseLogger.error("Database error while recording activity", {
        query: "INSERT INTO activity_logs",
        error: error.message,
        userId,
        action,
      });
      throw new Error("Failed to record activity");
    }
  }

  /**
   * Fetch all activities (for admin)
   */
  static async getAllActivities() {
    const query = `
      SELECT 
        al.*,
        u.name AS user_name,
        a.filename AS asset_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN assets a ON al.asset_id = a.id
      ORDER BY al.created_at DESC
    `;

    try {
      databaseLogger.info("Executing query: getAllActivities", { query });
      const result = await conn.query(query);

      appLogger.info("Fetched all activity logs", { count: result.rows.length });
      databaseLogger.info("Fetched activity logs from DB", { count: result.rows.length });

      return result.rows;
    } catch (error) {
      appLogger.error("Error fetching all activities", { error: error.message });
      databaseLogger.error("Database error while fetching all activities", {
        error: error.message,
        query,
      });
      throw new Error("Failed to fetch activities");
    }
  }

  /**
   * Fetch activity logs for a specific user
   * @param {number} userId
   */
  static async getUserActivities(userId) {
    const query = `
      SELECT 
        al.*, 
        a.filename AS asset_name
      FROM activity_logs al
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
    `;

    try {
      databaseLogger.info("Executing query: getUserActivities", { query, userId });
      const result = await conn.query(query, [userId]);

      appLogger.info("Fetched user activity logs", { userId, count: result.rows.length });
      databaseLogger.info("Fetched user activity logs from DB", { userId, count: result.rows.length });

      return result.rows;
    } catch (error) {
      appLogger.error("Error fetching user activities", { userId, error: error.message });
      databaseLogger.error("Database error while fetching user activities", {
        userId,
        query,
        error: error.message,
      });
      throw new Error("Failed to fetch user activities");
    }
  }
}

module.exports = ActivityService;