const mongoose = require('mongoose');

const labBatchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, default: 0, min: 0 },
}, { _id: true });

const academicClassSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  year: { type: Number, min: 1, max: 4, default: 1 },
  course: { type: String, trim: true, uppercase: true, default: 'GENERAL' },
  capacity: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '', trim: true },
  labBatches: { type: [labBatchSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AcademicClass', academicClassSchema);