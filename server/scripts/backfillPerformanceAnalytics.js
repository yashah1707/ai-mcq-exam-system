const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const ExamAttempt = require('../src/models/examAttempt.model');
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUBJECT_FALLBACK = 'Aptitude';
const TOPIC_FALLBACK = 'General';

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
};

async function backfillPerformanceAnalytics() {
  try {
    await connectDB(process.env.MONGO_URI);

    const attempts = await ExamAttempt.find({ status: 'completed' })
      .populate('answers.questionId', 'subject topic')
      .sort({ endTime: 1, createdAt: 1 });

    console.log(`Found ${attempts.length} completed attempts.`);

    const analyticsMap = new Map();

    attempts.forEach((attempt) => {
      const attemptDate = attempt.endTime || attempt.createdAt || new Date();

      (attempt.answers || []).forEach((answer) => {
        const subject = answer.subject || answer.questionId?.subject || SUBJECT_FALLBACK;
        const topic = answer.topic || answer.questionId?.topic || TOPIC_FALLBACK;
        const key = `${attempt.user}:${subject}:${topic}`;

        if (!analyticsMap.has(key)) {
          analyticsMap.set(key, {
            userId: attempt.user,
            subject,
            topic,
            totalAttempts: 0,
            correctAttempts: 0,
            wrongAttempts: 0,
            unattemptedCount: 0,
            totalTimeSeconds: 0,
            lastAttemptDate: attemptDate,
          });
        }

        const record = analyticsMap.get(key);
        record.totalAttempts += 1;

        if (answer.isCorrect) {
          record.correctAttempts += 1;
        } else if (answer.selectedOption === null || answer.selectedOption === undefined) {
          record.unattemptedCount += 1;
        } else {
          record.wrongAttempts += 1;
        }

        record.totalTimeSeconds += answer.timeSpentSeconds || 0;
        if (!record.lastAttemptDate || new Date(attemptDate) > new Date(record.lastAttemptDate)) {
          record.lastAttemptDate = attemptDate;
        }
      });
    });

    const docs = Array.from(analyticsMap.values()).map((record) => {
      const accuracy = record.totalAttempts > 0 ? (record.correctAttempts / record.totalAttempts) * 100 : 0;
      const avgTimeSeconds = record.totalAttempts > 0 ? record.totalTimeSeconds / record.totalAttempts : 0;
      let strengthLevel = 'Weak';
      if (accuracy >= 80 && record.totalAttempts >= 3) strengthLevel = 'Strong';
      else if (accuracy >= 50) strengthLevel = 'Average';

      return {
        userId: new mongoose.Types.ObjectId(record.userId),
        subject: record.subject,
        topic: record.topic,
        totalAttempts: record.totalAttempts,
        correctAttempts: record.correctAttempts,
        wrongAttempts: record.wrongAttempts,
        unattemptedCount: record.unattemptedCount,
        accuracy: round(accuracy),
        avgTimeSeconds: round(avgTimeSeconds),
        confidenceScore: Math.min(100, round(accuracy * 0.9 + (record.totalAttempts > 5 ? 10 : 0))),
        strengthLevel,
        lastDifficultyLevel: 'Medium',
        lastAttemptDate: record.lastAttemptDate,
      };
    });

    console.log(`Rebuilding ${docs.length} analytics records...`);
    await PerformanceAnalytics.deleteMany({});
    if (docs.length > 0) {
      await PerformanceAnalytics.insertMany(docs, { ordered: false });
    }

    console.log('Performance analytics backfill completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Performance analytics backfill failed:', error);
    process.exit(1);
  }
}

backfillPerformanceAnalytics();