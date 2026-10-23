import mongoose from 'mongoose';
import ItemReport from '../models/ItemReport.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { config } from '../config/env.js';
import { detectImageType } from '../utils/imageType.js';
import { isItemOwner, toOwnerItem } from '../utils/serializers.js';
import { uploadImage, deleteImage } from '../services/cloudinary.js';

async function loadOwnedItem(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Report not found');
  const item = await ItemReport.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Report not found');
  if (!isItemOwner(item, req.user._id)) throw new ApiError(403, 'You can only change photos on your own reports');
  return item;
}

const logCleanup = (err) => {
  if (config.nodeEnv !== 'test') console.error('Image cleanup failed:', err.message);
};

export const getPublicConfig = (_req, res) => {
  res.json({ success: true, data: { uploadsEnabled: config.cloudinaryEnabled } });
};

export const uploadItemImage = asyncHandler(async (req, res) => {
  if (!config.cloudinaryEnabled) throw new ApiError(503, 'Photo upload is not configured on this server');
  const item = await loadOwnedItem(req);
  if (item.status !== 'ACTIVE') throw new ApiError(409, 'Photos can only be changed on active reports');
  if (!req.file) throw new ApiError(400, 'Choose an image to upload');

  // Do not trust the declared type: check the real bytes and make sure they agree.
  const detected = detectImageType(req.file.buffer);
  if (!detected || detected !== req.file.mimetype) throw new ApiError(400, 'The file is not a valid JPEG, PNG or WebP image');

  let uploaded;
  try {
    uploaded = await uploadImage(req.file.buffer);
  } catch (err) {
    if (config.nodeEnv !== 'test') console.error('Image upload failed:', err.message);
    throw new ApiError(502, 'The image service could not process the upload. Please try again later.');
  }

  const previousId = item.imagePublicId;
  const updated = await ItemReport.findOneAndUpdate(
    { _id: item._id, status: 'ACTIVE' },
    { $set: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId } },
    { new: true },
  );
  if (!updated) {
    await deleteImage(uploaded.publicId).catch(logCleanup); // the report changed while uploading: do not leave an orphan
    throw new ApiError(409, 'This report can no longer be changed');
  }
  if (previousId) await deleteImage(previousId).catch(logCleanup);
  res.json({ success: true, data: { item: toOwnerItem(updated) } });
});

export const removeItemImage = asyncHandler(async (req, res) => {
  const item = await loadOwnedItem(req);
  if (!item.imageUrl) throw new ApiError(404, 'This report has no photo');
  const updated = await ItemReport.findOneAndUpdate(
    { _id: item._id, imageUrl: { $ne: '' } },
    { $set: { imageUrl: '', imagePublicId: '' } },
    { new: true },
  );
  if (!updated) throw new ApiError(404, 'This report has no photo');
  if (item.imagePublicId && config.cloudinaryEnabled) await deleteImage(item.imagePublicId).catch(logCleanup);
  res.json({ success: true, data: { item: toOwnerItem(updated) } });
});
