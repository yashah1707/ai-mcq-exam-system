const Exam = require('../models/exam.model');
const Question = require('../models/question.model');

const failValidation = (res, message) => {
  res.status(400);
  throw new Error(message);
};

const normalizeQuestionIds = (questions = []) => {
  if (!Array.isArray(questions)) return [];

  return Array.from(new Set(
    questions
      .map((question) => {
        if (typeof question === 'string') return question;
        if (question && typeof question === 'object') return question.questionId || question._id;
        return question;
      })
      .filter(Boolean)
      .map((questionId) => questionId.toString())
  ));
};

const buildExamPayload = async (res, source) => {
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const subject = typeof source.subject === 'string' ? source.subject.trim() : '';
  const description = typeof source.description === 'string' ? source.description.trim() : '';
  const duration = Number(source.duration);
  const passingMarks = Number(source.passingMarks);
  const questionIds = normalizeQuestionIds(source.questions);
  const startDate = new Date(source.startDate);
  const endDate = new Date(source.endDate);

  if (!title) failValidation(res, 'Exam title is required');
  if (title.length < 5) failValidation(res, 'Title must be at least 5 characters long');
  if (!subject) failValidation(res, 'Subject is required');
  if (!Number.isInteger(duration) || duration <= 0 || duration > 180) failValidation(res, 'Duration must be between 1 and 180 minutes');
  if (!questionIds.length) failValidation(res, 'At least one question must be assigned to the exam');
  if (Number.isNaN(startDate.getTime())) failValidation(res, 'Start date must be valid');
  if (Number.isNaN(endDate.getTime())) failValidation(res, 'End date must be valid');
  if (endDate <= startDate) failValidation(res, 'End date must be after start date');

  const questions = await Question.find({ _id: { $in: questionIds } }, 'marks');
  if (questions.length !== questionIds.length) {
    failValidation(res, 'One or more selected questions do not exist');
  }

  const totalMarks = questions.reduce((sum, question) => sum + (Number(question.marks) || 1), 0);
  if (!Number.isInteger(totalMarks) || totalMarks <= 0) {
    failValidation(res, 'Selected questions must produce a positive total mark');
  }

  if (!Number.isInteger(passingMarks) || passingMarks < 0) {
    failValidation(res, 'Passing marks must be a non-negative integer');
  }

  if (passingMarks > totalMarks) {
    failValidation(res, 'Passing marks cannot exceed total marks');
  }

  return {
    title,
    subject,
    description,
    duration,
    totalMarks,
    passingMarks,
    questions: questionIds,
    startDate,
    endDate,
    isActive: typeof source.isActive === 'boolean' ? source.isActive : true,
    enableNegativeMarking: Boolean(source.enableNegativeMarking)
  };
};

const createExam = async (req, res, next) => {
  try {
    const payload = await buildExamPayload(res, req.body);
    const exam = await Exam.create({
      ...payload,
      createdBy: req.user._id
    });
    await exam.populate('questions', 'questionText marks subject difficulty topic questionImageUrl');
    await exam.populate('createdBy', 'name email role');
    console.info('[exam.create]', {
      id: exam._id.toString(),
      title: exam.title,
      subject: exam.subject,
      questionCount: exam.questions.length,
      isActive: exam.isActive,
      startDate: exam.startDate,
      endDate: exam.endDate
    });
    res.status(201).json({ exam });
  } catch (err) {
    next(err);
  }
};

const getExams = async (req, res, next) => {
  try {
    const exams = await Exam.find()
      .populate('questions', 'questionText marks subject difficulty topic questionImageUrl')
      .populate('createdBy', 'name email role');
    res.json({ exams });
  } catch (err) {
    next(err);
  }
};

const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id)
      .populate('questions', 'questionText options marks subject difficulty topic questionImageUrl')
      .populate('createdBy', 'name email role');
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }
    res.json({ exam });
  } catch (err) {
    next(err);
  }
};

const updateExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id);
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }

    const payload = await buildExamPayload(res, {
      title: req.body.title ?? exam.title,
      subject: req.body.subject ?? exam.subject,
      description: req.body.description ?? exam.description,
      duration: req.body.duration ?? exam.duration,
      passingMarks: req.body.passingMarks ?? exam.passingMarks,
      questions: req.body.questions ?? exam.questions,
      startDate: req.body.startDate ?? exam.startDate,
      endDate: req.body.endDate ?? exam.endDate,
      isActive: req.body.isActive ?? exam.isActive,
      enableNegativeMarking: req.body.enableNegativeMarking ?? exam.enableNegativeMarking
    });

    Object.assign(exam, payload);
    await exam.save();
    await exam.populate('questions', 'questionText marks subject difficulty topic questionImageUrl');
    await exam.populate('createdBy', 'name email role');
    res.json({ exam });
  } catch (err) {
    next(err);
  }
};

const deleteExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findByIdAndDelete(id);
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createExam, getExams, getExamById, updateExam, deleteExam };
