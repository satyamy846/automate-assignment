const ActivityService = require("../services/activityService");
const AssetService = require("../services/assetService");
const { appLogger } = require("../utils/logger");
const ResponseHandler = require("../utils/responseHandler");

class AssetController {
  /**
   * Upload asset to S3 & save in DB
   */
  static async upload(req, res) {
    try {
      const userId = req.user.id;
      appLogger.info("Asset upload initiated", { user_id: userId });

      if (!req.file) {
        appLogger.warn("No file provided for upload", { user_id: userId });
        return ResponseHandler.error(res, 400, "No file uploaded");
      }

      const asset = await AssetService.uploadFile({ file: req.file, userId });
      appLogger.info("File uploaded successfully", { user_id: userId, asset_id: asset.id });

      await ActivityService.recordActivity({
        userId,
        action: "upload",
        assetId: asset.id,
        message: "File uploaded successfully",
      });

      return ResponseHandler.success(res, 201, "File uploaded successfully", { asset });
    } catch (err) {
      appLogger.error("Asset upload failed", { user_id: req.user?.id, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "upload",
        status: "failed",
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Get all assets of a user
   */
  static async getUserAssets(req, res) {
    try {
      const user = req.user;
      appLogger.info("Fetching user assets", { user_id: user.id });

      if (!user) {
        appLogger.warn("Attempt to get assets without valid user");
        return ResponseHandler.error(res, 400, "No user provided");
      }

      const assets = await AssetService.getAssetsByUserRole(user);
      appLogger.info("User assets retrieved successfully", { user_id: user.id, count: assets.length });

      await ActivityService.recordActivity({
        userId: user.id,
        action: "get_user_assets",
        status: "success",
        message: "User assets retrieved successfully",
      });

      return ResponseHandler.success(res, 200, "User assets retrieved successfully", { assets });
    } catch (err) {
      appLogger.error("Failed to retrieve user assets", { user_id: req.user?.id, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "get_user_assets",
        status: "failed",
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Delete asset
   */
  static async delete(req, res) {
    const assetId = req.params.assetId;
    try {
      appLogger.info("Asset delete request received", { user_id: req.user.id, asset_id: assetId });

      const result = await AssetService.deleteAsset(assetId, req.user.id);
      appLogger.info("Asset deleted successfully", { user_id: req.user.id, asset_id: assetId });

      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "delete_asset",
        status: "success",
        assetId,
        message: "Asset deleted successfully",
      });

      return ResponseHandler.success(res, 200, "Asset deleted successfully", result);
    } catch (err) {
      appLogger.error("Asset deletion failed", { user_id: req.user?.id, asset_id: assetId, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "delete_asset",
        status: "failed",
        assetId,
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Update asset metadata or replace file
   */
  static async updateMetadata(req, res) {
    const assetId = req.params.id;
    try {
      const user = req.user;
      appLogger.info("Asset metadata update initiated", { user_id: user.id, asset_id: assetId });

      if (!req.file) {
        appLogger.warn("No file provided for metadata update", { user_id: user.id });
        return ResponseHandler.error(res, 400, "No file uploaded");
      }

      const updatedAsset = await AssetService.updateAssetMetadata(user, assetId, req.file);
      appLogger.info("Asset metadata updated successfully", { user_id: user.id, asset_id: assetId });

      await ActivityService.recordActivity({
        userId: user.id,
        action: "update_asset_metadata",
        status: "success",
        assetId,
        message: "Asset metadata updated successfully",
      });

      return ResponseHandler.success(res, 200, "Asset file replaced successfully", { asset: updatedAsset });
    } catch (err) {
      appLogger.error("Asset metadata update failed", { user_id: req.user?.id, asset_id: assetId, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "update_asset_metadata",
        status: "failed",
        assetId,
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Share an asset with another user
   */
  static async share(req, res) {
    const assetId = req.params.id;
    try {
      const owner = req.user;
      const { sharedWithUserId } = req.body;

      appLogger.info("Asset share request", { owner_id: owner.id, asset_id: assetId, shared_with: sharedWithUserId });

      if (!sharedWithUserId) {
        appLogger.warn("Missing sharedWithUserId in share request", { owner_id: owner.id });
        return ResponseHandler.error(res, 400, "sharedWithUserId is required");
      }

      const shared = await AssetService.shareAsset(owner, assetId, sharedWithUserId);
      appLogger.info("Asset shared successfully", { owner_id: owner.id, shared_with: sharedWithUserId, asset_id: assetId });

      await ActivityService.recordActivity({
        userId: owner.id,
        action: "share_asset",
        status: "success",
        assetId,
        message: "Asset shared successfully",
      });

      return ResponseHandler.success(res, 200, "Asset shared successfully", { shared });
    } catch (err) {
      appLogger.error("Asset sharing failed", { user_id: req.user?.id, asset_id: assetId, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "share_asset",
        status: "failed",
        assetId,
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * View/download a shared asset
   */
  static async getShared(req, res) {
    const assetId = req.params.id;
    try {
      const user = req.user;
      appLogger.info("Fetching shared asset", { user_id: user.id, asset_id: assetId });

      const asset = await AssetService.getSharedAsset(user, assetId);
      appLogger.info("Shared asset retrieved successfully", { user_id: user.id, asset_id: assetId });

      await ActivityService.recordActivity({
        userId: user.id,
        action: "get_shared_asset",
        status: "success",
        assetId,
        message: "Shared asset retrieved successfully",
      });

      return ResponseHandler.success(res, 200, "Shared asset retrieved successfully", { asset });
    } catch (err) {
      appLogger.error("Shared asset retrieval failed", { user_id: req.user?.id, asset_id: assetId, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "get_shared_asset",
        status: "failed",
        assetId,
        message: err.message,
      });
      return ResponseHandler.error(res, 403, err.message);
    }
  }

  /**
   * List all assets shared with the current user
   */
  static async listShared(req, res) {
    try {
      const user = req.user;
      appLogger.info("Fetching list of shared assets", { user_id: user.id });

      const assets = await AssetService.listSharedAssets(user);
      appLogger.info("Shared assets retrieved successfully", { user_id: user.id, count: assets.length });

      await ActivityService.recordActivity({
        userId: user.id,
        action: "list_shared_assets",
        status: "success",
        message: "Shared assets retrieved successfully",
      });

      return ResponseHandler.success(res, 200, "Shared assets retrieved successfully", { assets });
    } catch (err) {
      appLogger.error("Failed to retrieve shared assets", { user_id: req.user?.id, error: err.message });
      await ActivityService.recordActivity({
        userId: req.user?.id,
        action: "list_shared_assets",
        status: "failed",
        message: err.message,
      });
      return ResponseHandler.error(res, 500, err.message);
    }
  }
}

module.exports = AssetController;
