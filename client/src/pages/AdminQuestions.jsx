import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createQuestion, fetchQuestions, updateQuestion, deleteQuestion, bulkCreateQuestions, uploadQuestionImage, deleteQuestionImage } from '../services/questionService';
import { fetchSubjects } from '../services/subjectService';
import LoadingSpinner from '../components/LoadingSpinner';
import SymbolPicker from '../components/SymbolPicker';
import { showToast } from '../utils/appEvents';
import { AuthContext } from '../context/AuthContext';

const MIN_OPTIONS = 2;
const YEAR_OPTIONS = [1, 2, 3, 4];
const DEFAULT_COURSE = 'GENERAL';
const CATEGORY_OPTIONS = ['Aptitude', 'Logical', 'Technical'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];
const TEACHER_VIEW_OPTIONS = {
  MINE: 'mine',
  ASSIGNED: 'assigned'
};

const sanitizeSubjectList = (subjects) => Array.from(new Set(
  (Array.isArray(subjects) ? subjects : [])
    .map((subject) => String(subject || '').trim())
    .filter(Boolean)
));

const getDefaultCatalogEntry = (subjectCatalog = []) => subjectCatalog[0] || null;

const createEmptyForm = (subjectCatalog = []) => {
  const defaultEntry = getDefaultCatalogEntry(subjectCatalog);

  return {
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  category: 'Aptitude',
  subject: defaultEntry?.code || '',
  topic: 'General',
  year: defaultEntry?.year || 1,
  course: defaultEntry?.course || DEFAULT_COURSE,
  difficulty: 'Easy',
  marks: 1,
  negativeMarks: 0,
  questionImageUrl: '',
  questionImagePublicId: '',
  explanation: ''
  };
};

const getOptionLabel = (index) => {
  let label = '';
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
};

const parseCorrectAnswerValue = (value, optionsLength) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const rawValue = String(value).trim();
  if (/^[A-Z]$/i.test(rawValue)) {
    return rawValue.toUpperCase().charCodeAt(0) - 65;
  }

  const numericValue = Number(rawValue);
  return Number.isInteger(numericValue) ? numericValue : 0;
};

const getOptionOrder = (key) => {
  const trimmedKey = key.trim();
  const optionNumberMatch = trimmedKey.match(/^option(\d+)$/i);
  if (optionNumberMatch) {
    return Number(optionNumberMatch[1]) - 1;
  }

  const optionLetterMatch = trimmedKey.match(/^option([a-z])$/i);
  if (optionLetterMatch) {
    return optionLetterMatch[1].toUpperCase().charCodeAt(0) - 65;
  }

  if (/^[a-z]$/i.test(trimmedKey)) {
    return trimmedKey.toUpperCase().charCodeAt(0) - 65;
  }

  return null;
};

const extractOptionsFromRow = (row) => {
  const optionEntries = Object.entries(row)
    .map(([key, value]) => ({
      order: getOptionOrder(key),
      value: typeof value === 'string' ? value.trim() : String(value ?? '').trim()
    }))
    .filter((entry) => entry.order !== null && entry.value);

  const optionsByOrder = new Map();
  optionEntries.forEach((entry) => {
    if (!optionsByOrder.has(entry.order)) {
      optionsByOrder.set(entry.order, entry.value);
    }
  });

  return [...optionsByOrder.entries()]
    .sort((first, second) => first[0] - second[0])
    .map(([, value]) => value);
};

const normalizeUploadedQuestion = (row) => ({
  questionText: String(row.questionText || '').trim(),
  options: Array.isArray(row.options) ? row.options.map((option) => String(option || '').trim()) : extractOptionsFromRow(row),
  correctAnswer: parseCorrectAnswerValue(row.correctAnswer ?? row.correctIndex, Array.isArray(row.options) ? row.options.length : undefined),
  category: String(row.category || 'Aptitude').trim() || 'Aptitude',
  subject: String(row.subject || '').trim().toUpperCase(),
  topic: String(row.topic || 'General').trim() || 'General',
  year: Number(row.year || 1),
  course: String(row.course || DEFAULT_COURSE).trim().toUpperCase() || DEFAULT_COURSE,
  difficulty: String(row.difficulty || 'Easy').trim() || 'Easy',
  marks: Number(row.marks || 1),
  negativeMarks: Number(row.negativeMarks || 0),
  explanation: String(row.explanation || '').trim()
});

const buildScopedSubjectCatalog = (subjects, isTeacher, teacherAssignedSubjects) => {
  const catalog = Array.isArray(subjects) ? subjects : [];
  if (!isTeacher) {
    return catalog;
  }

  return catalog.filter((subject) => teacherAssignedSubjects.includes(subject.code));
};

const syncFormWithCatalog = (form, subjectCatalog) => {
  if (!subjectCatalog.length) {
    return form;
  }

  const fallbackEntry = getDefaultCatalogEntry(subjectCatalog);
  const requestedYear = Number(form.year || fallbackEntry.year);
  const requestedCourse = String(form.course || fallbackEntry.course || DEFAULT_COURSE);
  const matchingScopeSubjects = subjectCatalog.filter((subject) => (
    Number(subject.year) === requestedYear
    && String(subject.course || DEFAULT_COURSE) === requestedCourse
  ));
  const nextScopeEntry = matchingScopeSubjects[0]
    || subjectCatalog.find((subject) => String(subject.course || DEFAULT_COURSE) === requestedCourse)
    || subjectCatalog.find((subject) => Number(subject.year) === requestedYear)
    || fallbackEntry;

  const nextEntry = matchingScopeSubjects.find((subject) => subject.code === form.subject)
    || nextScopeEntry;

  const nextForm = {
    ...form,
    year: Number(nextEntry.year || 1),
    course: String(nextEntry.course || DEFAULT_COURSE),
    subject: form.subject && matchingScopeSubjects.some((subject) => subject.code === form.subject)
      ? form.subject
      : nextEntry.code,
  };

  if (
    nextForm.year === form.year
    && nextForm.course === form.course
    && nextForm.subject === form.subject
  ) {
    return form;
  }

  return nextForm;
};

const downloadCsvFile = (rows, filename) => {
  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AdminQuestions() {
  const { user } = useContext(AuthContext);
  const isTeacher = user?.role === 'teacher';
  const teacherAssignedSubjects = useMemo(() => sanitizeSubjectList(user?.subjects), [user?.subjects]);
  const [teacherView, setTeacherView] = useState(TEACHER_VIEW_OPTIONS.MINE);
  const [questions, setQuestions] = useState([]);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [subjectCatalogLoading, setSubjectCatalogLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const initialImagePublicIdRef = useRef('');
  const bulkUploadInputRef = useRef(null);
  const questionTextRef = useRef(null);
  const explanationRef = useRef(null);
  const optionRefs = useRef([]);
  const [form, setForm] = useState(createEmptyForm());

  const availableSubjectCatalog = useMemo(
    () => buildScopedSubjectCatalog(subjectCatalog, isTeacher, teacherAssignedSubjects),
    [isTeacher, subjectCatalog, teacherAssignedSubjects]
  );
  const availableCourseOptions = useMemo(
    () => Array.from(new Set(availableSubjectCatalog.map((subject) => String(subject.course || DEFAULT_COURSE)))).sort(),
    [availableSubjectCatalog]
  );
  const availableSubjectOptionsForScope = useMemo(
    () => availableSubjectCatalog.filter((subject) => Number(subject.year) === Number(form.year || 1) && String(subject.course || DEFAULT_COURSE) === String(form.course || DEFAULT_COURSE)),
    [availableSubjectCatalog, form.course, form.year]
  );

  const isOwnedByCurrentUser = (question) => {
    const ownerId = typeof question.createdBy === 'object'
      ? question.createdBy?._id || question.createdBy?.id
      : question.createdBy;

    return String(ownerId || '') === String(user?._id || user?.id || '');
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchQuestions(
        isTeacher
          ? { scope: teacherView }
          : {}
      );
      setQuestions(res.questions || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [isTeacher, teacherView]);

  useEffect(() => {
    let isMounted = true;

    const loadSubjects = async () => {
      setSubjectCatalogLoading(true);
      try {
        const response = await fetchSubjects({ includeInactive: false });
        if (!isMounted) {
          return;
        }

        setSubjectCatalog(response.subjects || []);
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || err.message);
        }
      } finally {
        if (isMounted) {
          setSubjectCatalogLoading(false);
        }
      }
    };

    loadSubjects();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setForm((currentForm) => syncFormWithCatalog(currentForm, availableSubjectCatalog));
  }, [availableSubjectCatalog]);

  const downloadSampleCSV = () => {
    const sampleData = [
      ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'category', 'subject', 'topic', 'year', 'course', 'difficulty', 'marks', 'negativeMarks', 'explanation'],
      ['What is 2+2?', '2', '3', '4', '5', '2', 'Aptitude', 'MATHS', 'Arithmetic', '1', 'GENERAL', 'Easy', '1', '0.25', 'Basic arithmetic'],
      ['What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', '2', 'Logical', 'COMMUNICATION', 'General Awareness', '1', 'GENERAL', 'Easy', '2', '0.5', 'Paris is the capital of France'],
      ['Which data structure uses LIFO?', 'Queue', 'Stack', 'Array', 'Tree', '1', 'Technical', 'DSA', 'Stack Basics', '2', 'CSE', 'Medium', '3', '1', 'Stack follows Last In First Out principle']
    ];

    downloadCsvFile(sampleData, 'sample_questions.csv');
  };

  const clearBulkUploadInput = () => {
    if (bulkUploadInputRef.current) {
      bulkUploadInputRef.current.value = '';
    }
  };

  const openBulkUploadPicker = () => {
    if (bulkUploading) {
      return;
    }

    bulkUploadInputRef.current?.click();
  };

  const handleFileUpload = async (file) => {
    setBulkResult(null);
    setError(null);
    if (!file) return;
    setBulkUploading(true);
    try {
      const text = await file.text();
      let data;
      const normalizedFileName = String(file.name || '').toLowerCase();
      const validSubjectCodes = new Set(availableSubjectCatalog.map((subject) => String(subject.code || '').trim().toUpperCase()));

      if (normalizedFileName.endsWith('.json')) {
        const parsedData = JSON.parse(text);
        data = Array.isArray(parsedData) ? parsedData.map((row, index) => {
          const normalizedQuestion = normalizeUploadedQuestion(row);

          if (!normalizedQuestion.questionText || normalizedQuestion.questionText.length < 10) {
            throw new Error(`Row ${index + 2}: Question text is required (min 10 chars)`);
          }

          if (!CATEGORY_OPTIONS.includes(normalizedQuestion.category)) {
            throw new Error(`Row ${index + 2}: Category must be one of ${CATEGORY_OPTIONS.join(', ')}`);
          }

          if (!DIFFICULTY_OPTIONS.includes(normalizedQuestion.difficulty)) {
            throw new Error(`Row ${index + 2}: Difficulty must be one of ${DIFFICULTY_OPTIONS.join(', ')}`);
          }

          if (!normalizedQuestion.subject) {
            throw new Error(`Row ${index + 2}: Subject code is required`);
          }

          if (validSubjectCodes.size > 0 && !validSubjectCodes.has(normalizedQuestion.subject)) {
            throw new Error(`Row ${index + 2}: Subject ${normalizedQuestion.subject} is not available in the active catalog`);
          }

          if (!normalizedQuestion.topic) {
            throw new Error(`Row ${index + 2}: Topic is required`);
          }

          if (!YEAR_OPTIONS.includes(normalizedQuestion.year)) {
            throw new Error(`Row ${index + 2}: Year must be between 1 and 4`);
          }

          if (normalizedQuestion.options.length < MIN_OPTIONS) {
            throw new Error(`Row ${index + 2}: At least ${MIN_OPTIONS} options are required`);
          }

          if (!Number.isFinite(normalizedQuestion.marks) || normalizedQuestion.marks < 1) {
            throw new Error(`Row ${index + 2}: Marks must be at least 1`);
          }

          if (!Number.isFinite(normalizedQuestion.negativeMarks) || normalizedQuestion.negativeMarks < 0) {
            throw new Error(`Row ${index + 2}: Negative marks cannot be negative`);
          }

          return normalizedQuestion;
        }) : [];
      } else {
        // Use papaparse for better CSV parsing
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim()
        });

        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors.map(e => e.message).join(', ')}`);
        }

        data = parsed.data.map((row, index) => {
          // Validate required fields
          if (!row.questionText || row.questionText.trim().length < 10) {
            throw new Error(`Row ${index + 2}: Question text is required (min 10 chars)`);
          }

          const normalizedQuestion = normalizeUploadedQuestion(row);
          const options = normalizedQuestion.options;

          if (options.length < MIN_OPTIONS) {
            throw new Error(`Row ${index + 2}: At least ${MIN_OPTIONS} options are required`);
          }

          const correctAnswer = parseCorrectAnswerValue(row.correctAnswer ?? row.correctIndex, options.length);
          if (correctAnswer < 0 || correctAnswer >= options.length) {
            throw new Error(`Row ${index + 2}: Correct answer must be between 0 and ${options.length - 1}`);
          }

          if (!normalizedQuestion.subject) {
            throw new Error(`Row ${index + 2}: Subject code is required`);
          }

          if (validSubjectCodes.size > 0 && !validSubjectCodes.has(normalizedQuestion.subject)) {
            throw new Error(`Row ${index + 2}: Subject ${normalizedQuestion.subject} is not available in the active catalog`);
          }

          if (!normalizedQuestion.topic) {
            throw new Error(`Row ${index + 2}: Topic is required`);
          }

          if (!CATEGORY_OPTIONS.includes(normalizedQuestion.category)) {
            throw new Error(`Row ${index + 2}: Category must be one of ${CATEGORY_OPTIONS.join(', ')}`);
          }

          if (!DIFFICULTY_OPTIONS.includes(normalizedQuestion.difficulty)) {
            throw new Error(`Row ${index + 2}: Difficulty must be one of ${DIFFICULTY_OPTIONS.join(', ')}`);
          }

          if (!YEAR_OPTIONS.includes(normalizedQuestion.year)) {
            throw new Error(`Row ${index + 2}: Year must be between 1 and 4`);
          }

          if (!Number.isFinite(normalizedQuestion.marks) || normalizedQuestion.marks < 1) {
            throw new Error(`Row ${index + 2}: Marks must be at least 1`);
          }

          if (!Number.isFinite(normalizedQuestion.negativeMarks) || normalizedQuestion.negativeMarks < 0) {
            throw new Error(`Row ${index + 2}: Negative marks cannot be negative`);
          }

          return {
            questionText: normalizedQuestion.questionText,
            options: options.map(opt => opt.trim()),
            correctAnswer,
            category: normalizedQuestion.category,
            subject: normalizedQuestion.subject,
            topic: normalizedQuestion.topic,
            year: normalizedQuestion.year,
            course: normalizedQuestion.course,
            difficulty: normalizedQuestion.difficulty,
            marks: normalizedQuestion.marks,
            negativeMarks: normalizedQuestion.negativeMarks,
            explanation: normalizedQuestion.explanation
          };
        });
      }

      // Validate data is array
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No valid questions found in file');
      }

      const res = await bulkCreateQuestions(data);
      setBulkResult(res);
      showToast(`Bulk upload created ${res.createdCount || 0} question(s).`, { type: 'success' });
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || err.message || String(err);
      setError(message);
      setBulkResult({ error: message });
      showToast(message, { type: 'error' });
    } finally {
      setBulkUploading(false);
      clearBulkUploadInput();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    // Validation
    if (!form.questionText || form.questionText.trim().length < 5) return setError('Question text is required (min 5 chars)');
    if (!form.options || form.options.length < MIN_OPTIONS || form.options.some(o => !o || !o.trim())) return setError(`Provide at least ${MIN_OPTIONS} non-empty options`);
    if (form.correctAnswer < 0 || form.correctAnswer >= form.options.length) return setError('Select a valid correct answer');
    if (!form.subject) return setError('Select a subject from the catalog');
    if (!form.topic || !form.topic.trim()) return setError('Topic is required');
    if (!form.marks || form.marks < 1) return setError('Marks must be at least 1');
    if (imageUploading) return setError('Wait for the question image upload to finish.');
    setSubmitting(true);
    try {
      if (editId) {
        await updateQuestion(editId, form);
      } else {
        await createQuestion(form);
      }
      initialImagePublicIdRef.current = '';
      setForm(createEmptyForm(availableSubjectCatalog));
      setEditId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this question?')) {
      try {
        await deleteQuestion(id);
        await load();
      } catch (err) {
        showToast(err?.response?.data?.message || err.message, { type: 'error' });
      }
    }
  };

  const handleEdit = (q) => {
    initialImagePublicIdRef.current = q.questionImagePublicId || '';
    setForm({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category,
      subject: q.subject || '',
      topic: q.topic || 'General',
      year: q.year || 1,
      course: q.course || DEFAULT_COURSE,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks || 0,
      questionImageUrl: q.questionImageUrl || '',
      questionImagePublicId: q.questionImagePublicId || '',
      explanation: q.explanation
    });
    setEditId(q._id);
    setShowForm(true);
  };

  const cleanupTemporaryImage = async (publicId, { silent = false } = {}) => {
    if (!publicId || publicId === initialImagePublicIdRef.current) {
      return true;
    }

    try {
      await deleteQuestionImage(publicId);
      return true;
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || err.message);
      }
      return false;
    }
  };

  const resetForm = async () => {
    const cleanupOk = await cleanupTemporaryImage(form.questionImagePublicId);
    if (!cleanupOk) {
      return;
    }

    setImageUploading(false);
    setShowForm(false);
    setEditId(null);
    initialImagePublicIdRef.current = '';
    setForm(createEmptyForm(availableSubjectCatalog));
  };

  const handleImageUpload = async (file) => {
    if (!file) {
      return;
    }

    setError(null);
    setImageUploading(true);
    const previousPublicId = form.questionImagePublicId;

    try {
      const uploadedImage = await uploadQuestionImage(file);
      const cleanedPreviousImage = await cleanupTemporaryImage(previousPublicId, { silent: true });
      if (!cleanedPreviousImage && previousPublicId && previousPublicId !== initialImagePublicIdRef.current) {
        setError('The new image was uploaded, but the previous temporary image could not be deleted.');
      }

      setForm((prev) => ({
        ...prev,
        questionImageUrl: uploadedImage.imageUrl,
        questionImagePublicId: uploadedImage.publicId || ''
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const removeImage = async () => {
    const cleanupOk = await cleanupTemporaryImage(form.questionImagePublicId);
    if (!cleanupOk) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      questionImageUrl: '',
      questionImagePublicId: ''
    }));
  };

  const updateOption = (index, value) => {
    const nextOptions = [...form.options];
    nextOptions[index] = value;
    setForm({ ...form, options: nextOptions });
  };

  const insertSymbolIntoField = ({ field, symbol, input, optionIndex }) => {
    let nextCursorPosition = null;

    setForm((prev) => {
      const currentValue = field === 'options'
        ? prev.options[optionIndex] || ''
        : prev[field] || '';
      const selectionStart = input?.selectionStart ?? currentValue.length;
      const selectionEnd = input?.selectionEnd ?? currentValue.length;
      const nextValue = `${currentValue.slice(0, selectionStart)}${symbol}${currentValue.slice(selectionEnd)}`;

      nextCursorPosition = selectionStart + symbol.length;

      if (field === 'options') {
        const nextOptions = [...prev.options];
        nextOptions[optionIndex] = nextValue;

        return {
          ...prev,
          options: nextOptions
        };
      }

      return {
        ...prev,
        [field]: nextValue
      };
    });

    setError(null);

    window.requestAnimationFrame(() => {
      if (!input || nextCursorPosition === null) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const insertSymbolIntoQuestionText = (symbol) => {
    insertSymbolIntoField({
      field: 'questionText',
      symbol,
      input: questionTextRef.current
    });
  };

  const insertSymbolIntoOption = (index, symbol) => {
    insertSymbolIntoField({
      field: 'options',
      symbol,
      input: optionRefs.current[index],
      optionIndex: index
    });
  };

  const insertSymbolIntoExplanation = (symbol) => {
    insertSymbolIntoField({
      field: 'explanation',
      symbol,
      input: explanationRef.current
    });
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, ''] });
  };

  const removeOption = (index) => {
    if (form.options.length <= MIN_OPTIONS) {
      return;
    }

    const nextOptions = form.options.filter((_, optionIndex) => optionIndex !== index);
    let nextCorrectAnswer = form.correctAnswer;

    if (index === form.correctAnswer) {
      nextCorrectAnswer = Math.max(0, Math.min(form.correctAnswer, nextOptions.length - 1));
    } else if (index < form.correctAnswer) {
      nextCorrectAnswer = form.correctAnswer - 1;
    }

    setForm({ ...form, options: nextOptions, correctAnswer: nextCorrectAnswer });
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>
          {isTeacher
            ? teacherView === TEACHER_VIEW_OPTIONS.ASSIGNED
              ? 'Assigned Subject Question Library'
              : 'Manage My Questions'
            : 'Manage Questions'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={async () => {
            if (showForm) {
              await resetForm();
              return;
            }

            setShowForm(true);
            setEditId(null);
            initialImagePublicIdRef.current = '';
            setForm(createEmptyForm(availableSubjectCatalog));
          }}>
            {showForm ? 'Cancel' : 'Add Question'}
          </button>
          <input
            ref={bulkUploadInputRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            style={{ display: 'none' }}
            onChange={(event) => handleFileUpload(event.target.files?.[0])}
          />
          <button type="button" className="button-secondary" onClick={openBulkUploadPicker} disabled={bulkUploading}>
            {bulkUploading ? 'Uploading…' : '📤 Bulk Upload'}
          </button>
          <button type="button" className="button-secondary" onClick={downloadSampleCSV}>📥 Download Sample CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit' : 'Create'} Question</h3>

          <div className="grid">
            <div className="form-group">
              <label>Course</label>
              <select
                value={form.course}
                onChange={(e) => setForm((currentForm) => syncFormWithCatalog({ ...currentForm, course: e.target.value }, availableSubjectCatalog))}
                disabled={subjectCatalogLoading || availableCourseOptions.length === 0}
              >
                {availableCourseOptions.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Year</label>
              <select
                value={form.year}
                onChange={(e) => setForm((currentForm) => syncFormWithCatalog({ ...currentForm, year: Number(e.target.value) }, availableSubjectCatalog))}
                disabled={subjectCatalogLoading}
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Subject</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                disabled={subjectCatalogLoading || availableSubjectOptionsForScope.length === 0}
              >
                {availableSubjectOptionsForScope.map((subject) => (
                  <option key={`${subject.code}-${subject.year}-${subject.course}`} value={subject.code}>{subject.code} - {subject.name}</option>
                ))}
              </select>
              {availableSubjectOptionsForScope.length === 0 && (
                <small className="text-muted">No subject catalog entries are available for this course and year.</small>
              )}
            </div>

            <div className="form-group">
              <label>Topic</label>
              <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} required />
            </div>
          </div>

          <div className="form-group">
            <label>Question Text</label>
            <div className="symbol-field symbol-field-full">
              <textarea
                ref={questionTextRef}
                className="symbol-field-control symbol-field-control-textarea"
                value={form.questionText}
                onChange={e => setForm({ ...form, questionText: e.target.value })}
                required
              ></textarea>
              <SymbolPicker inputRef={questionTextRef} onInsert={insertSymbolIntoQuestionText} />
            </div>
          </div>

          <div className="form-group">
            <label>Question Image (optional)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => handleImageUpload(e.target.files[0])} />
            <small className="text-muted">Uploads to Cloudinary. Supported formats: JPG, PNG, WEBP, GIF. Max 5 MB.</small>
            {imageUploading && <div className="text-small" style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Uploading image...</div>}
            {form.questionImageUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={form.questionImageUrl} alt="Question preview" style={{ maxWidth: '240px', width: '100%', borderRadius: '10px', border: '1px solid var(--border)' }} />
                <div style={{ marginTop: '8px' }}>
                  <button type="button" className="button-secondary button-sm" onClick={removeImage} disabled={imageUploading}>Remove Image</button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ marginBottom: 0 }}>Options</label>
              <button type="button" className="button-secondary button-sm" onClick={addOption}>Add Option</button>
            </div>
            <div className="option-editor-grid">
              {form.options.map((option, index) => (
                <div className="form-group" key={`option-${index}`}>
                  <label>Option {getOptionLabel(index)}</label>
                  <div className="option-editor-row">
                    <div className="symbol-field symbol-field-full">
                      <input
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        className="symbol-field-control symbol-field-control-input"
                        value={option}
                        onChange={e => updateOption(index, e.target.value)}
                        required
                      />
                      <SymbolPicker inputRef={{ current: optionRefs.current[index] }} onInsert={(symbol) => insertSymbolIntoOption(index, symbol)} />
                    </div>
                    <button
                      type="button"
                      className="button-secondary button-sm"
                      onClick={() => removeOption(index)}
                      disabled={form.options.length <= MIN_OPTIONS}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <small className="text-muted">Add as many options as you need. Minimum {MIN_OPTIONS} options.</small>
          </div>

          <div className="grid">
            <div className="form-group">
              <label>Correct Answer</label>
              <select value={form.correctAnswer} onChange={e => setForm({ ...form, correctAnswer: parseInt(e.target.value) })}>
                {form.options.map((_, index) => (
                  <option key={`correct-${index}`} value={index}>Option {getOptionLabel(index)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Difficulty</label>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTY_OPTIONS.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Marks (Correct Answer)</label>
              <input type="number" min="1" value={form.marks} onChange={e => setForm({ ...form, marks: parseInt(e.target.value) })} required />
            </div>

            <div className="form-group">
              <label>Negative Marks (Wrong Answer)</label>
              <input type="number" min="0" step="0.25" value={form.negativeMarks} onChange={e => setForm({ ...form, negativeMarks: parseFloat(e.target.value) || 0 })} />
              <small className="text-muted">Marks deducted for wrong answer (0 = no penalty)</small>
            </div>
          </div>

          <div className="form-group">
            <label>Explanation (optional)</label>
            <div className="symbol-field symbol-field-full">
              <textarea
                ref={explanationRef}
                className="symbol-field-control symbol-field-control-textarea"
                value={form.explanation}
                onChange={e => setForm({ ...form, explanation: e.target.value })}
              ></textarea>
              <SymbolPicker inputRef={explanationRef} onInsert={insertSymbolIntoExplanation} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="button-success" disabled={submitting || imageUploading}>{submitting ? (editId ? 'Updating…' : 'Creating…') : (editId ? 'Update' : 'Create') + ' Question'}</button>
            <button type="button" className="button-secondary" onClick={resetForm} disabled={imageUploading}>Cancel</button>
          </div>
        </form>
      )}

      {bulkUploading && <div className="card"><p>Uploading questions…</p></div>}
      {bulkResult && (
        <div className="card" style={{ marginTop: 8 }}>
          {bulkResult.error ? (
            <div style={{ color: 'var(--danger)' }}>Bulk upload failed: {bulkResult.error}</div>
          ) : (
            <div style={{ color: 'var(--success)' }}>Bulk upload succeeded: created {bulkResult.createdCount || 0} questions.</div>
          )}
        </div>
      )}

      <div className="card">
        {isTeacher && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block' }}>{teacherView === TEACHER_VIEW_OPTIONS.MINE ? 'My Questions' : 'Assigned Subject Library'}</strong>
              <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                {teacherView === TEACHER_VIEW_OPTIONS.MINE
                  ? 'You can edit and delete only the questions you created.'
                  : 'Use questions from your assigned subjects, including your own questions and shared subject library questions.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={teacherView === TEACHER_VIEW_OPTIONS.MINE ? '' : 'button-secondary'}
                onClick={() => setTeacherView(TEACHER_VIEW_OPTIONS.MINE)}
              >
                My Questions
              </button>
              <button
                type="button"
                className={teacherView === TEACHER_VIEW_OPTIONS.ASSIGNED ? '' : 'button-secondary'}
                onClick={() => setTeacherView(TEACHER_VIEW_OPTIONS.ASSIGNED)}
              >
                Assigned Subject Library
              </button>
            </div>
          </div>
        )}
        {loading && <LoadingSpinner />}
        {!loading && !questions.length && (
          <p className="text-muted text-center">
            {isTeacher && teacherView === TEACHER_VIEW_OPTIONS.ASSIGNED
              ? 'No questions are available yet in your assigned subjects.'
              : <>No questions yet. <a href="#0" onClick={() => setShowForm(true)}>Create one</a></>}
          </p>
        )}
        {!loading && questions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Scope</th>
                <th>Category</th>
                <th>Difficulty</th>
                <th>Marks</th>
                <th>Correct Answer</th>
                {isTeacher && <th>Access</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => {
                const isOwner = isOwnedByCurrentUser(q);

                return (
                <tr key={q._id}>
                  <td>
                    <strong>{q.questionText.substring(0, 60)}...</strong>
                    {q.questionImageUrl && <div className="text-small" style={{ marginTop: '4px', color: 'var(--primary)' }}>Image attached</div>}
                    {q.explanation && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>Explanation: {q.explanation.substring(0, 40)}...</div>}
                    <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{q.options.length} options</div>
                  </td>
                  <td>
                    <span className="badge badge-info">{q.subject || 'General'}</span>
                    {q.topic && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{q.topic}</div>}
                  </td>
                  <td>
                    <div className="text-small">{q.course || DEFAULT_COURSE}</div>
                    <div className="text-small" style={{ color: 'var(--text-muted)' }}>Year {q.year || 1}</div>
                  </td>
                  <td><span className="badge badge-info">{q.category}</span></td>
                  <td>
                    <span className={`badge badge-${q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td>{q.marks}</td>
                  <td><strong style={{ color: 'var(--success)' }}>Option {String.fromCharCode(65 + q.correctAnswer)}</strong></td>
                  {isTeacher && (
                    <td>
                      <div className="text-small" style={{ color: isOwner ? 'var(--success)' : 'var(--text-muted)' }}>
                        {isOwner ? 'Owner access' : 'Read-only'}
                      </div>
                      {q.createdBy?.name && (
                        <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                          Created by {q.createdBy.name}
                        </div>
                      )}
                    </td>
                  )}
                  <td>
                    {(!isTeacher || isOwner) ? (
                      <>
                        <button className="button-sm" onClick={() => handleEdit(q)}>Edit</button>
                        <button className="button-sm button-danger" onClick={() => handleDelete(q._id)} style={{ marginLeft: '4px' }}>Delete</button>
                      </>
                    ) : (
                      <span className="text-small" style={{ color: 'var(--text-muted)' }}>No write access</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
