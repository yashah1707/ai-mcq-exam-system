const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }, // Optional for adaptive mode
  mode: { type: String, enum: ['standard', 'adaptive'], default: 'standard' },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: { type: Number, default: null },
    isCorrect: { type: Boolean, default: null },
    marksAwarded: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    subject: { type: String }, // Snapshot for historical accuracy
    topic: { type: String }    // Snapshot for historical accuracy
  }],
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
