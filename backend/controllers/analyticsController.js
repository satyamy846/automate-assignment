const AnalyticsService = require("../services/analyticsService");
const ResponseHandler = require("../utils/responseHandler");

class AnalyticsController {
    static getAdminAnalytics = async (req, res) => {
        try {
            const data = await AnalyticsService.getAdminAnalyticsData();
            ResponseHandler.success(res, 200, "Admin analytics fetched successfully", {
                data,
            });
        } catch (error) {
            ResponseHandler.error(res, 500, "Internal Server Error", error.message);
        }
    }

    static getUserAnalytics = async (req, res) => {
        const userId = req.params.userId;

        try {
            const data = await AnalyticsService.getUserAnalyticsData(userId);
            ResponseHandler.success(res, 200, "User analytics fetched successfully", {
                data,
            });
        } catch (error) {
            ResponseHandler.error(res, 500, "Internal Server Error", error.message);
        }
    };
}

module.exports = AnalyticsController;