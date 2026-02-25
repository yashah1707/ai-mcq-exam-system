const Question = require('../models/question.model');

const createQuestion = async (req, res, next) => {
  try {
    const { questionText, options, correctAnswer, category, difficulty, marks, explanation } = req.body;
    if (!questionText || !options || correctAnswer === undefined || !category || !difficulty) {
      res.status(400);
      throw new Error('All required fields must be provided');
    }
    if (options.length !== 4) {
      res.status(400);
      throw new Error('Must have exactly 4 options');
    }
    if (correctAnswer < 0 || correctAnswer > 3) {
      res.status(400);
      throw new Error('correctAnswer must be 0-3');
    }
    const question = await Question.create({
      questionText, options, correctAnswer, category, difficulty, marks, explanation, createdBy: req.user._id
    });
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
};

const getQuestions = async (req, res, next) => {
  try {
    const { category, difficulty } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    const questions = await Question.find(filter).populate('createdBy', 'name email');
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
      const { questionText, options, correctAnswer, category, difficulty, marks = 1, explanation = '' } = q;
      if (!questionText || !options || correctAnswer === undefined || !category || !difficulty) {
        throw new Error('Each question must include required fields');
      }
      if (!Array.isArray(options) || options.length !== 4) {
        throw new Error('Each question must have exactly 4 options');
      }
      return {
        questionText,
        options,
        correctAnswer,
        category,
        difficulty,
        marks,
        explanation,
        createdBy: req.user._id
      };
    });

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

const getquestionById = async (req, res, next) => {
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
    const { questionText, options, correctAnswer, category, difficulty, marks, explanation } = req.body;
    const question = await Question.findById(id);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }
    if (options && options.length !== 4) {
      res.status(400);
      throw new Error('Must have exactly 4 options');
    }
    if (correctAnswer !== undefined && (correctAnswer < 0 || correctAnswer > 3)) {
      res.status(400);
      throw new Error('correctAnswer must be 0-3');
    }
    Object.assign(question, { questionText, options, correctAnswer, category, difficulty, marks, explanation });
    await question.save();
    res.json({ question });
  } catch (err) {
    next(err);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await Question.findByIdAndDelete(id);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }
    res.json({ message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createQuestion, getQuestions, getquestionById, updateQuestion, deleteQuestion, bulkCreateQuestions };
