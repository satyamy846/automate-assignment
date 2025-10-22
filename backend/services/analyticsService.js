const { Client } = require("pg");
const { databaseLogger } = require("../utils/logger");

const conn = new Client({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
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
      databaseLogger.info("Fetching admin analytics summary...");

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

      databaseLogger.info("Admin analytics summary fetched successfully", {
        storageUsers: storageUsage.rowCount,
        activeUsers: mostActive.rowCount,
        totalUploads: totals.rows[0]?.total_uploads || 0,
        totalDeletions: totals.rows[0]?.total_deletions || 0,
      });

      return data;
    } catch (error) {
      databaseLogger.error("Admin analytics fetch failed", { error: error.message });
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
      databaseLogger.info("Fetching user analytics summary...", { userId });

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

      databaseLogger.info("User analytics fetched successfully", {
        userId,
        storageUsed: storage.rows[0]?.total_storage_used || 0,
        assetTypes: typeDistribution.rowCount,
        recentActivities: recentActivity.rowCount,
      });

      return data;
    } catch (error) {
      databaseLogger.error("User analytics fetch failed", { userId, error: error.message });
      throw new Error("Failed to fetch user analytics data");
    }
  }
}

module.exports = AnalyticsService;