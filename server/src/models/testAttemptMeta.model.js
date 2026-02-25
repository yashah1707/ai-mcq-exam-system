const mongoose = require('mongoose');

const testAttemptMetaSchema = new mongoose.Schema({
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, unique: true },

    // Rule-Based / AI Analysis
    timeManagementScore: { type: Number, min: 0, max: 100, default: 0 },
    guessWorkDetected: { type: Boolean, default: false },

    // Adaptive Context
    difficultyProfile: { type: String, default: 'Standard' }, // e.g., "Increasing", "Flat", "Oscillating"

    // Topic-Level Performance in THIS Test
    topicPerformance: [{
        topic: String,
        score: Number,
        totalQuestions: Number,
        strength: { type: String, enum: ['Strong', 'Average', 'Weak'] }
    }],

    // Explainability Log
    adaptiveDecisions: [{ type: String }], // e.g., "Increased difficulty due to 3 consecutive correct answers"

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestAttemptMeta', testAttemptMetaSchema);
