const AnalyticsService = require("../services/analyticsService");
const ResponseHandler = require("../utils/responseHandler");
const { appLogger } = require("../utils/logger");

class AnalyticsController {
    /**
     * Get analytics data for admin
     */
    static getAdminAnalytics = async (req, res) => {
        try {
            const adminId = req.user?.id || "unknown";
            appLogger.info("Admin analytics fetch initiated", { requested_by: adminId });

            const data = await AnalyticsService.getAdminAnalyticsData();

            appLogger.info("Admin analytics fetched successfully", {
                requested_by: adminId,
                total_users: data?.totalUsers,
                total_assets: data?.totalAssets,
            });

            return ResponseHandler.success(res, 200, "Admin analytics fetched successfully", { data });
        } catch (error) {
            appLogger.error("Failed to fetch admin analytics", {
                requested_by: req.user?.id,
                error: error.message,
            });
            return ResponseHandler.error(res, 500, "Internal Server Error", error.message);
        }
    };

    /**
     * Get analytics data for a specific user
     */
    static getUserAnalytics = async (req, res) => {
        const userId = req.params.userId;

        try {
            appLogger.info("User analytics fetch initiated", { user_id: userId, requested_by: req.user?.id });

            const data = await AnalyticsService.getUserAnalyticsData(userId);

            appLogger.info("User analytics fetched successfully", {
                user_id: userId,
                requested_by: req.user?.id,
                data_summary: {
                    storage_used: data?.storageUsed,
                    assets_count: data?.assetCount,
                },
            });

            return ResponseHandler.success(res, 200, "User analytics fetched successfully", { data });
        } catch (error) {
            appLogger.error("Failed to fetch user analytics", {
                user_id: userId,
                requested_by: req.user?.id,
                error: error.message,
            });
            return ResponseHandler.error(res, 500, "Internal Server Error", error.message);
        }
    };
}

module.exports = AnalyticsController;