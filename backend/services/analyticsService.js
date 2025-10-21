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

class AnalyticsService {
  /**
   * Fetch Admin Analytics Summary
   * Includes:
   *  - Storage usage across all users
   *  - Most active users
   *  - Total uploads/deletions
   */
  static async getAdminAnalyticsData() {
    try {
      const storageUsageQuery = `
        SELECT 
          u.id AS user_id, 
          u.name, 
          COALESCE(SUM(a.size), 0) AS total_storage_used
        FROM users u
        LEFT JOIN assets a ON a.user_id = u.id
        GROUP BY u.id, u.name
        ORDER BY total_storage_used DESC;
      `;

      const mostActiveQuery = `
        SELECT 
          u.id AS user_id, 
          u.name, 
          COUNT(al.id) AS activity_count
        FROM users u
        LEFT JOIN activity_logs al ON al.user_id = u.id
        GROUP BY u.id, u.name
        ORDER BY activity_count DESC
        LIMIT 10;
      `;

      const totalsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE action = 'upload') AS total_uploads,
          COUNT(*) FILTER (WHERE action = 'delete') AS total_deletions
        FROM activity_logs;
      `;

      const [storageUsage, mostActive, totals] = await Promise.all([
        conn.query(storageUsageQuery),
        conn.query(mostActiveQuery),
        conn.query(totalsQuery),
      ]);

      const data = {
        storageUsage: storageUsage.rows,
        mostActiveUsers: mostActive.rows,
        totals: totals.rows[0],
      };

      appLogger.info("Fetched admin analytics summary", {
        storageCount: storageUsage.rowCount,
        mostActiveCount: mostActive.rowCount,
      });

      return data;
    } catch (error) {
      appLogger.error("Error fetching admin analytics", { error: error.message });
      throw new Error("Failed to fetch admin analytics data");
    }
  }

  /**
   * Fetch User Analytics Summary
   * Includes:
   *  - Personal Storage Usage
   *  - Asset Type Distribution
   *  - Recent Activity Timeline
   */
  static async getUserAnalyticsData(userId) {
    try {
      const storageQuery = `
        SELECT COALESCE(SUM(size), 0) AS total_storage_used
        FROM assets
        WHERE user_id = $1;
      `;

      const typeDistributionQuery = `
        SELECT 
          CASE 
            WHEN mime_type LIKE 'image/%' THEN 'Image'
            WHEN mime_type LIKE 'video/%' THEN 'Video'
            WHEN mime_type LIKE 'application/%' THEN 'Document'
            ELSE 'Other'
          END AS asset_type,
          COUNT(*) AS count
        FROM assets
        WHERE user_id = $1
        GROUP BY asset_type;
      `;

      const recentActivityQuery = `
        SELECT 
          action, 
          asset_id, 
          status, 
          message, 
          created_at
        FROM activity_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10;
      `;

      const [storage, typeDistribution, recentActivity] = await Promise.all([
        conn.query(storageQuery, [userId]),
        conn.query(typeDistributionQuery, [userId]),
        conn.query(recentActivityQuery, [userId]),
      ]);

      const data = {
        personalStorage: storage.rows[0],
        assetDistribution: typeDistribution.rows,
        recentActivity: recentActivity.rows,
      };

      appLogger.info("Fetched user analytics summary", {
        userId,
        recentActivityCount: recentActivity.rowCount,
      });

      return data;
    } catch (error) {
      appLogger.error("Error fetching user analytics", { userId, error: error.message });
      throw new Error("Failed to fetch user analytics data");
    }
  }
}

module.exports = AnalyticsService;
