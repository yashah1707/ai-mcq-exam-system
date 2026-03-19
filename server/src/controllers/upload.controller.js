const { uploadQuestionImageBuffer, deleteQuestionImageByPublicId } = require('../services/cloudinary.service');

const uploadQuestionImage = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('Image file is required');
    }

    const uploadResult = await uploadQuestionImageBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json(uploadResult);
  } catch (error) {
    next(error);
  }
};

const deleteQuestionImage = async (req, res, next) => {
  try {
    const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';

    if (!publicId) {
      res.status(400);
      throw new Error('Image publicId is required');
    }

    const result = await deleteQuestionImageByPublicId(publicId);
    res.json({ success: true, result: result.result || 'ok' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadQuestionImage,
  deleteQuestionImage,
};