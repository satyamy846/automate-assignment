const { Client } = require("pg");
const { appLogger } = require("../utils/logger");

const conn = new Client({
  host: process.env.PG_HOST || "localhost",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "root",
  port: process.env.PG_PORT || 5432,
  database: "dams",
});

conn.connect();

class ActivityService {
    /**
     * Record an activity
     */
  static async recordActivity({ userId, action, assetId = null, status = "success", message = "" }) {
    try {
      await conn.query(
        `
        INSERT INTO activity_logs (user_id, action, asset_id, status, message)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [userId, action, assetId, status, message]
      );

      appLogger.info("Activity recorded", { userId, action, assetId, status });
    } catch (error) {
      appLogger.error("Error recording activity", { error: error.message, userId, action });
      throw new Error("Failed to record activity");
    }
  }

  /**
   * Fetch all activities (for admin)
   */
  static async getAllActivities() {
    try {
      const result = await conn.query(
        `
        SELECT 
          al.*,
          u.name AS user_name,
          a.filename AS asset_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN assets a ON al.asset_id = a.id
        ORDER BY al.created_at DESC
        `
      );

      appLogger.info("Fetched all activity logs", { count: result.rows.length });
      return result.rows;
    } catch (error) {
      appLogger.error("Error fetching all activities", { error: error.message });
      throw new Error("Failed to fetch activities");
    }
  }

  /**
   * Fetch activity logs for a specific user
   * @param {number} userId
   */
  static async getUserActivities(userId) {
    try {
      const result = await conn.query(
        `
        SELECT 
          al.*, 
          a.filename AS asset_name
        FROM activity_logs al
        LEFT JOIN assets a ON al.asset_id = a.id
        WHERE al.user_id = $1
        ORDER BY al.created_at DESC
        `,
        [userId]
      );

      appLogger.info("Fetched user activity logs", { userId, count: result.rows.length });
      return result.rows;
    } catch (error) {
      appLogger.error("Error fetching user activities", { userId, error: error.message });
      throw new Error("Failed to fetch user activities");
    }
  }
}

module.exports = ActivityService;
