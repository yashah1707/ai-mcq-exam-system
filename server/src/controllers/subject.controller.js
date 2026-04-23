const AcademicClass = require('../models/academicClass.model');
const Subject = require('../models/subject.model');
const {
  DEFAULT_COURSE,
  YEAR_OPTIONS,
  ensureSubjectCatalogSeeded,
  getSubjectOptions,
  getSubjects,
  isValidSubjectCodeFormat,
  normalizeCourseValue,
  normalizeSubjectCode,
  serializeSubject,
} = require('../utils/subjects');

const normalizeName = (value) => String(value || '').trim();

const resolveIncludeInactive = (req) => req.user?.role === 'admin' && (req.query.includeInactive === 'true' || req.query.includeInactive === true);

const listSubjects = async (req, res, next) => {
  try {
    const includeInactive = resolveIncludeInactive(req);
    const subjects = await getSubjects({
      year: req.query.year,
      course: req.query.course,
      includeInactive,
    });
    const subjectOptions = await getSubjectOptions({ includeInactive: false });

    res.json({
      subjects: subjects.map(serializeSubject),
      subjectOptions,
      years: YEAR_OPTIONS,
      defaultCourse: DEFAULT_COURSE,
    });
  } catch (error) {
    next(error);
  }
};

const getStudentSubjectScope = async (req, res, next) => {
  try {
    await ensureSubjectCatalogSeeded();

    const studentClassName = String(req.user?.batch || '').trim();
    let subjects = [];
    let scope = null;

    if (studentClassName) {
      const academicClass = await AcademicClass.findOne({ name: studentClassName }).select('name year course');
      if (academicClass) {
        const year = Number(academicClass.year) || 1;
        const course = normalizeCourseValue(academicClass.course || DEFAULT_COURSE);
        subjects = await getSubjects({ year, course, includeInactive: false });
        scope = {
          className: academicClass.name,
          year,
          course,
        };
      }
    }

    if (subjects.length === 0) {
      subjects = await getSubjects({ includeInactive: false });
    }

    const optionMap = new Map();
    subjects.forEach((subject) => {
      if (!optionMap.has(subject.code)) {
        optionMap.set(subject.code, { code: subject.code, name: subject.name });
      }
    });

    res.json({
      subjects: subjects.map(serializeSubject),
      subjectOptions: Array.from(optionMap.values()),
      scope,
    });
  } catch (error) {
    next(error);
  }
};

const createSubject = async (req, res, next) => {
  try {
    const code = normalizeSubjectCode(req.body.code);
    const name = normalizeName(req.body.name);
    const year = Number(req.body.year);
    const course = normalizeCourseValue(req.body.course);
    const description = normalizeName(req.body.description);

    if (!code) {
      res.status(400);
      throw new Error('Subject code is required');
    }

    if (!isValidSubjectCodeFormat(code)) {
      res.status(400);
      throw new Error('Subject code must be alphanumeric only');
    }

    if (!name) {
      res.status(400);
      throw new Error('Subject name is required');
    }

    if (!YEAR_OPTIONS.includes(year)) {
      res.status(400);
      throw new Error('Subject year must be between 1 and 4');
    }

    const existingSubject = await Subject.findOne({ code, year, course });
    if (existingSubject) {
      res.status(409);
      throw new Error('A subject with this code already exists for the selected course and year');
    }

    const subject = await Subject.create({ code, name, year, course, description, isActive: true });
    res.status(201).json({ subject: serializeSubject(subject), message: 'Subject created successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404);
      throw new Error('Subject not found');
    }

    const nextCode = normalizeSubjectCode(req.body.code || subject.code);
    const nextName = normalizeName(req.body.name ?? subject.name);
    const nextYear = req.body.year !== undefined ? Number(req.body.year) : subject.year;
    const nextCourse = normalizeCourseValue(req.body.course ?? subject.course);
    const nextDescription = normalizeName(req.body.description ?? subject.description);
    const nextIsActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : subject.isActive;

    if (!nextCode || !nextName) {
      res.status(400);
      throw new Error('Subject code and name are required');
    }

    if (!isValidSubjectCodeFormat(nextCode)) {
      res.status(400);
      throw new Error('Subject code must be alphanumeric only');
    }

    if (!YEAR_OPTIONS.includes(nextYear)) {
      res.status(400);
      throw new Error('Subject year must be between 1 and 4');
    }

    const duplicateSubject = await Subject.findOne({ code: nextCode, year: nextYear, course: nextCourse, _id: { $ne: subject._id } });
    if (duplicateSubject) {
      res.status(409);
      throw new Error('A subject with this code already exists for the selected course and year');
    }

    subject.code = nextCode;
    subject.name = nextName;
    subject.year = nextYear;
    subject.course = nextCourse;
    subject.description = nextDescription;
    subject.isActive = nextIsActive;
    await subject.save();

    res.json({ subject: serializeSubject(subject), message: 'Subject updated successfully.' });
  } catch (error) {
    next(error);
  }
};

const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      res.status(404);
      throw new Error('Subject not found');
    }

    await Subject.findByIdAndDelete(id);
    res.json({ message: 'Subject deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubject,
  deleteSubject,
  getStudentSubjectScope,
  listSubjects,
  updateSubject,
};