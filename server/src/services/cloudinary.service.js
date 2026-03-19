const { v2: cloudinary } = require('cloudinary');

let configured = false;

const ensureCloudinaryConfigured = () => {
  if (configured) {
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  configured = true;
  return cloudinary;
};

const uploadQuestionImageBuffer = (buffer, originalName, mimetype) => {
  const cloudinaryClient = ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinaryClient.uploader.upload_stream(
      {
        folder: 'ai-mcq/questions',
        resource_type: 'image',
        public_id: originalName ? originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) : undefined,
        overwrite: false,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          imageUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          mimetype,
        });
      }
    );

    stream.end(buffer);
  });
};

const deleteQuestionImageByPublicId = async (publicId) => {
  if (!publicId) {
    return { result: 'not_found' };
  }

  const cloudinaryClient = ensureCloudinaryConfigured();
  return cloudinaryClient.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
};

module.exports = {
  uploadQuestionImageBuffer,
  deleteQuestionImageByPublicId,
};