require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

const debug = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected...');

        const analytics = await PerformanceAnalytics.find({});

        if (analytics.length === 0) {
            console.log('No analytics data found.');
            process.exit(0);
        }

        const userId = analytics[0].userId;
        console.log(`Testing aggregation for User ID: ${userId} (${typeof userId})`);

        // TEST 1: Raw Match
        const rawMatch = await PerformanceAnalytics.find({ userId: userId });
        console.log(`Raw Match Count: ${rawMatch.length}`);

        // TEST 2: Aggregation with String ID (Simulating potential bug)
        console.log('\n--- AGGREGATION TEST (String ID) ---');
        const aggString = await PerformanceAnalytics.aggregate([
            { $match: { userId: userId.toString() } },
            { $group: { _id: "$subject", totalAttempts: { $sum: "$totalAttempts" } } }
        ]);
        console.log('Result:', aggString);

        // TEST 3: Aggregation with ObjectId (Correct way)
        console.log('\n--- AGGREGATION TEST (ObjectId) ---');
        const aggObject = await PerformanceAnalytics.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId.toString()) } },
            { $group: { _id: "$subject", totalAttempts: { $sum: "$totalAttempts" } } }
        ]);
        console.log('Result:', aggObject);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debug();
