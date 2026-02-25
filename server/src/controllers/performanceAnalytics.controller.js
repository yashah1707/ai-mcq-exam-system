const mongoose = require('mongoose');
const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const ExamAttempt = require('../models/examAttempt.model');
const Question = require('../models/question.model');

// Calculate and update performance metrics after an exam attempt
exports.updatePerformanceMetrics = async (userId, examAttemptId) => {
    try {
        const attempt = await ExamAttempt.findById(examAttemptId).populate('answers.questionId');
        if (!attempt) return;

        // We process each answer to update subject/topic analytics
        for (const answer of attempt.answers) {
            if (!answer.questionId) continue;

            const question = answer.questionId;
            const subject = question.subject || 'Aptitude';
            const topic = question.topic || 'General';

            const isCorrect = answer.isCorrect;
            const timeSpent = answer.timeSpentSeconds || 0;

            // Find or create analytics record for this user+subject+topic
            let analytics = await PerformanceAnalytics.findOne({ userId, subject, topic });

            if (!analytics) {
                analytics = new PerformanceAnalytics({
                    userId,
                    subject,
                    topic,
                    totalAttempts: 0,
                    correctAttempts: 0,
                    wrongAttempts: 0,
                    unattemptedCount: 0,
                    accuracy: 0,
                    avgTimeSeconds: 0
                });
            }

            // Update counters
            analytics.totalAttempts += 1;
            if (isCorrect) {
                analytics.correctAttempts += 1;
            } else if (answer.selectedOption === undefined || answer.selectedOption === null) {
                // Depending on how you handle unattempted. Use specific logic if 'selectedOption' is explicitly null
                // But usually 'null' means skipped.
                analytics.unattemptedCount += 1;
            } else {
                analytics.wrongAttempts += 1;
            }

            // Update Average Time (Cumulative Moving Average)
            // New Avg = ((Old Avg * (N-1)) + New Value) / N
            // Here (N-1) is the count before this increment, which is (totalAttempts - 1)
            const prevTotal = analytics.totalAttempts - 1;
            analytics.avgTimeSeconds = ((analytics.avgTimeSeconds * prevTotal) + timeSpent) / analytics.totalAttempts;

            // Update Accuracy
            analytics.accuracy = (analytics.correctAttempts / analytics.totalAttempts) * 100;

            analytics.lastAttemptDate = new Date();

            await analytics.save();

            // --- Update Question Statistics ---
            // We use $inc and updates to avoid race conditions better than find/save
            // await Question.findByIdAndUpdate(question._id, {
            //   $inc: { 
            //     totalAttempts: 1, 
            //     correctAttempts: isCorrect ? 1 : 0 
            //   },
            //   // We can't easily do rolling average with atomic updates without aggregation or simplified math
            //   // For simplicity/performance, let's just use the current attempt's time contribution 
            //   // essentially we'd need the current avg and count. 
            //   // To be accurate, we might need a separate read or complex update pipeline.
            //   // Let's stick to simple increment for now and maybe re-calculate avg offline or:
            //   // avgTime = (oldTotalTime + newTime) / newCount. But we don't store totalTime.
            //   // Let's just skip avgTime on Question for now to avoid complexity, or do findOneAndUpdate.
            // });

            // Re-fetch to update avgTime accurately or use pipeline update (MongoDB 4.2+)
            // db.questions.updateOne(
            //   { _id: question._id },
            //   [{ $set: { avgTimeSeconds: { $divide: [ { $add: [ { $multiply: [ "$avgTimeSeconds", "$totalAttempts" ] }, timeSpent ] }, { $add: [ "$totalAttempts", 1 ] } ] } } }]
            // )
            // But totalAttempts was just incremented? If we use pipeline, we can do it all in one go.

            // Let's use a simpler approach: fetch, update, save for Question too.
            // It's not high concurrency yet.
            const qDoc = await Question.findById(question._id);
            if (qDoc) {
                // qDoc.totalAttempts and correctAttempts were NOT updated by the above $inc because we are separate.
                // Actually, let's remove the $inc above and do it here manually.
                const oldAttempts = qDoc.totalAttempts || 0;
                const newAttempts = oldAttempts + 1;
                qDoc.totalAttempts = newAttempts;
                if (isCorrect) qDoc.correctAttempts = (qDoc.correctAttempts || 0) + 1;

                const oldAvg = qDoc.avgTimeSeconds || 0;
                qDoc.avgTimeSeconds = ((oldAvg * oldAttempts) + timeSpent) / newAttempts;

                await qDoc.save();
            }
        }
        console.log(`Performance metrics updated for user ${userId}`);
    } catch (error) {
        console.error('Error updating performance metrics:', error);
    }
};

// Get student overall analytics
exports.getStudentAnalytics = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`[Analytics] Fetching for UserID: ${userId}`);

        // Aggregation to get subject-wise summary
        const subjectStats = await PerformanceAnalytics.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: "$subject",
                    totalAttempts: { $sum: "$totalAttempts" },
                    correctAttempts: { $sum: "$correctAttempts" },
                    avgAccuracy: { $avg: "$accuracy" }
                }
            }
        ]);

        console.log(`[Analytics] Found ${subjectStats.length} subject records.`);
        res.json({ success: true, data: subjectStats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get weak topics for a student
exports.getWeakTopics = async (req, res) => {
    try {
        const { userId } = req.params;
        const threshold = req.query.threshold || 50; // Default 50% accuracy

        const weakTopics = await PerformanceAnalytics.find({
            userId,
            accuracy: { $lt: threshold },
            totalAttempts: { $gt: 5 } // Only consider topics with enough data
        }).sort({ accuracy: 1 }).limit(10);

        res.json({ success: true, data: weakTopics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Calculate Placement Readiness Score
exports.getPlacementReadiness = async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch all analytics for the user
        const analytics = await PerformanceAnalytics.find({ userId: new mongoose.Types.ObjectId(userId) });

        if (!analytics || analytics.length === 0) {
            return res.json({
                success: true,
                data: {
                    score: 0,
                    level: 'Beginner',
                    insights: ['Not enough data to calculate readiness. Take more tests!']
                }
            });
        }

        // 1. Calculate weighted accuracy
        let totalAttempts = 0;
        let weightedAccuracySum = 0;

        // 2. Calculate topic coverage
        const uniqueTopics = new Set();
        const subjects = new Set();

        analytics.forEach(record => {
            totalAttempts += record.totalAttempts;
            weightedAccuracySum += (record.accuracy * record.totalAttempts);
            uniqueTopics.add(record.topic);
            subjects.add(record.subject);
        });

        const overallAccuracy = totalAttempts > 0 ? (weightedAccuracySum / totalAttempts) : 0;

        // 3. Consistency (Standard Deviation of accuracy across topics)
        const mean = overallAccuracy;
        const variance = analytics.reduce((sum, record) => sum + Math.pow(record.accuracy - mean, 2), 0) / analytics.length;
        const stdDev = Math.sqrt(variance);
        // Consistency score: Higher stdDev = Lower consistency. 
        // If stdDev is 0 (perfectly consistent), score is 100. If stdDev is 50 (very erratic), score is 0.
        // Let's simply map: 100 - stdDev (clamped at 0)
        let consistencyScore = Math.max(0, 100 - stdDev);

        // 4. Coverage Score (Arbitrarily say 20 topics is "good coverage")
        const coverageScore = Math.min(100, (uniqueTopics.size / 20) * 100);

        // FINAL SCORE FORMULA
        // Accuracy: 60%, Consistency: 20%, Coverage: 20%
        const readinessScore = (overallAccuracy * 0.6) + (consistencyScore * 0.2) + (coverageScore * 0.2);

        // Determine Level
        let level = 'Beginner';
        if (readinessScore > 80) level = 'Job Ready 🚀';
        else if (readinessScore > 60) level = 'Interview Ready';
        else if (readinessScore > 40) level = 'Intermediate';

        // Generate Insights
        const insights = [];
        if (overallAccuracy > 80) insights.push("Strong conceptual understanding.");
        else if (overallAccuracy < 50) insights.push("Focus on improving basic accuracy.");

        if (consistencyScore < 60) insights.push("Performance is inconsistent across topics.");

        if (coverageScore < 50) insights.push("Try attempting questions from more diverse topics.");

        res.json({
            success: true,
            data: {
                score: Math.round(readinessScore),
                level,
                breakdown: {
                    accuracy: Math.round(overallAccuracy),
                    consistency: Math.round(consistencyScore),
                    coverage: Math.round(coverageScore)
                },
                insights
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get AI Insights (Pass data to Python Service)
exports.getAIInsights = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const axios = require('axios'); // Lazy load or move to top

        // 1. Prepare Data for AI
        // Fetch last 5 exam attempts
        const recentAttempts = await ExamAttempt.find({ user: userId, status: 'completed' })
            .sort({ endTime: -1 })
            .limit(5);

        const recentScores = recentAttempts.map(a => Math.round((a.score / (a.answers.length || 1)) * 100)).reverse(); // % score

        // Fetch Topic Accuracy
        const riskAnalytics = await PerformanceAnalytics.find({ userId });
        const topicAccuracy = {};
        let totalAvgTime = 0;

        riskAnalytics.forEach(r => {
            topicAccuracy[r.topic] = Math.round(r.accuracy);
            totalAvgTime += r.avgTimeSeconds;
        });

        const avgTimePerQuestion = riskAnalytics.length > 0 ? (totalAvgTime / riskAnalytics.length) : 0;

        // 2. Call AI Service
        try {
            const aiResponse = await axios.post('http://localhost:5001/analyze-performance', {
                recentScores,
                topicAccuracy,
                avgTimePerQuestion
            });

            res.json({
                success: true,
                data: aiResponse.data
            });
        } catch (aiError) {
            console.error('AI Service Error:', aiError.message);
            // Fallback if AI is down
            res.json({
                success: true,
                data: {
                    profile: { cluster: "Data Unavailable", reason: "AI Service is currently offline." },
                    trend: { trend: "Unknown", reason: "AI Service is offline." },
                    weak_areas: [],
                    recommendation: "Continue practicing to generate more data."
                }
            });
        }

    } catch (error) {
        console.error('Error fetching AI insights:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch insights' });
    }
};
