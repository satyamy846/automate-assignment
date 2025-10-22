const express = require("express");
const AnalyticsController = require("../controllers/analyticsController");
const { verifyAdmin, verifyUser } = require("../middlewares/sessionMiddleware");
const router = express.Router();

/**
 * @swagger
 * tags:
 *  name: Analytics
 *  description: Admin or User Analytics
 */

/**
 * @swagger
 * /analytics/admin:
 *   get:
 *     summary: Get overall admin analytics summary
 *     description: >
 *       Returns an overview of system-wide analytics including total storage usage, most active users, and total uploads/deletions.  
 *       This endpoint is restricted to admin users only.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin analytics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Admin analytics fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     storageUsage:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user_id:
 *                             type: string
 *                             example: "3c4e9e70-0f41-4f6b-bb09-d8e8b4a3a090"
 *                           name:
 *                             type: string
 *                             example: "John Doe"
 *                           total_storage_used:
 *                             type: number
 *                             example: 12345678
 *                     mostActiveUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user_id:
 *                             type: string
 *                             example: "9b2e1e57-bc94-46de-8f49-4a1fd04a4422"
 *                           name:
 *                             type: string
 *                             example: "Jane Smith"
 *                           activity_count:
 *                             type: integer
 *                             example: 42
 *                     totals:
 *                       type: object
 *                       properties:
 *                         total_uploads:
 *                           type: integer
 *                           example: 125
 *                         total_deletions:
 *                           type: integer
 *                           example: 17
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal Server Error
 */
router.get("/admin", verifyAdmin ,AnalyticsController.getAdminAnalytics);


/**
 * @swagger
 * /analytics/user/{userId}:
 *   get:
 *     summary: Get analytics for a specific user
 *     description: >
 *       Returns user-specific analytics data such as storage usage, asset type distribution, and recent activity logs.
 *       Accessible only to the user themselves or admins.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: Numeric ID of the user whose analytics to fetch
 *         schema:
 *           type: integer
 *           example: 2
 *     responses:
 *       200:
 *         description: User analytics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User analytics fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     personalStorage:
 *                       type: object
 *                       properties:
 *                         total_storage_used:
 *                           type: number
 *                           example: 5242880
 *                     assetDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           asset_type:
 *                             type: string
 *                             example: "Image"
 *                           count:
 *                             type: integer
 *                             example: 12
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                             example: "upload"
 *                           asset_id:
 *                             type: integer
 *                             example: 101
 *                           status:
 *                             type: string
 *                             example: "success"
 *                           message:
 *                             type: string
 *                             example: "File uploaded successfully"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-21T09:30:45.000Z"
 *       401:
 *         description: Unauthorized - User access required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
router.get("/user/:userId", verifyUser, AnalyticsController.getUserAnalytics);


module.exports = router;