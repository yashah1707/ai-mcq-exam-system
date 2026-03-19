const User = require('../models/user.model');
const ExamAttempt = require('../models/examAttempt.model');

const round = (value, digits = 2) => {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(digits));
};

const getAnswerSubject = (answer) => answer?.subject || answer?.questionId?.subject || 'General';
const getAnswerTopic = (answer) => answer?.topic || answer?.questionId?.topic || 'General';
const getAnswerMarks = (answer) => {
    if (typeof answer?.questionId?.marks === 'number') return answer.questionId.marks;
    return 1;
};

const isAnswered = (answer) => answer?.selectedOption !== null && answer?.selectedOption !== undefined;

const computeTrend = (entries) => {
    if (!entries || entries.length < 2) {
        return { label: 'Not enough data', delta: 0 };
    }

    const first = entries[0]?.percentage || 0;
    const last = entries[entries.length - 1]?.percentage || 0;
    const delta = round(last - first, 2);

    if (delta >= 5) return { label: 'Improving', delta };
    if (delta <= -5) return { label: 'Declining', delta };
    return { label: 'Stable', delta };
};

const buildTopicSummary = (topicStats) => {
    const topics = Object.entries(topicStats).map(([topic, stats]) => ({
        topic,
        attempts: stats.attempts,
        correct: stats.correct,
        accuracy: round(stats.attempts > 0 ? (stats.correct / stats.attempts) * 100 : 0),
        avgTimeSeconds: round(stats.attempts > 0 ? stats.totalTime / stats.attempts : 0),
    }));

    const strongTopics = [...topics]
        .sort((left, right) => right.accuracy - left.accuracy || right.attempts - left.attempts)
        .slice(0, 3);

    const weakTopics = [...topics]
        .sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)
        .slice(0, 3);

    return { topics, strongTopics, weakTopics };
};

const appendTopicStats = (topicStats, answers) => {
    answers.forEach((answer) => {
        const topic = getAnswerTopic(answer);
        if (!topicStats[topic]) {
            topicStats[topic] = { attempts: 0, correct: 0, totalTime: 0 };
        }

        topicStats[topic].attempts += 1;
        if (answer?.isCorrect) topicStats[topic].correct += 1;
        topicStats[topic].totalTime += answer?.timeSpentSeconds || 0;
    });
};

const buildAttemptMetrics = (attempt, subjectFilter = null) => {
    const relevantAnswers = (attempt.answers || []).filter((answer) => {
        if (!subjectFilter) return true;
        return getAnswerSubject(answer) === subjectFilter;
    });

    if (!relevantAnswers.length) {
        return null;
    }

    const totalQuestions = relevantAnswers.length;
    const attemptedQuestions = relevantAnswers.filter(isAnswered).length;
    const correctAnswers = relevantAnswers.filter((answer) => answer?.isCorrect).length;
    const score = relevantAnswers.reduce((sum, answer) => sum + (typeof answer?.marksAwarded === 'number' ? answer.marksAwarded : 0), 0);
    const maxScore = relevantAnswers.reduce((sum, answer) => sum + getAnswerMarks(answer), 0);
    const totalTimeSeconds = relevantAnswers.reduce((sum, answer) => sum + (answer?.timeSpentSeconds || 0), 0);
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : (correctAnswers / totalQuestions) * 100;

    const uniqueSubjects = [...new Set(relevantAnswers.map((answer) => getAnswerSubject(answer)))];

    return {
        attemptId: String(attempt._id),
        examTitle: attempt.exam?.title || (attempt.mode === 'adaptive' ? 'Adaptive Test' : 'Exam'),
        mode: attempt.mode || 'standard',
        subjects: uniqueSubjects,
        totalQuestions,
        attemptedQuestions,
        correctAnswers,
        score: round(score),
        maxScore: round(maxScore),
        percentage: round(percentage),
        totalTimeSeconds,
        avgTimeSeconds: round(totalQuestions > 0 ? totalTimeSeconds / totalQuestions : 0),
        completedAt: attempt.endTime || attempt.createdAt,
        answers: relevantAnswers,
    };
};

const buildQuery = ({ userId, startDate, endDate }) => {
    const query = { status: 'completed' };
    if (userId) query.user = userId;

    if (startDate || endDate) {
        query.endTime = {};
        if (startDate) query.endTime.$gte = new Date(startDate);
        if (endDate) query.endTime.$lte = new Date(endDate);
    }

    return query;
};

const fetchUserSummary = async (userId) => {
    const user = await User.findById(userId).select('name email');
    if (!user) {
        return null;
    }

    return {
        userId: String(user._id),
        name: user.name,
        email: user.email,
    };
};

const fetchAttempts = async ({ userId, startDate, endDate }) => {
    const attempts = await ExamAttempt.find(buildQuery({ userId, startDate, endDate }))
        .populate('user', 'name email role')
        .populate('exam', 'title totalMarks passingMarks')
        .populate('answers.questionId', 'subject topic marks')
        .sort({ endTime: 1, createdAt: 1 });

    return attempts;
};

async function getSubjectWiseStudentReport({ subject, startDate, endDate }) {
    const attempts = await fetchAttempts({ startDate, endDate });
    const students = new Map();

    attempts.forEach((attempt) => {
        const metrics = buildAttemptMetrics(attempt, subject);
        if (!metrics || !attempt.user || attempt.user.role === 'admin') {
            return;
        }

        const userId = String(attempt.user._id);
        if (!students.has(userId)) {
            students.set(userId, {
                userId,
                name: attempt.user.name,
                email: attempt.user.email,
                testsTaken: 0,
                questionsAttempted: 0,
                answeredQuestions: 0,
                correctAnswers: 0,
                totalScore: 0,
                maxScore: 0,
                totalTimeSeconds: 0,
                latestAttemptAt: null,
                latestExamTitle: '',
                timeline: [],
                topicStats: {},
            });
        }

        const student = students.get(userId);
        student.testsTaken += 1;
        student.questionsAttempted += metrics.totalQuestions;
        student.answeredQuestions += metrics.attemptedQuestions;
        student.correctAnswers += metrics.correctAnswers;
        student.totalScore += metrics.score;
        student.maxScore += metrics.maxScore;
        student.totalTimeSeconds += metrics.totalTimeSeconds;
        student.timeline.push({
            attemptId: metrics.attemptId,
            percentage: metrics.percentage,
            completedAt: metrics.completedAt,
            examTitle: metrics.examTitle,
        });
        appendTopicStats(student.topicStats, metrics.answers);

        if (!student.latestAttemptAt || new Date(metrics.completedAt) > new Date(student.latestAttemptAt)) {
            student.latestAttemptAt = metrics.completedAt;
            student.latestExamTitle = metrics.examTitle;
        }
    });

    const rows = Array.from(students.values()).map((student) => {
        const trend = computeTrend(student.timeline);
        const topicSummary = buildTopicSummary(student.topicStats);
        const accuracy = student.questionsAttempted > 0 ? (student.correctAnswers / student.questionsAttempted) * 100 : 0;
        const avgPercentage = student.maxScore > 0 ? (student.totalScore / student.maxScore) * 100 : 0;

        return {
            userId: student.userId,
            name: student.name,
            email: student.email,
            testsTaken: student.testsTaken,
            questionsAttempted: student.questionsAttempted,
            answeredQuestions: student.answeredQuestions,
            correctAnswers: student.correctAnswers,
            accuracy: round(accuracy),
            avgScore: round(student.testsTaken > 0 ? student.totalScore / student.testsTaken : 0),
            avgPercentage: round(avgPercentage),
            avgTimeSeconds: round(student.questionsAttempted > 0 ? student.totalTimeSeconds / student.questionsAttempted : 0),
            latestAttemptAt: student.latestAttemptAt,
            latestExamTitle: student.latestExamTitle,
            trend,
            weakTopics: topicSummary.weakTopics,
            strongTopics: topicSummary.strongTopics,
        };
    }).sort((left, right) => right.avgPercentage - left.avgPercentage);

    const summary = {
        subject,
        studentCount: rows.length,
        avgAccuracy: round(rows.length > 0 ? rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length : 0),
        avgTestsTaken: round(rows.length > 0 ? rows.reduce((sum, row) => sum + row.testsTaken, 0) / rows.length : 0),
        avgPercentage: round(rows.length > 0 ? rows.reduce((sum, row) => sum + row.avgPercentage, 0) / rows.length : 0),
    };

    return { subject, summary, students: rows };
}

async function getStudentSubjectHistoryReport({ userId, subject, startDate, endDate }) {
    const student = await fetchUserSummary(userId);
    if (!student) return null;

    const attempts = await fetchAttempts({ userId, startDate, endDate });
    const timeline = [];
    const topicStats = {};
    let totalQuestions = 0;
    let answeredQuestions = 0;
    let correctAnswers = 0;
    let totalScore = 0;
    let maxScore = 0;
    let totalTimeSeconds = 0;

    attempts.forEach((attempt) => {
        const metrics = buildAttemptMetrics(attempt, subject);
        if (!metrics) {
            return;
        }

        totalQuestions += metrics.totalQuestions;
        answeredQuestions += metrics.attemptedQuestions;
        correctAnswers += metrics.correctAnswers;
        totalScore += metrics.score;
        maxScore += metrics.maxScore;
        totalTimeSeconds += metrics.totalTimeSeconds;
        appendTopicStats(topicStats, metrics.answers);

        timeline.push({
            attemptId: metrics.attemptId,
            examTitle: metrics.examTitle,
            mode: metrics.mode,
            score: metrics.score,
            maxScore: metrics.maxScore,
            percentage: metrics.percentage,
            totalQuestions: metrics.totalQuestions,
            correctAnswers: metrics.correctAnswers,
            avgTimeSeconds: metrics.avgTimeSeconds,
            completedAt: metrics.completedAt,
        });
    });

    const topicSummary = buildTopicSummary(topicStats);
    const trend = computeTrend(timeline);
    const latestEntry = timeline[timeline.length - 1] || null;
    const bestEntry = [...timeline].sort((left, right) => right.percentage - left.percentage)[0] || null;

    return {
        student,
        subject,
        overview: {
            testsTaken: timeline.length,
            questionsAttempted: totalQuestions,
            answeredQuestions,
            correctAnswers,
            accuracy: round(totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0),
            avgScore: round(timeline.length > 0 ? totalScore / timeline.length : 0),
            avgPercentage: round(maxScore > 0 ? (totalScore / maxScore) * 100 : 0),
            avgTimeSeconds: round(totalQuestions > 0 ? totalTimeSeconds / totalQuestions : 0),
            bestPercentage: bestEntry?.percentage || 0,
            latestPercentage: latestEntry?.percentage || 0,
            latestAttemptAt: latestEntry?.completedAt || null,
            trend,
        },
        timeline,
        topics: topicSummary.topics,
        weakTopics: topicSummary.weakTopics,
        strongTopics: topicSummary.strongTopics,
    };
}

async function getStudentOverallReport({ userId, startDate, endDate }) {
    const student = await fetchUserSummary(userId);
    if (!student) return null;

    const attempts = await fetchAttempts({ userId, startDate, endDate });
    const subjectMap = new Map();
    const overallTopicStats = {};
    const recentAttempts = [];
    let totalTests = 0;
    let totalQuestions = 0;
    let answeredQuestions = 0;
    let correctAnswers = 0;
    let totalScore = 0;
    let totalMaxScore = 0;
    let totalTimeSeconds = 0;

    attempts.forEach((attempt) => {
        const overallMetrics = buildAttemptMetrics(attempt);
        if (!overallMetrics) {
            return;
        }

        totalTests += 1;
        totalQuestions += overallMetrics.totalQuestions;
        answeredQuestions += overallMetrics.attemptedQuestions;
        correctAnswers += overallMetrics.correctAnswers;
        totalScore += overallMetrics.score;
        totalMaxScore += overallMetrics.maxScore;
        totalTimeSeconds += overallMetrics.totalTimeSeconds;
        appendTopicStats(overallTopicStats, overallMetrics.answers);

        recentAttempts.push({
            attemptId: overallMetrics.attemptId,
            examTitle: overallMetrics.examTitle,
            mode: overallMetrics.mode,
            subject: overallMetrics.subjects.length === 1 ? overallMetrics.subjects[0] : 'Mixed',
            score: overallMetrics.score,
            maxScore: overallMetrics.maxScore,
            percentage: overallMetrics.percentage,
            completedAt: overallMetrics.completedAt,
        });

        overallMetrics.subjects.forEach((subject) => {
            const subjectMetrics = buildAttemptMetrics(attempt, subject);
            if (!subjectMetrics) return;

            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, {
                    subject,
                    testsTaken: 0,
                    questionsAttempted: 0,
                    answeredQuestions: 0,
                    correctAnswers: 0,
                    totalScore: 0,
                    maxScore: 0,
                    totalTimeSeconds: 0,
                    timeline: [],
                    topicStats: {},
                    latestAttemptAt: null,
                });
            }

            const entry = subjectMap.get(subject);
            entry.testsTaken += 1;
            entry.questionsAttempted += subjectMetrics.totalQuestions;
            entry.answeredQuestions += subjectMetrics.attemptedQuestions;
            entry.correctAnswers += subjectMetrics.correctAnswers;
            entry.totalScore += subjectMetrics.score;
            entry.maxScore += subjectMetrics.maxScore;
            entry.totalTimeSeconds += subjectMetrics.totalTimeSeconds;
            entry.timeline.push({ percentage: subjectMetrics.percentage, completedAt: subjectMetrics.completedAt });
            appendTopicStats(entry.topicStats, subjectMetrics.answers);
            if (!entry.latestAttemptAt || new Date(subjectMetrics.completedAt) > new Date(entry.latestAttemptAt)) {
                entry.latestAttemptAt = subjectMetrics.completedAt;
            }
        });
    });

    const subjects = Array.from(subjectMap.values()).map((entry) => {
        const topicSummary = buildTopicSummary(entry.topicStats);
        const accuracy = entry.questionsAttempted > 0 ? (entry.correctAnswers / entry.questionsAttempted) * 100 : 0;
        return {
            subject: entry.subject,
            testsTaken: entry.testsTaken,
            questionsAttempted: entry.questionsAttempted,
            answeredQuestions: entry.answeredQuestions,
            correctAnswers: entry.correctAnswers,
            accuracy: round(accuracy),
            avgScore: round(entry.testsTaken > 0 ? entry.totalScore / entry.testsTaken : 0),
            avgPercentage: round(entry.maxScore > 0 ? (entry.totalScore / entry.maxScore) * 100 : 0),
            avgTimeSeconds: round(entry.questionsAttempted > 0 ? entry.totalTimeSeconds / entry.questionsAttempted : 0),
            latestAttemptAt: entry.latestAttemptAt,
            trend: computeTrend(entry.timeline),
            weakTopics: topicSummary.weakTopics,
            strongTopics: topicSummary.strongTopics,
        };
    }).sort((left, right) => right.avgPercentage - left.avgPercentage);

    const topicSummary = buildTopicSummary(overallTopicStats);
    const strongestSubject = subjects[0] || null;
    const weakestSubject = subjects.length > 0 ? [...subjects].sort((left, right) => left.avgPercentage - right.avgPercentage)[0] : null;

    return {
        student,
        overview: {
            totalTests,
            totalQuestions,
            answeredQuestions,
            correctAnswers,
            accuracy: round(totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0),
            averageScore: round(totalTests > 0 ? totalScore / totalTests : 0),
            averagePercentage: round(totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0),
            avgTimeSeconds: round(totalQuestions > 0 ? totalTimeSeconds / totalQuestions : 0),
            strongestSubject: strongestSubject?.subject || null,
            weakestSubject: weakestSubject?.subject || null,
        },
        subjects,
        recentAttempts: recentAttempts.sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt)).slice(0, 8),
        weakTopics: topicSummary.weakTopics,
        strongTopics: topicSummary.strongTopics,
    };
}

module.exports = {
    getStudentOverallReport,
    getStudentSubjectHistoryReport,
    getSubjectWiseStudentReport,
};