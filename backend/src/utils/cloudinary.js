import cloudinary from 'cloudinary';
import { env } from '../config/env.js';

const { v2 } = cloudinary;

v2.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

const ensureBuffer = (input) => {
  if (!input) {
    throw new Error('No file data provided for upload');
  }

  return Buffer.isBuffer(input) ? input : Buffer.from(input);
};

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = v2.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });

    stream.end(buffer);
  });

export const uploadToCloudinary = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = ensureBuffer(arrayBuffer);
  return uploadBuffer(buffer, { folder: 'product_categories' });
};

export const uploadImageToCloudinary = (buffer, folder = 'products') =>
  uploadBuffer(ensureBuffer(buffer), {
    folder,
    resource_type: 'image',
    quality: 'auto',
    fetch_format: 'auto',
  });

export const uploadPdfToCloudinary = (buffer, folder = 'products') =>
  uploadBuffer(ensureBuffer(buffer), {
    folder,
    resource_type: 'raw',
  });

export const uploadToCloudinaryfile = (
  buffer,
  fileType = 'auto',
  folder = 'products',
) =>
  uploadBuffer(ensureBuffer(buffer), {
    folder,
    resource_type: fileType || 'auto',
  });

export const uploadToCloudinaryBlog = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = ensureBuffer(arrayBuffer);
  return uploadBuffer(buffer, {
    folder: 'blogs',
    resource_type: 'image',
    quality: 'auto',
    fetch_format: 'auto',
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    return null;
  }

  return v2.uploader.destroy(publicId);
};

export default cloudinary;
