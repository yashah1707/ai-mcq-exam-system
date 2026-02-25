require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../src/models/question.model');
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

const migrate = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected for migration...');

        // 1. Update Questions
        console.log('Updating Questions...');
        const result = await Question.updateMany(
            { subject: { $exists: false } },
            {
                $set: {
                    subject: 'Aptitude',
                    topic: 'General',
                    totalAttempts: 0,
                    correctAttempts: 0,
                    avgTimeSeconds: 0
                }
            }
        );
        console.log(`Updated ${result.modifiedCount} questions with default subject/topic.`);

        // 2. Clear PerformanceAnalytics (should be empty anyway, but just in case)
        // Actually, let's not clear, but we could initialize for existing users if we wanted.
        // For now, we'll let them be created on demand.

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
