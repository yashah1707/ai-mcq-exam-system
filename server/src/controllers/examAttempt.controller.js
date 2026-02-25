const ExamAttempt = require('../models/examAttempt.model');
const Exam = require('../models/exam.model');
const Question = require('../models/question.model');
const PerformanceAnalyticsController = require('./performanceAnalytics.controller');

const evaluateAnswers = async (exam, answers) => {
  let score = 0;
  const evaluated = [];
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const answer of answers) {
    const question = await Question.findById(answer.questionId);
    if (!question) continue;

    // Default values
    let isCorrect = false;
    let marksAwarded = 0;
    const subject = question.subject || 'Aptitude';
    const topic = question.topic || 'General';

    // Check if question was answered
    if (answer.selectedOption === null || answer.selectedOption === undefined) {
      unansweredCount++;
      evaluated.push({
        questionId: answer.questionId,
        selectedOption: null,
        correctAnswer: question.correctAnswer,
        isCorrect: false,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        marksAwarded: 0,
        explanation: question.explanation,
        subject,
        topic,
        timeSpentSeconds: answer.timeSpentSeconds || 0
      });
      continue;
    }

    isCorrect = answer.selectedOption === question.correctAnswer;

    if (isCorrect) {
      marksAwarded = question.marks;
      score += question.marks;
      correctCount++;
    } else {
      // Apply negative marking if enabled for the exam
      if (exam.enableNegativeMarking && question.negativeMarks > 0) {
        marksAwarded = -question.negativeMarks;
        score -= question.negativeMarks;
      }
      wrongCount++;
    }

    evaluated.push({
      questionId: answer.questionId,
      selectedOption: answer.selectedOption,
      correctAnswer: question.correctAnswer,
      isCorrect,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      marksAwarded, // Can be positive, negative, or zero
      explanation: question.explanation,
      subject,
      topic,
      timeSpentSeconds: answer.timeSpentSeconds || 0
    });
  }

  return {
    score,
    evaluated,
    stats: {
      correctCount,
      wrongCount,
      unansweredCount,
      totalQuestions: answers.length
    }
  };
};

/**
 * Utility function to shuffle an array (Fisher-Yates algorithm)
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const startExam = async (req, res, next) => {
  try {
    const { examId } = req.body;
    const exam = await Exam.findById(examId).populate('questions');
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }

    // Check if exam is active and within date range
    const now = new Date();
    if (!exam.isActive || now < exam.startDate || now > exam.endDate) {
      res.status(400);
      throw new Error('Exam is not available at this time');
    }

    // Check if already in progress or completed
    const existing = await ExamAttempt.findOne({
      user: req.user._id,
      exam: examId,
      status: 'in-progress'
    });
    if (existing) {
      return res.json({ attempt: existing });
    }

    // Randomize questions to prevent copying (SRS requirement: NFR-USR-03)
    const shuffledQuestions = shuffleArray(exam.questions);

    // Prepare answers array with shuffled questions
    const answers = shuffledQuestions.map(q => ({
      questionId: q._id,
      selectedOption: null
    }));

    const attempt = await ExamAttempt.create({
      user: req.user._id,
      exam: examId,
      answers,
      startTime: new Date()
    });

    // Populate the attempt with shuffled questions
    const populatedAttempt = await ExamAttempt.findById(attempt._id)
      .populate({
        path: 'answers.questionId',
        select: 'questionText options category difficulty marks subject topic'
      });

    res.status(201).json({ attempt: populatedAttempt });
  } catch (err) {
    next(err);
  }
};

const saveAnswer = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedOption, timeSpentSeconds } = req.body;

    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt || attempt.user.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Unauthorized');
    }

    const answerIdx = attempt.answers.findIndex(a => a.questionId.toString() === questionId);
    if (answerIdx >= 0) {
      attempt.answers[answerIdx].selectedOption = selectedOption;
      if (timeSpentSeconds !== undefined) {
        attempt.answers[answerIdx].timeSpentSeconds = (attempt.answers[answerIdx].timeSpentSeconds || 0) + timeSpentSeconds;
      }
    } else {
      attempt.answers.push({ questionId, selectedOption, timeSpentSeconds: timeSpentSeconds || 0 });
    }

    await attempt.save();
    res.json({ attempt });
  } catch (err) {
    next(err);
  }
};

const submitExam = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const attempt = await ExamAttempt.findById(attemptId).populate('exam');

    if (!attempt || attempt.user.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Unauthorized');
    }

    if (attempt.status === 'completed') {
      res.status(400);
      throw new Error('Exam already submitted');
    }

    const { score, evaluated, stats } = await evaluateAnswers(attempt.exam, attempt.answers);

    // Update attempt with evaluated answers (containing subject, topic, isCorrect, etc.)
    // We Map 'evaluated' back to the 'answers' structure
    attempt.answers = evaluated.map(e => ({
      questionId: e.questionId,
      selectedOption: e.selectedOption,
      isCorrect: e.isCorrect,
      marksAwarded: e.marksAwarded,
      timeSpentSeconds: e.timeSpentSeconds,
      subject: e.subject,
      topic: e.topic
    }));

    attempt.score = score;
    attempt.status = 'completed';
    attempt.endTime = new Date();
    await attempt.save();

    // Trigger asynchronous performance update (fire and forget or await if critical)
    // We await it to ensure consistency for immediate Feedback
    await PerformanceAnalyticsController.updatePerformanceMetrics(req.user._id, attempt._id);

    const passed = score >= attempt.exam.passingMarks;

    res.json({
      attempt,
      result: {
        score,
        totalMarks: attempt.exam.totalMarks,
        percentage: ((score / attempt.exam.totalMarks) * 100).toFixed(2),
        passed,
        evaluated,
        stats // Include detailed statistics
      }
    });
  } catch (err) {
    next(err);
  }
};

const getAttempt = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const attempt = await ExamAttempt.findById(attemptId)
      .populate('exam')
      .populate('user', 'name email')
      .populate({
        path: 'answers.questionId',
        select: 'questionText options category difficulty marks subject topic'
      });

    if (!attempt || (attempt.user._id.toString() !== req.user._id.toString())) {
      res.status(403);
      throw new Error('Unauthorized');
    }

    if (attempt.status === 'completed') {
      const { evaluated } = await evaluateAnswers(attempt.exam, attempt.answers);
      return res.json({ attempt, evaluated });
    }

    res.json({ attempt });
  } catch (err) {
    next(err);
  }
};

const getAttemptHistory = async (req, res, next) => {
  try {
    const attempts = await ExamAttempt.find({ user: req.user._id, status: 'completed' })
      .populate('exam', 'title duration totalMarks')
      .sort({ endTime: -1 });

    res.json({ attempts });
  } catch (err) {
    next(err);
  }
};

module.exports = { startExam, saveAnswer, submitExam, getAttempt, getAttemptHistory };
