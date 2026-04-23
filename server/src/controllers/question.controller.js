const Question = require('../models/question.model');
const { deleteQuestionImageByPublicId } = require('../services/cloudinary.service');
const { ensureResourceOwnerOrAdmin, getManagedSubjects, isTeacher } = require('../utils/permissions');
const { assertSubjectExistsForScope, normalizeCourseValue, normalizeSubjectCode } = require('../utils/subjects');

const normalizeOptions = (options) => (
  Array.isArray(options)
    ? options.map((option) => String(option ?? '').trim())
    : options
);

const toOptionalTrimmedString = (value) => (
  typeof value === 'string' ? value.trim() : value
);

const buildQuestionData = (payload) => ({
  questionText: toOptionalTrimmedString(payload.questionText),
  options: payload.options !== undefined ? normalizeOptions(payload.options) : undefined,
  correctAnswer: payload.correctAnswer !== undefined ? Number(payload.correctAnswer) : undefined,
  category: payload.category,
  difficulty: payload.difficulty,
  marks: payload.marks !== undefined ? Number(payload.marks) : undefined,
  negativeMarks: payload.negativeMarks !== undefined ? Number(payload.negativeMarks) : undefined,
  questionImageUrl: payload.questionImageUrl !== undefined ? toOptionalTrimmedString(payload.questionImageUrl) : undefined,
  questionImagePublicId: payload.questionImagePublicId !== undefined ? toOptionalTrimmedString(payload.questionImagePublicId) : undefined,
  explanation: payload.explanation !== undefined ? toOptionalTrimmedString(payload.explanation) : undefined,
  subject: payload.subject !== undefined ? normalizeSubjectCode(payload.subject) : undefined,
  year: payload.year !== undefined ? Number(payload.year) : undefined,
  course: payload.course !== undefined ? normalizeCourseValue(payload.course) : undefined,
  topic: payload.topic !== undefined ? toOptionalTrimmedString(payload.topic) : undefined,
});

const validateOptionsAndAnswer = (options, correctAnswer) => {
  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('Provide at least 2 options');
  }

  if (options.some((option) => typeof option !== 'string' || option.trim().length === 0)) {
    throw new Error('All options must be non-empty');
  }

  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
    throw new Error(`correctAnswer must be between 0 and ${options.length - 1}`);
  }
};

const assignDefinedFields = (target, source) => {
  Object.entries(source).forEach(([key, value]) => {
    if (value !== undefined) {
      target[key] = value;
    }
  });
};

const cleanupQuestionImageAsset = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await deleteQuestionImageByPublicId(publicId);
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error.message);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const { questionText, options, correctAnswer, category, difficulty, marks, negativeMarks, questionImageUrl, questionImagePublicId, explanation, subject, year = 1, course = 'GENERAL', topic } = buildQuestionData(req.body);
    if (!questionText || !options || correctAnswer === undefined || !category || !difficulty || !subject || !topic) {
      res.status(400);
      throw new Error('All required fields must be provided');
    }

    await assertSubjectExistsForScope({ code: subject, year, course });
    if (isTeacher(req.user) && !getManagedSubjects(req.user).includes(subject)) {
      res.status(403);
      throw new Error('Teachers can only create questions for assigned subjects');
    }

    validateOptionsAndAnswer(options, correctAnswer);
    const question = await Question.create({
      questionText,
      options,
      correctAnswer,
      category,
      difficulty,
      marks,
      negativeMarks,
      questionImageUrl,
      questionImagePublicId,
      explanation,
      subject,
      year,
      course,
      topic,
      createdBy: req.user._id
    });
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
};

const getQuestions = async (req, res, next) => {
  try {
    const { category, difficulty, mine, scope } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (isTeacher(req.user)) {
      if (mine === 'true' || scope === 'mine') {
        filter.createdBy = req.user._id;
      } else if (scope === 'assigned') {
        filter.subject = { $in: getManagedSubjects(req.user) };
      }
    }
    const questions = await Question.find(filter).populate('createdBy', 'name email firstName lastName');
    res.json({ questions });
  } catch (err) {
    next(err);
  }
};

const bulkCreateQuestions = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload) || !payload.length) {
      res.status(400);
      throw new Error('Payload must be a non-empty array of questions');
    }

    const docs = payload.map(q => {
      const { questionText, options, correctAnswer, category, difficulty, marks = 1, negativeMarks = 0, questionImageUrl = '', questionImagePublicId = '', explanation = '', subject, year = 1, course = 'GENERAL', topic } = buildQuestionData(q);
      if (!questionText || !options || correctAnswer === undefined || !category || !difficulty || !subject || !topic) {
        throw new Error('Each question must include required fields');
      }
      validateOptionsAndAnswer(options, correctAnswer);
      return {
        questionText,
        options,
        correctAnswer,
        category,
        difficulty,
        marks,
        negativeMarks,
        questionImageUrl,
        questionImagePublicId,
        explanation,
        subject,
        year,
        course,
        topic,
        createdBy: req.user._id
      };
    });

    for (const doc of docs) {
      await assertSubjectExistsForScope({ code: doc.subject, year: doc.year, course: doc.course });
      if (isTeacher(req.user) && !getManagedSubjects(req.user).includes(doc.subject)) {
        res.status(403);
        throw new Error('Teachers can only create questions for assigned subjects');
      }
    }

    const created = await Question.insertMany(docs, { ordered: false });
    res.status(201).json({ createdCount: created.length, created });
  } catch (err) {
    // If validation error thrown above, ensure proper status
    if (!res.headersSent) {
      next(err);
    } else {
      next(err);
    }
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id).populate('createdBy', 'name email');
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }
    res.json({ question });
  } catch (err) {
    next(err);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    ensureResourceOwnerOrAdmin(req.user, question);

    const updates = buildQuestionData(req.body);
    const nextOptions = updates.options !== undefined ? updates.options : question.options;
    const nextCorrectAnswer = updates.correctAnswer !== undefined ? updates.correctAnswer : question.correctAnswer;
    const nextSubject = updates.subject !== undefined ? updates.subject : question.subject;
    const nextYear = updates.year !== undefined ? updates.year : question.year;
    const nextCourse = updates.course !== undefined ? updates.course : question.course;
    const previousImagePublicId = question.questionImagePublicId;

    validateOptionsAndAnswer(nextOptions, nextCorrectAnswer);
    await assertSubjectExistsForScope({ code: nextSubject, year: nextYear, course: nextCourse });
    if (isTeacher(req.user) && !getManagedSubjects(req.user).includes(nextSubject)) {
      res.status(403);
      throw new Error('Teachers can only update questions for assigned subjects');
    }

    assignDefinedFields(question, updates);

    await question.save();

    if (previousImagePublicId && previousImagePublicId !== question.questionImagePublicId) {
      await cleanupQuestionImageAsset(previousImagePublicId);
    }

    res.json({ question });
  } catch (err) {
    next(err);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    ensureResourceOwnerOrAdmin(req.user, question);

    await Question.findByIdAndDelete(id);
    await cleanupQuestionImageAsset(question.questionImagePublicId);

    res.json({ message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createQuestion, getQuestions, getQuestionById, updateQuestion, deleteQuestion, bulkCreateQuestions };
