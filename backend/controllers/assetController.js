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
      const userId = req.user.id; // You can replace this with req.user.id if using auth middleware
      if (!req.file) return ResponseHandler.error(res, 400, "No file uploaded");

      const asset = await AssetService.uploadFile({ file: req.file, userId });
      console.log("Uploaded Asset:", asset);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "upload",
        assetId: asset.id,
        message: "File uploaded successfully",
      });
      ResponseHandler.success(res, 201, "File uploaded successfully", { asset });
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "upload",
        status: "failed",
        message: err.message,
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Get all assets of a user
   */
  static async getUserAssets(req, res) {
    try {
      const user = req.user;
      if (!user) return ResponseHandler.error(res, 400, "No user provided");
      const assets = await AssetService.getAssetsByUserRole(user);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "get_user_assets",
        status: "success",
        message: "User assets retrieved successfully",
      });
      ResponseHandler.success(res, 200, "User assets retrieved successfully", {assets: assets});
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "get_user_assets",
        status: "failed",
        message: "User assets retrieval failed",
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * Delete asset
   */
  static async delete(req, res) {
    try {
      const assetId = req.params.assetId;
      const result = await AssetService.deleteAsset(assetId, req.user.id);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "delete_asset",
        status: "success",
        assetId: assetId,
        message: "Asset deleted successfully",
      });
      ResponseHandler.success(res, 200, "Asset deleted successfully", result);
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "delete_asset",
        status: "failed",
        assetId: assetId,
        message: "Asset deletion failed",
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }

   static async updateMetadata(req, res) {
    try {
      const user = req.user;
      const assetId = req.params.id;

      if (!req.file) return ResponseHandler.error(res, 400, "No file uploaded");

      const updatedAsset = await AssetService.updateAssetMetadata(user, assetId, req.file);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "update_asset_metadata",
        status: "success",
        assetId: assetId,
        message: "Asset metadata updated successfully",
      });

      ResponseHandler.success(res, 200, "Asset file replaced successfully", { asset: updatedAsset });
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "update_asset_metadata",
        status: "failed",
        assetId: assetId,
        message: "Asset metadata updated failed",
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }


  /**
   * Share an asset with another user
   */
  static async share(req, res) {
    try {
      const owner = req.user;
      const assetId = req.params.id;
      const { sharedWithUserId } = req.body;

      if (!sharedWithUserId) return ResponseHandler.error(res, 400, "sharedWithUserId is required");

      const shared = await AssetService.shareAsset(owner, assetId, sharedWithUserId);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "share_asset",
        status: "success",
        assetId: assetId,
        message: "Asset shared successfully",
      });
      ResponseHandler.success(res, 200, "Asset shared successfully", { shared });
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "share_asset",
        status: "failed",
        assetId: assetId,
        message: "Asset sharing failed",
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }

  /**
   * View/download a shared asset
   */
  static async getShared(req, res) {
    try {
      const user = req.user;
      const assetId = req.params.id;

      const asset = await AssetService.getSharedAsset(user, assetId);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "get_shared_asset",
        status: "success",
        assetId: assetId,
        message: "Shared asset retrieved successfully",
      });

      ResponseHandler.success(res, 200, "Shared asset retrieved successfully", { asset });
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "get_shared_asset",
        status: "failed",
        assetId: assetId,
        message: "Shared asset retrieval failed",
      });
      ResponseHandler.error(res, 403, err.message);
    }
  }

  /**
   * List all assets shared with the current user
   */
  static async listShared(req, res) {
    try {
      const user = req.user;
      const assets = await AssetService.listSharedAssets(user);
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "list_shared_assets",
        status: "success",
        message: "Shared assets retrieved successfully",
      });
      ResponseHandler.success(res, 200, "Shared assets retrieved successfully", { assets });
    } catch (err) {
      await ActivityService.recordActivity({
        userId: req.user.id,
        action: "list_shared_assets",
        status: "failed",
        message: "Failed to retrieve shared assets",
      });
      ResponseHandler.error(res, 500, err.message);
    }
  }
}

module.exports = AssetController;
