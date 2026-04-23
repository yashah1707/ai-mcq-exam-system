const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  year: { type: Number, required: true, min: 1, max: 4 },
  course: { type: String, required: true, trim: true, uppercase: true, default: 'GENERAL' },
  description: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

subjectSchema.index({ code: 1, year: 1, course: 1 }, { unique: true });
subjectSchema.index({ year: 1, course: 1, isActive: 1 });

module.exports = mongoose.model('Subject', subjectSchema);