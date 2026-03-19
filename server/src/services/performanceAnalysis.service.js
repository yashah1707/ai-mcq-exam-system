const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const TestAttemptMeta = require('../models/testAttemptMeta.model');
const Question = require('../models/question.model');
const ExamAttempt = require('../models/examAttempt.model');

exports.analyzeAttempt = async (attemptId) => {
    console.log(`🔍 Analyzing attempt: ${attemptId}`);

    const attempt = await ExamAttempt.findById(attemptId).populate('answers.questionId');
    if (!attempt) throw new Error('Attempt not found');

    const userId = attempt.user;
    const answers = attempt.answers;

    // Track metrics per topic for this specific attempt
    const topicStats = {}; // { topicName: { total, correct, time } }
    let totalTime = 0;
    let fastAnswers = 0;

    for (const ans of answers) {
        const question = ans.questionId;
        if (!question) continue;

        const subject = question.subject || ans.subject || 'Aptitude';
        const topic = question.topic || 'General';
        const isCorrect = ans.isCorrect;
        const timeSpent = ans.timeSpentSeconds || 0;

        if (!topicStats[topic]) {
            topicStats[topic] = { total: 0, correct: 0, time: 0, difficultySum: 0 };
        }

        topicStats[topic].total++;
        if (isCorrect) topicStats[topic].correct++;
        topicStats[topic].time += timeSpent;
        totalTime += timeSpent;

        // Simple heuristic for guesswork: < 5 seconds for a non-trivial question
        if (timeSpent < 5) fastAnswers++;
    }

    // 1. Update Global TopicPerformance (PerformanceAnalytics)
    const topicUpdates = [];
    for (const [topic, stats] of Object.entries(topicStats)) {
        const sampleAnswer = answers.find(ans => (ans.questionId?.topic || 'General') === topic);
        const subject = sampleAnswer?.questionId?.subject || sampleAnswer?.subject || 'Aptitude';

        let analytics = await PerformanceAnalytics.findOne({ userId, subject, topic });

        if (!analytics) {
            analytics = new PerformanceAnalytics({ userId, subject, topic });
        }

        analytics.totalAttempts += stats.total;
        analytics.correctAttempts += stats.correct;
        analytics.wrongAttempts += (stats.total - stats.correct);

        // Update Accuracy
        analytics.accuracy = (analytics.correctAttempts / analytics.totalAttempts) * 100;

        // Update Avg Time (Weighted Average)
        // New Avg = ((Old Avg * Old Count) + New Time) / New Count
        const oldTotalTime = (analytics.avgTimeSeconds || 0) * (analytics.totalAttempts - stats.total);
        analytics.avgTimeSeconds = (oldTotalTime + stats.time) / analytics.totalAttempts;

        // Calculate Confidence Score (Simple Rule-Based)
        // High accuracy + Reasonable time = High Confidence
        // High accuracy + Very fast time = Lucky/Cheat? -> Lower confidence? No, let's trust for now but cap it.
        // Low accuracy = Low Confidence
        analytics.confidenceScore = Math.min(100, analytics.accuracy * 0.9 + (analytics.totalAttempts > 5 ? 10 : 0));

        // Determine Strength Level
        if (analytics.accuracy >= 80 && analytics.totalAttempts >= 3) analytics.strengthLevel = 'Strong';
        else if (analytics.accuracy >= 50) analytics.strengthLevel = 'Average';
        else analytics.strengthLevel = 'Weak';

        await analytics.save();
        topicUpdates.push({ topic, score: (stats.correct / stats.total) * 100, strength: analytics.strengthLevel });
    }

    // 2. Create TestAttemptMeta
    const meta = new TestAttemptMeta({
        attemptId: attempt._id,
        timeManagementScore: Math.min(100, Math.max(0, 100 - (fastAnswers * 5))), // Penalize fast answers
        guessWorkDetected: fastAnswers > (answers.length * 0.3), // >30% fast answers = guessing
        difficultyProfile: 'Standard', // TODO: Dynamic based on question difficulties
        topicPerformance: topicUpdates.map(t => ({
            topic: t.topic,
            score: t.score,
            totalQuestions: topicStats[t.topic].total,
            strength: t.strength
        })),
        adaptiveDecisions: [`Analyzed ${answers.length} questions across ${Object.keys(topicStats).length} topics.`]
    });

    await meta.save();
    console.log(`✅ Analysis complete for attempt ${attemptId}`);
    return meta;
};
