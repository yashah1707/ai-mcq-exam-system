const mongoose = require('mongoose');
const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const ExamAttempt = require('../models/examAttempt.model');
const Question = require('../models/question.model');
const {
    getStudentOverallReport,
    getStudentSubjectHistoryReport,
} = require('../services/reporting.service');

function ensureSelfOrAdmin(req, userId) {
    const requestUserId = String(req.user?._id || req.user?.id || '');
    if (req.user?.role === 'admin') {
        return;
    }

    if (requestUserId !== String(userId)) {
        const error = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
    }
}

// Optional Redis-backed cache for AI insights (fallback to in-memory)
let redisClient = null;
const inMemoryCache = new Map();

async function initRedis() {
    if (redisClient || !process.env.REDIS_URL) return;
    try {
        const { createClient } = require('redis');
        redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.on('error', (err) => console.error('Redis error', err));
        await redisClient.connect();
        console.log('Connected to Redis for analytics cache');
    } catch (err) {
        console.warn('Redis not available, using in-memory cache', err.message);
        redisClient = null;
    }
}

async function setCache(key, value, ttlMs = 300000) {
    await initRedis();
    const str = JSON.stringify(value);
    if (redisClient) {
        try {
            await redisClient.set(key, str, { PX: ttlMs });
            return;
        } catch (err) {
            console.warn('Redis set failed, falling back to memory', err.message);
        }
    }
    const expires = Date.now() + ttlMs;
    inMemoryCache.set(key, { value, expires });
}

async function getCache(key) {
    await initRedis();
    if (redisClient) {
        try {
            const raw = await redisClient.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            console.warn('Redis get failed, falling back to memory', err.message);
        }
    }
    const entry = inMemoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        inMemoryCache.delete(key);
        return null;
    }
    return entry.value;
}

// Pure helper: compute placement readiness from analytics records
function computePlacementReadiness(analytics) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const totalAttempts = analytics.reduce((s, r) => s + (r.totalAttempts || 0), 0) || 1;
    const uniqueTopics = new Set();
    analytics.forEach(r => uniqueTopics.add(r.topic));

    let weightedAccuracySum = 0;
    let weightSum = 0;
    let weightedAvgTimeSum = 0;

    analytics.forEach(record => {
        const attempts = record.totalAttempts || 0;
        const topicImportance = attempts / totalAttempts;
        const last = record.lastAttemptDate ? new Date(record.lastAttemptDate).getTime() : now;
        const daysSince = Math.max(0, (now - last) / MS_PER_DAY);
        const recencyWeight = Math.exp(-daysSince / 45);
        const w = topicImportance * recencyWeight;
        weightSum += w;
        weightedAccuracySum += (record.accuracy || 0) * w;
        weightedAvgTimeSum += (record.avgTimeSeconds || 0) * w;
    });

    const overallAccuracy = weightSum > 0 ? (weightedAccuracySum / weightSum) : 0;
    const avgTimePerQuestion = weightSum > 0 ? (weightedAvgTimeSum / weightSum) : 0;

    const meanAcc = analytics.length ? (analytics.reduce((s, r) => s + (r.accuracy || 0), 0) / analytics.length) : overallAccuracy;
    const variance = analytics.length ? analytics.reduce((sum, r) => sum + Math.pow((r.accuracy || 0) - meanAcc, 2), 0) / analytics.length : 0;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, Math.min(100, 100 - stdDev));

    const coverageScore = Math.min(100, (uniqueTopics.size / 20) * 100);

    const desiredTime = 60;
    let speedScore = desiredTime > 0 ? (desiredTime / (avgTimePerQuestion || desiredTime)) * 100 : 50;
    speedScore = Math.max(0, Math.min(100, speedScore));

    const readinessScore = (overallAccuracy * 0.55) + (consistencyScore * 0.15) + (coverageScore * 0.15) + (speedScore * 0.15);

    let level = 'Beginner';
    if (readinessScore >= 85) level = 'Job Ready 🚀';
    else if (readinessScore >= 70) level = 'Interview Ready';
    else if (readinessScore >= 50) level = 'Learning (Intermediate)';

    const insights = [];
    if (overallAccuracy >= 80) insights.push('Strong overall accuracy across topics.');
    if (overallAccuracy < 60) insights.push('Work on improving core accuracy in weak topics.');
    if (consistencyScore < 60) insights.push('Performance varies across topics; focus on weakest areas.');
    if (coverageScore < 50) insights.push('Expand topic coverage: attempt questions from more topics.');
    if (avgTimePerQuestion > desiredTime * 1.5) insights.push('Consider improving speed; practice timed quizzes.');

    const weakAreas = analytics.filter(r => (r.totalAttempts || 0) >= 3).sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0)).slice(0, 6).map(r => ({ subject: r.subject, topic: r.topic, accuracy: Math.round(r.accuracy || 0), attempts: r.totalAttempts || 0 }));
    const strongAreas = analytics.filter(r => (r.totalAttempts || 0) >= 3).sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0)).slice(0, 6).map(r => ({ subject: r.subject, topic: r.topic, accuracy: Math.round(r.accuracy || 0), attempts: r.totalAttempts || 0 }));

    const actionPlan = weakAreas.slice(0, 3).map(w => `Practice ${w.topic} (${w.subject}) — current accuracy ${w.accuracy}% with ${w.attempts} attempts`);

    return {
        score: Math.round(readinessScore),
        level,
        breakdown: {
            accuracy: Math.round(overallAccuracy),
            consistency: Math.round(consistencyScore),
            coverage: Math.round(coverageScore),
            speed: Math.round(speedScore),
            avgTimePerQuestion: Math.round(avgTimePerQuestion)
        },
        insights,
        weakAreas,
        strongAreas,
        actionPlan
    };
}

// Pure helper: compute a simple local AI-like insights fallback
function computeLocalAIInsights(recentScores, riskAnalytics) {
    const allAccuracies = riskAnalytics.map(r => r.accuracy || 0);
    const overallAccuracy = allAccuracies.length ? (allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length) : 0;

    let trend = { trend: 'Unknown', reason: 'Not enough recent data' };
    if (recentScores && recentScores.length >= 2) {
        const diffs = [];
        for (let i = 1; i < recentScores.length; i++) diffs.push(recentScores[i] - recentScores[i - 1]);
        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        trend = { trend: avgDiff > 0 ? 'Improving' : (avgDiff < 0 ? 'Declining' : 'Stable'), reason: `Average change ${avgDiff.toFixed(2)}% per attempt` };
    }

    const weakAreas = (riskAnalytics.filter(r => (r.accuracy || 0) < 60 && (r.totalAttempts || 0) >= 3)
        .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))
        .slice(0, 5)
        .map(r => ({ topic: r.topic, accuracy: Math.round(r.accuracy || 0), attempts: r.totalAttempts || 0 })));

    return {
        profile: { cluster: overallAccuracy >= 75 ? 'High' : (overallAccuracy >= 50 ? 'Medium' : 'Low'), reason: 'Based on per-topic accuracy averages' },
        trend,
        weak_areas: weakAreas,
        recommendation: weakAreas.length ? `Focus on ${weakAreas[0].topic}` : 'Keep practicing to gather more data.'
    };
}

// Simple circuit-breaker state for AI service
let aiConsecutiveFailures = 0;
let aiCircuitOpenUntil = 0; // timestamp
const AI_CIRCUIT_THRESHOLD = parseInt(process.env.AI_CIRCUIT_THRESHOLD || '5', 10);
const AI_CIRCUIT_OPEN_MS = parseInt(process.env.AI_CIRCUIT_OPEN_MS || String(2 * 60 * 1000), 10); // default 2 minutes
let aiLastUnavailableLogAt = 0;
const AI_UNAVAILABLE_LOG_INTERVAL_MS = parseInt(process.env.AI_UNAVAILABLE_LOG_INTERVAL_MS || '60000', 10);

function isAiServiceUnavailable(error) {
    const code = error?.code || '';
    const message = error?.message || '';
    return ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(code)
        || /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|socket hang up/i.test(message);
}

function logAiFallback(message, detail) {
    const now = Date.now();
    if (now - aiLastUnavailableLogAt < AI_UNAVAILABLE_LOG_INTERVAL_MS) {
        return;
    }

    aiLastUnavailableLogAt = now;
    if (detail) {
        console.warn(message, detail);
    } else {
        console.warn(message);
    }
}

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
        ensureSelfOrAdmin(req, userId);
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
        ensureSelfOrAdmin(req, userId);
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
        ensureSelfOrAdmin(req, userId);

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

        // Use pure helper for readiness computation
        const result = computePlacementReadiness(analytics);
        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get AI Insights (Pass data to Python Service)
exports.getAIInsights = async (req, res) => {
    try {
        const { userId } = req.params;
        ensureSelfOrAdmin(req, userId);
        const axios = require('axios'); // Lazy load or move to top

        const cached = await getCache(`ai_insights_${userId}`);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        // 1. Prepare Data for AI
        // Fetch last 8 exam attempts (more data for better trend)
        const recentAttempts = await ExamAttempt.find({ user: userId, status: 'completed' })
            .sort({ endTime: -1 })
            .limit(8);

        const recentScores = recentAttempts.map(a => {
            const totalQ = a.answers?.length || 1;
            const sc = typeof a.score === 'number' ? a.score : 0;
            return Math.round((sc / totalQ) * 100);
        }).reverse(); // oldest -> newest

        // Fetch Topic Accuracy
        const riskAnalytics = await PerformanceAnalytics.find({ userId });
        const topicAccuracy = {};
        let totalAvgTime = 0;

        riskAnalytics.forEach(r => {
            topicAccuracy[r.topic || `${r.subject}_general`] = Math.round(r.accuracy || 0);
            totalAvgTime += (r.avgTimeSeconds || 0);
        });

        const avgTimePerQuestion = riskAnalytics.length > 0 ? (totalAvgTime / riskAnalytics.length) : 0;

        // 2. Call AI Service with retry and exponential backoff
        const aiServiceBase = process.env.AI_SERVICE_URL || 'http://localhost:5001';
        const aiUrl = `${aiServiceBase.replace(/\/$/, '')}/analyze-performance`;
        const now = Date.now();

        // Short-circuit if circuit is open
        if (aiCircuitOpenUntil && now < aiCircuitOpenUntil) {
            logAiFallback('AI circuit open, using local fallback insights');
        } else {
            // Check cache first
            const cached = await getCache(`ai_insights_${userId}`);
            if (cached) return res.json({ success: true, data: cached, cached: true });
        }
        let aiResponseData = null;
        const maxRetries = 2;
        aiResponseData = null;
        if (!aiCircuitOpenUntil || Date.now() >= aiCircuitOpenUntil) {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const r = await axios.post(aiUrl, { recentScores, topicAccuracy, avgTimePerQuestion }, { timeout: 5000 });
                    aiResponseData = r.data;
                    // reset failures on success
                    aiConsecutiveFailures = 0;
                    break;
                } catch (err) {
                    if (isAiServiceUnavailable(err)) {
                        aiConsecutiveFailures = AI_CIRCUIT_THRESHOLD;
                        aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_OPEN_MS;
                        logAiFallback(`AI service unavailable at ${aiUrl}; using local fallback insights.`, err.message);
                        break;
                    }

                    aiConsecutiveFailures += 1;
                    console.warn(`AI call attempt ${attempt + 1} failed:`, err.message);
                    if (aiConsecutiveFailures >= AI_CIRCUIT_THRESHOLD) {
                        aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_OPEN_MS;
                        logAiFallback(`Opening AI circuit until ${new Date(aiCircuitOpenUntil).toISOString()}`);
                        break;
                    }
                    if (attempt < maxRetries) await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
                }
            }
        }

        if (aiResponseData) {
            // cache for short period
            await setCache(`ai_insights_${userId}`, aiResponseData, 2 * 60 * 1000);
            return res.json({ success: true, data: aiResponseData });
        }

        // Robust fallback if AI is down: derive simple insights locally
        try {
            const fallback = computeLocalAIInsights(recentScores, riskAnalytics);
            // cache fallback briefly
            await setCache(`ai_insights_${userId}`, fallback, 60000);
            return res.json({ success: true, data: fallback, cached: true, fallback: true });
        } catch (fallbackErr) {
            console.error('Fallback analytics error:', fallbackErr);
            return res.json({ success: true, data: { profile: { cluster: 'Unavailable', reason: 'Insufficient data' }, trend: { trend: 'Unknown' }, weak_areas: [], recommendation: 'Practice more.' } });
        }

    } catch (error) {
        console.error('Error fetching AI insights:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch insights' });
    }
};

// New endpoint: Subject Proficiency / per-topic breakdown
exports.getSubjectProficiency = async (req, res) => {
    try {
        const { userId } = req.params;
        ensureSelfOrAdmin(req, userId);
        // Aggregate per-subject and per-topic stats
        // Use sums to compute weighted accuracy per topic (sum(correct)/sum(total))
        const agg = await PerformanceAnalytics.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: { subject: '$subject', topic: '$topic' }, attempts: { $sum: '$totalAttempts' }, correct: { $sum: '$correctAttempts' } } },
            { $addFields: { accuracy: { $cond: [{ $gt: ['$attempts', 0] }, { $multiply: [{ $divide: ['$correct', '$attempts'] }, 100] }, 0] } } },
            { $sort: { 'accuracy': -1 } }
        ]);

        const bySubject = {};
        agg.forEach(item => {
            const subject = (item._id.subject) || 'General';
            if (!bySubject[subject]) bySubject[subject] = { topics: [], totalAttempts: 0, correct: 0 };
            bySubject[subject].topics.push({ topic: item._id.topic, attempts: item.attempts, accuracy: Math.round(item.accuracy || 0) });
            bySubject[subject].totalAttempts += item.attempts;
            bySubject[subject].correct += item.correct;
        });

        // Compute weighted subject averages
        Object.keys(bySubject).forEach(sub => {
            const s = bySubject[sub];
            s.avgAccuracy = s.totalAttempts > 0 ? Math.round((s.correct / s.totalAttempts) * 100) : 0;
            // sort topics by attempts desc for display
            s.topics = s.topics.sort((a, b) => b.attempts - a.attempts);
        });

        res.json({ success: true, data: bySubject });
    } catch (err) {
        console.error('Subject proficiency error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getStudentReportOverall = async (req, res) => {
    try {
        const { userId } = req.params;
        ensureSelfOrAdmin(req, userId);

        const report = await getStudentOverallReport({
            userId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, data: report });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ success: false, message: error.message });
    }
};

exports.getStudentReportSubjectHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { subject, startDate, endDate } = req.query;
        ensureSelfOrAdmin(req, userId);

        if (!subject) {
            return res.status(400).json({ success: false, message: 'Subject is required' });
        }

        const report = await getStudentSubjectHistoryReport({ userId, subject, startDate, endDate });
        if (!report) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        res.json({ success: true, data: report });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ success: false, message: error.message });
    }
};

// Export pure helpers for unit testing
module.exports.computePlacementReadiness = computePlacementReadiness;
module.exports.computeLocalAIInsights = computeLocalAIInsights;
