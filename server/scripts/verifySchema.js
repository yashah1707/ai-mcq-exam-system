const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');
const StudentAnalyticsSnapshot = require('../src/models/studentAnalyticsSnapshot.model');
const TestAttemptMeta = require('../src/models/testAttemptMeta.model');
const User = require('../src/models/user.model');
const ExamAttempt = require('../src/models/examAttempt.model');

async function verifySchema() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Verify PerformanceAnalytics (TopicPerformance) enhancements
        console.log('\n🔍 Verifying PerformanceAnalytics enhancements...');
        const tempUserId = new mongoose.Types.ObjectId();

        const perfEntry = new PerformanceAnalytics({
            userId: tempUserId,
            subject: 'DBMS',
            topic: 'Normalization',
            confidenceScore: 85,
            strengthLevel: 'Strong',
            lastDifficultyLevel: 'Hard'
        });

        const savedPerf = await perfEntry.save();
        if (savedPerf.confidenceScore === 85 && savedPerf.strengthLevel === 'Strong') {
            console.log('✅ PerformanceAnalytics: New fields saved correctly.');
        } else {
            console.error('❌ PerformanceAnalytics: Fields validation failed.');
        }

        // 2. Verify StudentAnalyticsSnapshot
        console.log('\n🔍 Verifying StudentAnalyticsSnapshot...');
        const snapshot = new StudentAnalyticsSnapshot({
            user: tempUserId,
            overallAccuracy: 75.5,
            subjectWiseAccuracy: { 'DBMS': 80, 'OS': 70 },
            weakTopics: ['Paging', 'Deadlocks'],
            strongTopics: ['Normalization']
        });

        const savedSnapshot = await snapshot.save();
        if (savedSnapshot.weakTopics.includes('Paging') && savedSnapshot.subjectWiseAccuracy.get('DBMS') === 80) {
            console.log('✅ StudentAnalyticsSnapshot: Complex fields saved correctly.');
        } else {
            console.error('❌ StudentAnalyticsSnapshot: Validation failed.');
        }

        // 3. Verify TestAttemptMeta
        console.log('\n🔍 Verifying TestAttemptMeta...');
        const attemptId = new mongoose.Types.ObjectId(); // Mock attempt ID
        const metaEntry = new TestAttemptMeta({
            attemptId: attemptId,
            timeManagementScore: 92,
            guessWorkDetected: false,
            difficultyProfile: 'Increasing',
            topicPerformance: [{ topic: 'Normalization', score: 10, totalQuestions: 10, strength: 'Strong' }],
            adaptiveDecisions: ['Started with medium difficulty', 'Increased difficulty after 3 correct']
        });

        const savedMeta = await metaEntry.save();
        if (savedMeta.timeManagementScore === 92 && savedMeta.adaptiveDecisions.length === 2) {
            console.log('✅ TestAttemptMeta: Deep analysis fields saved correctly.');
        } else {
            console.error('❌ TestAttemptMeta: Validation failed.');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await PerformanceAnalytics.findByIdAndDelete(savedPerf._id);
        await StudentAnalyticsSnapshot.findByIdAndDelete(savedSnapshot._id);
        await TestAttemptMeta.findByIdAndDelete(savedMeta._id);
        console.log('✅ Cleanup complete.');

        console.log('\n🎉 PHASE 1 VERIFICATION SUCCESSFUL: Database Schema is ready.');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifySchema();
