const Subject = require('../models/subject.model');

const DEFAULT_COURSE = 'GENERAL';
const YEAR_OPTIONS = [1, 2, 3, 4];
const DEFAULT_SUBJECT_DEFINITIONS = [
  { code: 'DBMS', name: 'Database Management Systems' },
  { code: 'OS', name: 'Operating Systems' },
  { code: 'CN', name: 'Computer Networks' },
  { code: 'DSA', name: 'Data Structures and Algorithms' },
  { code: 'Aptitude', name: 'Aptitude' },
  { code: 'Logical', name: 'Logical Reasoning' },
  { code: 'Verbal', name: 'Verbal Ability' },
];

const SUBJECT_CODE_LOOKUP = new Map(DEFAULT_SUBJECT_DEFINITIONS.map((subject) => [subject.code.toUpperCase(), subject.code]));

const SUBJECT_OPTIONS = DEFAULT_SUBJECT_DEFINITIONS.map((subject) => subject.code);
const SUBJECT_CODE_PATTERN = /^[A-Z0-9]+$/;

const isValidSubjectCodeFormat = (value) => SUBJECT_CODE_PATTERN.test(String(value || '').trim().toUpperCase());

const normalizeSubjectCode = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return '';
  }

  const upperValue = rawValue.toUpperCase();
  return SUBJECT_CODE_LOOKUP.get(upperValue) || upperValue;
};

const normalizeCourseValue = (value) => {
  const normalizedValue = String(value || '').trim().toUpperCase();
  return normalizedValue || DEFAULT_COURSE;
};

const serializeSubject = (subject) => ({
  _id: subject._id,
  code: subject.code,
  name: subject.name,
  year: subject.year,
  course: subject.course,
  description: subject.description || '',
  isActive: subject.isActive !== false,
  createdAt: subject.createdAt,
});

const buildDefaultSeedDocuments = () => YEAR_OPTIONS.flatMap((year) => DEFAULT_SUBJECT_DEFINITIONS.map((subject) => ({
  ...subject,
  year,
  course: DEFAULT_COURSE,
  isActive: true,
}))); 

const ensureSubjectCatalogSeeded = async () => {
  const subjectCount = await Subject.countDocuments();
  if (subjectCount > 0) {
    return;
  }

  await Subject.insertMany(buildDefaultSeedDocuments(), { ordered: false });
};

const buildSubjectQuery = ({ year, course, includeInactive = false } = {}) => {
  const query = {};

  if (!includeInactive) {
    query.isActive = true;
  }

  const normalizedYear = Number(year);
  if (Number.isInteger(normalizedYear) && YEAR_OPTIONS.includes(normalizedYear)) {
    query.year = normalizedYear;
  }

  if (course) {
    query.course = normalizeCourseValue(course);
  }

  return query;
};

const getSubjects = async (options = {}) => {
  await ensureSubjectCatalogSeeded();
  return Subject.find(buildSubjectQuery(options)).sort({ course: 1, year: 1, code: 1 });
};

const getSubjectOptions = async (options = {}) => {
  const subjects = await getSubjects(options);
  const optionMap = new Map();

  subjects.forEach((subject) => {
    if (!optionMap.has(subject.code)) {
      optionMap.set(subject.code, { code: subject.code, name: subject.name });
    }
  });

  return Array.from(optionMap.values());
};

const getAvailableSubjectCodes = async (options = {}) => {
  const subjectOptions = await getSubjectOptions(options);
  return subjectOptions.map((subject) => subject.code);
};

const getSubjectCatalogEntry = async ({ code, year, course, includeInactive = false } = {}) => {
  await ensureSubjectCatalogSeeded();
  const normalizedCode = normalizeSubjectCode(code);
  if (!normalizedCode) {
    return null;
  }

  return Subject.findOne({
    code: normalizedCode,
    ...buildSubjectQuery({ year, course, includeInactive }),
  }).sort({ isActive: -1 });
};

const assertSubjectExistsForScope = async ({ code, year, course, includeInactive = false } = {}) => {
  const subject = await getSubjectCatalogEntry({ code, year, course, includeInactive });
  if (!subject) {
    const error = new Error(`Subject ${normalizeSubjectCode(code) || code} is not available for ${normalizeCourseValue(course)} year ${Number(year) || 1}`);
    error.statusCode = 400;
    throw error;
  }

  return subject;
};

const isValidSubjectCode = async (value, options = {}) => {
  const normalizedCode = normalizeSubjectCode(value);
  if (!normalizedCode) {
    return false;
  }

  const subjectCodes = await getAvailableSubjectCodes(options);
  return subjectCodes.includes(normalizedCode);
};

module.exports = {
  DEFAULT_COURSE,
  SUBJECT_OPTIONS,
  YEAR_OPTIONS,
  assertSubjectExistsForScope,
  buildSubjectQuery,
  ensureSubjectCatalogSeeded,
  getAvailableSubjectCodes,
  getSubjectCatalogEntry,
  getSubjectOptions,
  getSubjects,
  isValidSubjectCodeFormat,
  isValidSubjectCode,
  normalizeCourseValue,
  normalizeSubjectCode,
  serializeSubject,
};