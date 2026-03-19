const ExamAttempt = require('../models/examAttempt.model');
const {
  getStudentOverallReport,
  getStudentSubjectHistoryReport,
  getSubjectWiseStudentReport,
} = require('../services/reporting.service');

const getStudentPerformance = async (req, res, next) => {
  try {
    const { examId } = req.query;
    const filter = { status: 'completed' };
    if (examId) filter.exam = examId;

    const attempts = await ExamAttempt.find(filter)
      .populate('user', 'name email')
      .populate('exam', 'title totalMarks passingMarks')
      .sort({ endTime: -1 });

    const performance = attempts.map(a => ({
      _id: a._id,
      studentName: a.user.name,
      studentEmail: a.user.email,
      examTitle: a.exam.title,
      score: a.score,
      totalMarks: a.exam.totalMarks,
      percentage: ((a.score / a.exam.totalMarks) * 100).toFixed(2),
      passed: a.score >= a.exam.passingMarks,
      completedAt: a.endTime
    }));

    res.json({ performance });
  } catch (err) {
    next(err);
  }
};

const getExamStatistics = async (req, res, next) => {
  try {
    const { examId } = req.query;
    const filter = { status: 'completed' };
    if (examId) filter.exam = examId;

    const attempts = await ExamAttempt.find(filter).populate('exam', 'title totalMarks passingMarks');

    if (!attempts.length) {
      return res.json({
        total: 0,
        passed: 0,
        failed: 0,
        avgScore: 0,
        avgPercentage: 0
      });
    }

    const total = attempts.length;
    const passed = attempts.filter(a => a.score >= a.exam.passingMarks).length;
    const failed = total - passed;
    const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
    const avgScore = (totalScore / total).toFixed(2);
    const avgPercentage = attempts.reduce((sum, a) => sum + ((a.score / a.exam.totalMarks) * 100), 0) / total;

    res.json({
      total,
      passed,
      failed,
      avgScore,
      avgPercentage: avgPercentage.toFixed(2),
      passPercentage: ((passed / total) * 100).toFixed(2)
    });
  } catch (err) {
    next(err);
  }
};

const getSubjectStudentsReport = async (req, res, next) => {
  try {
    const { subject, startDate, endDate } = req.query;
    if (!subject) {
      res.status(400);
      throw new Error('Subject is required');
    }

    const report = await getSubjectWiseStudentReport({ subject, startDate, endDate });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

const getStudentSubjectHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { subject, startDate, endDate } = req.query;
    if (!subject) {
      res.status(400);
      throw new Error('Subject is required');
    }

    const report = await getStudentSubjectHistoryReport({ userId, subject, startDate, endDate });
    if (!report) {
      res.status(404);
      throw new Error('Student not found');
    }

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

const getStudentOverall = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const report = await getStudentOverallReport({ userId, startDate, endDate });
    if (!report) {
      res.status(404);
      throw new Error('Student not found');
    }

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStudentPerformance,
  getExamStatistics,
  getSubjectStudentsReport,
  getStudentSubjectHistory,
  getStudentOverall,
};
