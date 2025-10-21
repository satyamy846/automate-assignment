const express = require("express");
const router = express.Router();
const multer = require("multer");
const AssetController = require("../controllers/assetController");

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @swagger
 * /assets/upload:
 *   post:
 *     summary: Upload a file
 *     tags:
 *       - Assets
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 */
router.post("/upload", upload.single("file"), AssetController.upload);

/**
 * @swagger
 * /assets/user:
 *   get:
 *     summary: Get all assets of a user
 *     tags:
 *       - Assets
 *     responses:
 *       200:
 *         description: List of assets
 */
router.get("/user", AssetController.getUserAssets);

/**
 * @swagger
 * /assets/{assetId}:
 *   delete:
 *     summary: Delete an asset
 *     tags:
 *       - Assets
 *     parameters:
 *       - in: path
 *         name: assetId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Asset deleted successfully
 */
router.delete("/:assetId", AssetController.delete);


/**
 * @swagger
 * /assets/file/{id}:
 *   put:
 *     summary: Update an existing asset file (admin can replace any, users can replace own)
 *     tags:
 *       - Assets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Asset ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Asset file replaced successfully
 *       400:
 *         description: No file uploaded
 *       403:
 *         description: Unauthorized
 */
router.put("/file/:id", upload.single("file"), AssetController.updateMetadata);


// Share an asset with another user
/**
 * @swagger
 * /assets/share/{id}:
 *   post:
 *     summary: Share an asset with another user (admin can share any, users can share own)
 *     tags:
 *       - Assets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Asset ID to share
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sharedWithUserId:
 *                 type: integer
 *                 description: User ID with whom the asset will be shared
 *     responses:
 *       200:
 *         description: Asset shared successfully
 *       400:
 *         description: sharedWithUserId is required
 *       403:
 *         description: Unauthorized
 */
router.post("/share/:id", AssetController.share);

// Get a shared asset by ID
/**
 * @swagger
 * /assets/shared/{id}:
 *   get:
 *     summary: View/download a shared asset by ID
 *     tags:
 *       - Assets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Asset ID
 *     responses:
 *       200:
 *         description: Shared asset retrieved successfully
 *       403:
 *         description: Unauthorized or asset not shared with the user
 */
router.get("/shared/:id", AssetController.getShared);

// List all assets shared with the current user
/**
 * @swagger
 * /assets/shared:
 *   get:
 *     summary: List all assets shared with the current user
 *     tags:
 *       - Assets
 *     responses:
 *       200:
 *         description: List of assets shared with the current user
 *       403:
 *         description: Unauthorized
 */
router.get("/shared", AssetController.listShared);

module.exports = router;
