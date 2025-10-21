const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");
const { Client } = require("pg");
const { v4: uuidv4 } = require("uuid");
const { appLogger } = require("../utils/logger");

const conn = new Client({
  host: process.env.PG_HOST || "localhost",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "root",
  port: process.env.PG_PORT || 5432,
  database: "dams",
});
conn.connect();

class AssetService {
  static async uploadFile({ file, userId }) {
    const key = `${uuidv4()}-${file.originalname}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await s3Client.send(command);

    const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Store in DB
    const result = await conn.query(
      `INSERT INTO assets (user_id, filename, file_url, mime_type, size)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, file.originalname, fileUrl, file.mimetype, file.size]
    );

    return result.rows[0];
  }

  static async deleteAsset(assetId, userId) {
    const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1 and user_id=$2`, [assetId, userId]);
    if (!rows[0]) throw new Error("Asset not found or not owned by you.");

    const asset = rows[0];
    const key = asset.file_url.split("/").pop();

    // Delete from S3
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);

    // Delete from DB
    await conn.query(`DELETE FROM assets WHERE id=$1`, [assetId]);
    return { message: "Asset deleted successfully" };
  }

  static async getAssetsByUserRole(user) {
    let query;
    let params;
    appLogger.info("Fetching assets for user", { userId: user.id, role: user.role });
    if (user.role === "admin") {
      // Admin can see all assets
      query = `SELECT * FROM assets a
               ORDER BY a.created_at DESC`;
      params = [];
    } else {
      // Normal users see only their own assets
      query = `SELECT * FROM assets WHERE user_id=$1 ORDER BY created_at DESC`;
      params = [user.id];
    }

    const result = await conn.query(query, params);
    return result.rows;
  }

  static async updateAssetMetadata(user, assetId, file) {
    // Fetch asset
    const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
    if (!rows[0]) throw new Error("Asset not found");

    const asset = rows[0];

    // Ownership check
    if (user.role !== "admin" && asset.user_id !== user.id) {
      throw new Error("Unauthorized: You can only update your own assets");
    }

    // --- Delete old file from S3 ---
    const oldKey = asset.file_url.split("/").pop();
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: oldKey,
    });
    await s3Client.send(deleteCommand);

    // --- Upload new file to S3 ---
    const newKey = `${uuidv4()}-${file.originalname}`;
    const putCommand = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: newKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await s3Client.send(putCommand);

    const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;

    // --- Update DB record ---
    const result = await conn.query(
      `UPDATE assets
       SET filename=$1, file_url=$2, mime_type=$3, size=$4, updated_at=NOW()
       WHERE id=$5
       RETURNING *`,
      [file.originalname, fileUrl, file.mimetype, file.size, assetId]
    );

    return result.rows[0];
  }

  /**
   * Share an asset with a user
   */
  static async shareAsset(owner, assetId, sharedWithUserId) {
    // Check asset exists and ownership
    const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
    if (!rows[0]) throw new Error("Asset not found");

    const asset = rows[0];
    if (owner.role !== "admin" && asset.user_id !== owner.id) {
      throw new Error("Unauthorized: Only owner or admin can share this asset");
    }

    // Insert into shared_assets (avoid duplicate)
    const exists = await conn.query(
      `SELECT * FROM shared_assets WHERE asset_id=$1 AND shared_with=$2`,
      [assetId, sharedWithUserId]
    );

    if (exists.rows.length > 0) return { message: "Asset already shared with this user" };

    const result = await conn.query(
      `INSERT INTO shared_assets (asset_id, shared_with) VALUES ($1, $2) RETURNING *`,
      [assetId, sharedWithUserId]
    );

    return result.rows[0];
  }

  /**
   * Get shared asset by user access
   */
  static async getSharedAsset(user, assetId) {
    // Admin can view any asset
    if (user.role === "admin") {
      const result = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
      if (!result.rows[0]) throw new Error("Asset not found");
      return result.rows[0];
    }

    // Check shared_assets table
    const result = await conn.query(
      `SELECT a.* FROM assets a
       JOIN shared_assets s ON a.id = s.asset_id
       WHERE s.shared_with=$1 AND a.id=$2`,
      [user.id, assetId]
    );

    if (result.rows.length === 0) throw new Error("Unauthorized or asset not shared with you");

    return result.rows[0];
  }

  /**
   * List all assets shared with a user
   */
  static async listSharedAssets(user) {
    const result = await conn.query(
      `SELECT a.*, u.name AS owner_name, u.email AS owner_email
       FROM assets a
       JOIN shared_assets s ON a.id = s.asset_id
       JOIN users u ON a.user_id = u.id
       WHERE s.shared_with=$1
       ORDER BY s.created_at DESC`,
      [user.id]
    );

    return result.rows;
  }

}

module.exports = AssetService;
