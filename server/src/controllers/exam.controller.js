const Exam = require('../models/exam.model');

const createExam = async (req, res, next) => {
  try {
    const { title, subject, description, duration, totalMarks, passingMarks, questions, startDate, endDate, isActive, enableNegativeMarking } = req.body;
    if (!title || !subject || !duration || !totalMarks || !passingMarks || !questions || !startDate || !endDate) {
      res.status(400);
      throw new Error('All required fields must be provided');
    }
    const exam = await Exam.create({
      title, subject, description, duration, totalMarks, passingMarks, questions, startDate, endDate, isActive, enableNegativeMarking, createdBy: req.user._id
    });
    // populate returns a promise that resolves to the document; call sequentially
    await exam.populate('questions');
    await exam.populate('createdBy', 'name email');
    res.status(201).json({ exam });
  } catch (err) {
    next(err);
  }
};

const getExams = async (req, res, next) => {
  try {
    const exams = await Exam.find().populate('questions', 'questionText').populate('createdBy', 'name email');
    res.json({ exams });
  } catch (err) {
    next(err);
  }
};

const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id).populate('questions').populate('createdBy', 'name email');
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
    const { title, subject, description, duration, totalMarks, passingMarks, questions, startDate, endDate, isActive, enableNegativeMarking } = req.body;
    const exam = await Exam.findById(id);
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }
    Object.assign(exam, { title, subject, description, duration, totalMarks, passingMarks, questions, startDate, endDate, isActive, enableNegativeMarking });
    await exam.save();
    await exam.populate('questions').populate('createdBy', 'name email');
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
