const mongoose = require('mongoose');

const hasValidOptions = (options) => (
  Array.isArray(options)
  && options.length >= 2
  && options.every((option) => typeof option === 'string' && option.trim().length > 0)
);

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: hasValidOptions,
      message: 'Provide at least 2 non-empty options'
    }
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function validateCorrectAnswer(value) {
        return Number.isInteger(value) && Array.isArray(this.options) && value >= 0 && value < this.options.length;
      },
      message: 'Correct answer index is out of range for the available options'
    }
  },
  category: { type: String, enum: ['Aptitude', 'Logical', 'Technical'], required: true },

  // New fields for AI Analysis
  subject: {
    type: String,
    enum: ['DBMS', 'OS', 'CN', 'DSA', 'Aptitude', 'Logical', 'Verbal'],
    required: true,
    default: 'Aptitude' // Default for migration
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    default: 'General' // Default for migration
  },

  // Statistics tracking
  totalAttempts: { type: Number, default: 0 },
  correctAttempts: { type: Number, default: 0 },
  avgTimeSeconds: { type: Number, default: 0 },

  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  marks: { type: Number, required: true, default: 1 },
  negativeMarks: { type: Number, default: 0, min: 0 },
  questionImageUrl: { type: String, default: '' },
  questionImagePublicId: { type: String, default: '' },
  explanation: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Question', questionSchema);
