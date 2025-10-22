const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");
const { Client } = require("pg");
const { v4: uuidv4 } = require("uuid");
const { databaseLogger } = require("../utils/logger");

const conn = new Client({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
});
conn.connect();

class AssetService {
  static async uploadFile({ file, userId }) {
    try {
      const key = `${uuidv4()}-${file.originalname}`;
      databaseLogger.info("Starting file upload", { userId, filename: file.originalname });

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      await s3Client.send(command);
      databaseLogger.info("File uploaded to S3 successfully", { userId, key });

      const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      // Store in DB
      const result = await conn.query(
        `INSERT INTO assets (user_id, filename, file_url, mime_type, size)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, file.originalname, fileUrl, file.mimetype, file.size]
      );

      databaseLogger.info("Asset metadata stored in database", { userId, assetId: result.rows[0].id });
      return result.rows[0];
    } catch (err) {
      databaseLogger.error("File upload failed", { error: err.message, userId });
      throw err;
    }
  }

  static async deleteAsset(assetId, userId) {
    try {
      databaseLogger.info("Attempting to delete asset", { assetId, userId });
      const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1 and user_id=$2`, [assetId, userId]);
      if (!rows[0]) {
        throw new Error("Asset not found or not owned by you.");
      }

      const asset = rows[0];
      const key = asset.file_url.split("/").pop();

      // Delete from S3
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
      databaseLogger.info("File deleted from S3", { assetId, userId });

      // Delete from DB
      await conn.query(`DELETE FROM assets WHERE id=$1`, [assetId]);
      databaseLogger.info("Asset record deleted from database", { assetId, userId });

      return { message: "Asset deleted successfully" };
    } catch (err) {
      databaseLogger.error("Asset deletion failed", { error: err.message, assetId, userId });
      throw err;
    }
  }

  static async getAssetsByUserRole(user) {
    try {
      databaseLogger.info("Fetching assets for user", { userId: user.id, role: user.role });

      let query;
      let params;

      if (user.role === "admin") {
        query = `SELECT * FROM assets ORDER BY created_at DESC`;
        params = [];
      } else {
        query = `SELECT * FROM assets WHERE user_id=$1 ORDER BY created_at DESC`;
        params = [user.id];
      }

      const result = await conn.query(query, params);
      databaseLogger.info("Assets retrieved successfully", { count: result.rowCount, userId: user.id });
      return result.rows;
    } catch (err) {
      databaseLogger.error("Fetching assets failed", { error: err.message, userId: user.id });
      throw err;
    }
  }

  static async updateAssetMetadata(user, assetId, file) {
    try {
      databaseLogger.info("Updating asset metadata", { userId: user.id, assetId });

      const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
      if (!rows[0]) throw new Error("Asset not found");
      const asset = rows[0];

      if (user.role !== "admin" && asset.user_id !== user.id) {
        throw new Error("Unauthorized: You can only update your own assets");
      }

      // Delete old file
      const oldKey = asset.file_url.split("/").pop();
      await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: oldKey }));
      databaseLogger.info("Old file deleted from S3", { assetId, oldKey });

      // Upload new file
      const newKey = `${uuidv4()}-${file.originalname}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: newKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      databaseLogger.info("New file uploaded to S3", { assetId, newKey });

      const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${newKey}`;
      const result = await conn.query(
        `UPDATE assets
         SET filename=$1, file_url=$2, mime_type=$3, size=$4, updated_at=NOW()
         WHERE id=$5
         RETURNING *`,
        [file.originalname, fileUrl, file.mimetype, file.size, assetId]
      );

      databaseLogger.info("Asset metadata updated in database", { assetId });
      return result.rows[0];
    } catch (err) {
      databaseLogger.error("Asset update failed", { error: err.message, assetId, userId: user.id });
      throw err;
    }
  }

  static async shareAsset(owner, assetId, sharedWithUserId) {
    try {
      databaseLogger.info("Sharing asset", { ownerId: owner.id, assetId, sharedWithUserId });

      const { rows } = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
      if (!rows[0]) throw new Error("Asset not found");

      const asset = rows[0];
      if (owner.role !== "admin" && asset.user_id !== owner.id) {
        throw new Error("Unauthorized: Only owner or admin can share this asset");
      }

      const exists = await conn.query(
        `SELECT * FROM shared_assets WHERE asset_id=$1 AND shared_with=$2`,
        [assetId, sharedWithUserId]
      );

      if (exists.rows.length > 0) {
        databaseLogger.info("Asset already shared with this user", { assetId, sharedWithUserId });
        return { message: "Asset already shared with this user" };
      }

      const result = await conn.query(
        `INSERT INTO shared_assets (asset_id, shared_with) VALUES ($1, $2) RETURNING *`,
        [assetId, sharedWithUserId]
      );

      databaseLogger.info("Asset shared successfully", { assetId, sharedWithUserId });
      return result.rows[0];
    } catch (err) {
      databaseLogger.error("Asset sharing failed", { error: err.message, assetId, ownerId: owner.id });
      throw err;
    }
  }

  static async getSharedAsset(user, assetId) {
    try {
      databaseLogger.info("Fetching shared asset", { userId: user.id, assetId });

      if (user.role === "admin") {
        const result = await conn.query(`SELECT * FROM assets WHERE id=$1`, [assetId]);
        if (!result.rows[0]) throw new Error("Asset not found");
        databaseLogger.info("Admin fetched shared asset", { userId: user.id, assetId });
        return result.rows[0];
      }

      const result = await conn.query(
        `SELECT a.* FROM assets a
         JOIN shared_assets s ON a.id = s.asset_id
         WHERE s.shared_with=$1 AND a.id=$2`,
        [user.id, assetId]
      );

      if (result.rows.length === 0) throw new Error("Unauthorized or asset not shared with you");
      databaseLogger.info("Shared asset retrieved", { userId: user.id, assetId });
      return result.rows[0];
    } catch (err) {
      databaseLogger.error("Fetching shared asset failed", { error: err.message, assetId, userId: user.id });
      throw err;
    }
  }

  static async listSharedAssets(user) {
    try {
      databaseLogger.info("Listing assets shared with user", { userId: user.id });

      const result = await conn.query(
        `SELECT a.*, u.name AS owner_name, u.email AS owner_email
         FROM assets a
         JOIN shared_assets s ON a.id = s.asset_id
         JOIN users u ON a.user_id = u.id
         WHERE s.shared_with=$1
         ORDER BY s.created_at DESC`,
        [user.id]
      );

      databaseLogger.info("Shared assets fetched successfully", { count: result.rowCount, userId: user.id });
      return result.rows;
    } catch (err) {
      databaseLogger.error("Listing shared assets failed", { error: err.message, userId: user.id });
      throw err;
    }
  }
}

module.exports = AssetService;