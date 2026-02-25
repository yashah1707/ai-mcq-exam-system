const mongoose = require('mongoose');

const studentAnalyticsSnapshotSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },

    // Overall Metrics
    overallAccuracy: { type: Number, default: 0 },
    averageTimePerQuestion: { type: Number, default: 0 },

    // Subject-wise Breakdown
    subjectWiseAccuracy: {
        type: Map,
        of: Number, // Subject Name -> Accuracy %
        default: {}
    },

    // Key Insights
    weakTopics: [{ type: String }],
    strongTopics: [{ type: String }],

    improvementRate: { type: Number, default: 0 } // vs last snapshot
});

// Index for efficient retrieval by user and date sorting
studentAnalyticsSnapshotSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('StudentAnalyticsSnapshot', studentAnalyticsSnapshotSchema);
