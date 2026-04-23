const mongoose = require('mongoose');

const performanceAnalyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    topic: {
        type: String,
        required: true,
        trim: true
    },
    totalAttempts: { type: Number, default: 0 },
    correctAttempts: { type: Number, default: 0 },
    wrongAttempts: { type: Number, default: 0 },
    unattemptedCount: { type: Number, default: 0 },

    // Accuracy percentage (0-100)
    accuracy: { type: Number, default: 0 },

    // Average time spent per question in seconds
    avgTimeSeconds: { type: Number, default: 0 },

    // Consistency score (variance in performance) - placeholder for advanced analysis
    consistencyScore: { type: Number, default: 0 },

    // AI Analysis Fields
    confidenceScore: { type: Number, default: 0, min: 0, max: 100 },
    strengthLevel: {
        type: String,
        enum: ['Strong', 'Average', 'Weak', 'Unassessed'],
        default: 'Unassessed'
    },
    lastDifficultyLevel: { type: String, default: 'Medium' }, // Track difficulty of questions lately faced

    lastAttemptDate: { type: Date, default: Date.now }
});

// Composite index for fast lookups
performanceAnalyticsSchema.index({ userId: 1, subject: 1, topic: 1 }, { unique: true });
performanceAnalyticsSchema.index({ userId: 1, subject: 1 });

module.exports = mongoose.model('PerformanceAnalytics', performanceAnalyticsSchema);
