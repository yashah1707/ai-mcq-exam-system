import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchExams, createExam, updateExam, deleteExam } from '../services/examService';
import { getActiveAttemptsForExam, resetAttempt } from '../services/examAttemptService';
import { createQuestion, fetchQuestions, uploadQuestionImage, deleteQuestionImage } from '../services/questionService';
import { fetchSubjects } from '../services/subjectService';
import LoadingSpinner from '../components/LoadingSpinner';
import SymbolPicker from '../components/SymbolPicker';
import { showToast } from '../utils/appEvents';
import { AuthContext } from '../context/AuthContext';
import { buildTeacherAudienceBadges, getAudienceBadgeStyle } from '../utils/examAudience';

const FILTER_ALL = 'all';
const MIN_OPTIONS = 2;
const EXAM_CREATION_MODE_MANUAL = 'manual';
const EXAM_CREATION_MODE_AUTO = 'auto';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

const sanitizeSubjectList = (subjects) => Array.from(new Set(
  (Array.isArray(subjects) ? subjects : [])
    .map((subject) => String(subject || '').trim())
    .filter(Boolean)
));

const normalizeAssignedClasses = (classes) => Array.from(new Set(
  (Array.isArray(classes) ? classes : [])
    .map((className) => String(className || '').trim())
    .filter(Boolean)
));

const normalizeAssignedLabBatches = (assignments) => Array.from(new Map(
  (Array.isArray(assignments) ? assignments : [])
    .map((assignment) => {
      if (typeof assignment === 'string') {
        const [className, labBatchName] = assignment.split('::').map((value) => String(value || '').trim());
        return { className, labBatchName };
      }

      return {
        className: String(assignment?.className || assignment?.class || '').trim(),
        labBatchName: String(assignment?.labBatchName || assignment?.labBatch || '').trim()
      };
    })
    .filter((assignment) => assignment.className && assignment.labBatchName)
    .map((assignment) => [`${assignment.className}::${assignment.labBatchName}`, assignment])
).values());

const buildLabBatchAssignmentKey = (assignment) => `${assignment.className}::${assignment.labBatchName}`;
const buildLabBatchAssignmentLabel = (assignment) => `${assignment.className} / ${assignment.labBatchName}`;

const audienceBadgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.2,
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

const formatDateTimeLocal = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildDefaultExamForm = (subjectOptions = [], isTeacher = false) => {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const defaultSubject = isTeacher
    ? (subjectOptions[0] || '')
    : 'Mixed';

  return {
    title: '',
    subject: defaultSubject,
    description: '',
    duration: 60,
    totalMarks: 0,
    passingMarks: 0,
    selectedQuestions: [],
    assignedClasses: [],
    assignedLabBatches: [],
    startDate: formatDateTimeLocal(now),
    endDate: formatDateTimeLocal(inSevenDays),
    isActive: true,
    enableNegativeMarking: false
  };
};

const buildInlineQuestionForm = (examSubject = 'Mixed') => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  category: examSubject === 'Logical' ? 'Logical' : examSubject === 'Aptitude' ? 'Aptitude' : 'Technical',
  subject: examSubject !== 'Mixed' ? examSubject : 'Aptitude',
  topic: 'General',
  difficulty: 'Easy',
  marks: 1,
  negativeMarks: 0,
  questionImageUrl: '',
  questionImagePublicId: '',
  explanation: ''
});

const createSelectedQuestion = (question) => ({
  questionId: question._id,
  marks: Number(question.marks) || 1
});

const computeSelectedMarks = (selectedQuestions = []) => selectedQuestions.reduce((sum, item) => sum + (Number(item.marks) || 0), 0);

const buildDefaultAutoConfig = () => ({
  Easy: 0,
  Medium: 0,
  Hard: 0
});

const shuffleQuestions = (items = []) => {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }
  return nextItems;
};

const buildValidationErrors = (form, { isTeacher = false } = {}) => {
  const errors = {};
  const trimmedTitle = form.title.trim();
  const duration = Number(form.duration);
  const totalMarks = Number(form.totalMarks);
  const passingMarks = Number(form.passingMarks);
  const startDate = new Date(form.startDate);
  const endDate = new Date(form.endDate);

  if (!trimmedTitle) {
    errors.title = 'Title is required.';
  } else if (trimmedTitle.length < 5) {
    errors.title = 'Title must be at least 5 characters.';
  }

  if (!form.subject || !String(form.subject).trim()) {
    errors.subject = 'Subject is required.';
  }

  if (!Number.isInteger(duration) || duration <= 0) {
    errors.duration = 'Duration must be greater than 0 minutes.';
  } else if (duration > 180) {
    errors.duration = 'Duration must be 180 minutes or less.';
  }

  if (!form.selectedQuestions.length) {
    errors.selectedQuestions = 'Select at least one question.';
  }

  if (isTeacher && !form.assignedClasses.length && !form.assignedLabBatches.length) {
    errors.audience = 'Select at least one class or lab batch.';
  }

  if (!Number.isInteger(totalMarks) || totalMarks <= 0) {
    errors.totalMarks = 'Total marks must be greater than 0.';
  }

  if (!Number.isInteger(passingMarks) || passingMarks < 0) {
    errors.passingMarks = 'Passing marks cannot be negative.';
  } else if (Number.isInteger(totalMarks) && passingMarks > totalMarks) {
    errors.passingMarks = 'Passing marks cannot exceed total marks.';
  }

  if (!form.startDate || Number.isNaN(startDate.getTime())) {
    errors.startDate = 'Start date and time are required.';
  }

  if (!form.endDate || Number.isNaN(endDate.getTime())) {
    errors.endDate = 'End date and time are required.';
  }

  if (!errors.startDate && !errors.endDate && endDate <= startDate) {
    errors.endDate = 'End date/time must be after start date/time.';
  }

  return errors;
};

export default function AdminExams() {
  const { user } = useContext(AuthContext);
  const isTeacher = user?.role === 'teacher';
  const teacherAssignedSubjects = useMemo(() => sanitizeSubjectList(user?.subjects), [user?.subjects]);
  const teacherAssignedClasses = useMemo(
    () => normalizeAssignedClasses(user?.assignedClasses ?? user?.assignedBatches),
    [user?.assignedBatches, user?.assignedClasses]
  );
  const teacherAssignedLabBatches = useMemo(
    () => normalizeAssignedLabBatches(user?.assignedLabBatches),
    [user?.assignedLabBatches]
  );
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [catalogSubjectOptions, setCatalogSubjectOptions] = useState([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState(FILTER_ALL);
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState(FILTER_ALL);
  const [questionTopicFilter, setQuestionTopicFilter] = useState(FILTER_ALL);
  const [previewQuestionId, setPreviewQuestionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => buildDefaultExamForm());
  const [examCreationMode, setExamCreationMode] = useState(EXAM_CREATION_MODE_MANUAL);
  const [autoConfig, setAutoConfig] = useState(() => buildDefaultAutoConfig());
  const [showInlineQuestionForm, setShowInlineQuestionForm] = useState(false);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionImageUploading, setQuestionImageUploading] = useState(false);
  const [questionFormError, setQuestionFormError] = useState(null);
  const [questionForm, setQuestionForm] = useState(() => buildInlineQuestionForm());
  const [expandedAttemptExamId, setExpandedAttemptExamId] = useState(null);
  const [attemptOperations, setAttemptOperations] = useState({});
  const [attemptOperationsLoadingExamId, setAttemptOperationsLoadingExamId] = useState('');
  const [attemptResettingId, setAttemptResettingId] = useState('');
  const inlineQuestionTextRef = useRef(null);
  const inlineExplanationRef = useRef(null);
  const inlineOptionRefs = useRef([]);

  const questionMap = useMemo(() => new Map(questions.map((question) => [question._id, question])), [questions]);
  const managedExams = useMemo(() => {
    if (isTeacher) {
      return exams.filter((exam) => String(exam.createdBy?._id || exam.createdBy) === String(user?._id || ''));
    }

    return exams.filter((exam) => exam.createdBy?.role === 'admin');
  }, [exams, isTeacher, user?._id]);
  const selectedQuestionIds = useMemo(() => new Set(form.selectedQuestions.map((item) => item.questionId)), [form.selectedQuestions]);
  const selectedLabBatchKeys = useMemo(
    () => new Set(normalizeAssignedLabBatches(form.assignedLabBatches).map(buildLabBatchAssignmentKey)),
    [form.assignedLabBatches]
  );
  const availableExamSubjects = useMemo(
    () => (isTeacher ? teacherAssignedSubjects : catalogSubjectOptions),
    [catalogSubjectOptions, isTeacher, teacherAssignedSubjects]
  );

  const effectiveSubjectFilter = questionSubjectFilter !== FILTER_ALL
    ? questionSubjectFilter
    : form.subject !== 'Mixed'
      ? form.subject
      : FILTER_ALL;

  const subjectOptions = useMemo(
    () => (isTeacher
      ? teacherAssignedSubjects
      : Array.from(new Set(questions.map((question) => question.subject).filter(Boolean))).sort()),
    [isTeacher, questions, teacherAssignedSubjects]
  );

  const topicOptions = useMemo(() => {
    const source = effectiveSubjectFilter === FILTER_ALL
      ? questions
      : questions.filter((question) => question.subject === effectiveSubjectFilter);

    return Array.from(new Set(source.map((question) => question.topic).filter(Boolean))).sort();
  }, [effectiveSubjectFilter, questions]);

  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();

    return questions.filter((question) => {
      const matchesSearch = !search || question.questionText.toLowerCase().includes(search);
      const matchesSubject = effectiveSubjectFilter === FILTER_ALL || question.subject === effectiveSubjectFilter;
      const matchesDifficulty = questionDifficultyFilter === FILTER_ALL || question.difficulty === questionDifficultyFilter;
      const matchesTopic = questionTopicFilter === FILTER_ALL || question.topic === questionTopicFilter;

      return matchesSearch && matchesSubject && matchesDifficulty && matchesTopic;
    });
  }, [questions, questionSearch, effectiveSubjectFilter, questionDifficultyFilter, questionTopicFilter]);

  const autoGenerationPool = useMemo(() => {
    return questions.filter((question) => (
      form.subject === 'Mixed' || question.subject === form.subject
    ));
  }, [questions, form.subject]);

  const autoGenerationStats = useMemo(() => {
    return DIFFICULTY_OPTIONS.reduce((stats, difficulty) => {
      stats[difficulty] = autoGenerationPool.filter((question) => question.difficulty === difficulty).length;
      return stats;
    }, {});
  }, [autoGenerationPool]);

  const autoRequestedCount = useMemo(() => {
    return DIFFICULTY_OPTIONS.reduce((total, difficulty) => total + (Number(autoConfig[difficulty]) || 0), 0);
  }, [autoConfig]);

  const selectedQuestionDetails = useMemo(
    () => form.selectedQuestions
      .map((item) => {
        const question = questionMap.get(item.questionId);
        if (!question) return null;

        return {
          ...question,
          selectedMarks: item.marks
        };
      })
      .filter(Boolean),
    [form.selectedQuestions, questionMap]
  );

  const previewQuestion = previewQuestionId ? questionMap.get(previewQuestionId) : null;
  const validationErrors = useMemo(() => buildValidationErrors(form, { isTeacher }), [form, isTeacher]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  const updateForm = (updates) => {
    setError(null);
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const updateQuestionForm = (updates) => {
    setQuestionFormError(null);
    setQuestionForm((prev) => ({ ...prev, ...updates }));
  };

  const updateAutoConfig = (difficulty, value) => {
    const nextValue = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    setError(null);
    setAutoConfig((prev) => ({
      ...prev,
      [difficulty]: nextValue
    }));
  };

  const insertSymbolIntoField = ({ field, symbol, input, optionIndex }) => {
    let nextCursorPosition = null;

    setQuestionForm((prev) => {
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

    setQuestionFormError(null);

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
      input: inlineQuestionTextRef.current
    });
  };

  const insertSymbolIntoOption = (index, symbol) => {
    insertSymbolIntoField({
      field: 'options',
      symbol,
      input: inlineOptionRefs.current[index],
      optionIndex: index
    });
  };

  const insertSymbolIntoExplanation = (symbol) => {
    insertSymbolIntoField({
      field: 'explanation',
      symbol,
      input: inlineExplanationRef.current
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [examResponse, questionResponse, subjectResponse] = await Promise.all([
        fetchExams({ mine: isTeacher }),
        isTeacher ? fetchQuestions({ scope: 'assigned' }) : fetchQuestions({}),
        fetchSubjects({ includeInactive: false })
      ]);
      setExams(examResponse.exams || []);
      setQuestions(questionResponse.questions || []);
      setCatalogSubjectOptions((subjectResponse.subjectOptions || []).map((subject) => subject.code || subject));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isTeacher]);

  useEffect(() => {
    if (!isTeacher) {
      return;
    }

    const nextSubject = teacherAssignedSubjects[0] || '';
    if (!nextSubject) {
      return;
    }

    setForm((prev) => {
      if (prev.subject && teacherAssignedSubjects.includes(prev.subject)) {
        return prev;
      }

      return {
        ...prev,
        subject: nextSubject,
      };
    });

    setQuestionSubjectFilter((prev) => (
      prev !== FILTER_ALL && teacherAssignedSubjects.includes(prev)
        ? prev
        : nextSubject
    ));
  }, [isTeacher, teacherAssignedSubjects]);

  useEffect(() => {
    const totalMarks = computeSelectedMarks(form.selectedQuestions);
    const recommendedPassingMarks = totalMarks > 0 ? Math.floor(totalMarks * 0.4) : 0;

    setForm((prev) => {
      const nextPassingMarks = prev.passingMarks > totalMarks
        ? recommendedPassingMarks
        : prev.totalMarks === 0 && totalMarks > 0
          ? recommendedPassingMarks
          : prev.passingMarks;

      if (prev.totalMarks === totalMarks && prev.passingMarks === nextPassingMarks) {
        return prev;
      }

      return {
        ...prev,
        totalMarks,
        passingMarks: nextPassingMarks
      };
    });
  }, [form.selectedQuestions]);

  const openCreateForm = () => {
    const defaultSubject = isTeacher ? (teacherAssignedSubjects[0] || '') : FILTER_ALL;
    setEditId(null);
    setExamCreationMode(EXAM_CREATION_MODE_MANUAL);
    setAutoConfig(buildDefaultAutoConfig());
    setPreviewQuestionId(null);
    setQuestionSearch('');
    setQuestionSubjectFilter(defaultSubject);
    setQuestionDifficultyFilter(FILTER_ALL);
    setQuestionTopicFilter(FILTER_ALL);
    setError(null);
    setQuestionFormError(null);
    setQuestionImageUploading(false);
    setShowInlineQuestionForm(false);
    setForm(buildDefaultExamForm(availableExamSubjects, isTeacher));
    setQuestionForm(buildInlineQuestionForm(isTeacher ? (teacherAssignedSubjects[0] || '') : 'Mixed'));
    setShowForm(true);
  };

  const handleExamCreationModeChange = (mode) => {
    setExamCreationMode(mode);
    setError(null);
    setPreviewQuestionId(null);
    setShowInlineQuestionForm(false);
    setForm((prev) => ({
      ...prev,
      selectedQuestions: [],
      totalMarks: 0,
      passingMarks: 0
    }));
  };

  const updateInlineQuestionOption = (index, value) => {
    const nextOptions = [...questionForm.options];
    nextOptions[index] = value;
    updateQuestionForm({ options: nextOptions });
  };

  const addInlineQuestionOption = () => {
    updateQuestionForm({ options: [...questionForm.options, ''] });
  };

  const removeInlineQuestionOption = (index) => {
    if (questionForm.options.length <= MIN_OPTIONS) {
      return;
    }

    const nextOptions = questionForm.options.filter((_, optionIndex) => optionIndex !== index);
    let nextCorrectAnswer = questionForm.correctAnswer;

    if (index === questionForm.correctAnswer) {
      nextCorrectAnswer = Math.max(0, Math.min(questionForm.correctAnswer, nextOptions.length - 1));
    } else if (index < questionForm.correctAnswer) {
      nextCorrectAnswer = questionForm.correctAnswer - 1;
    }

    updateQuestionForm({ options: nextOptions, correctAnswer: nextCorrectAnswer });
  };

  const resetInlineQuestionForm = (examSubject = form.subject) => {
    setQuestionFormError(null);
    setQuestionImageUploading(false);
    setShowInlineQuestionForm(false);
    setQuestionForm(buildInlineQuestionForm(examSubject));
  };

  const cleanupInlineQuestionImage = async (publicId, { silent = false } = {}) => {
    if (!publicId) {
      return true;
    }

    try {
      await deleteQuestionImage(publicId);
      return true;
    } catch (err) {
      if (!silent) {
        setQuestionFormError(err?.response?.data?.message || err.message);
      }
      return false;
    }
  };

  const discardInlineQuestionForm = async (examSubject = form.subject) => {
    const cleanupOk = await cleanupInlineQuestionImage(questionForm.questionImagePublicId);
    if (!cleanupOk) {
      return false;
    }

    resetInlineQuestionForm(examSubject);
    return true;
  };

  const handleInlineQuestionImageUpload = async (file) => {
    if (!file) {
      return;
    }

    setQuestionFormError(null);
    setQuestionImageUploading(true);
    const previousPublicId = questionForm.questionImagePublicId;

    try {
      const uploadedImage = await uploadQuestionImage(file);
      const cleanedPreviousImage = await cleanupInlineQuestionImage(previousPublicId, { silent: true });
      if (!cleanedPreviousImage && previousPublicId) {
        setQuestionFormError('The new image was uploaded, but the previous temporary image could not be deleted.');
      }

      setQuestionForm((prev) => ({
        ...prev,
        questionImageUrl: uploadedImage.imageUrl,
        questionImagePublicId: uploadedImage.publicId || ''
      }));
    } catch (err) {
      setQuestionFormError(err?.response?.data?.message || err.message);
    } finally {
      setQuestionImageUploading(false);
    }
  };

  const removeInlineQuestionImage = async () => {
    const cleanupOk = await cleanupInlineQuestionImage(questionForm.questionImagePublicId);
    if (!cleanupOk) {
      return;
    }

    setQuestionForm((prev) => ({
      ...prev,
      questionImageUrl: '',
      questionImagePublicId: ''
    }));
  };

  const handleInlineQuestionCreate = async (event) => {
    event.preventDefault();
    setQuestionFormError(null);

    const trimmedQuestionText = questionForm.questionText.trim();
    const normalizedOptions = questionForm.options.map((option) => option.trim());
    const normalizedTopic = questionForm.topic.trim() || 'General';
    const normalizedExplanation = questionForm.explanation.trim();
    const marks = Number(questionForm.marks);
    const negativeMarks = Number(questionForm.negativeMarks);

    if (trimmedQuestionText.length < 10) {
      setQuestionFormError('Question text must be at least 10 characters.');
      return;
    }

    if (normalizedOptions.length < MIN_OPTIONS || normalizedOptions.some((option) => !option)) {
      setQuestionFormError(`Provide at least ${MIN_OPTIONS} non-empty options.`);
      return;
    }

    if (!Number.isInteger(questionForm.correctAnswer) || questionForm.correctAnswer < 0 || questionForm.correctAnswer >= normalizedOptions.length) {
      setQuestionFormError('Choose a valid correct answer.');
      return;
    }

    if (!Number.isInteger(marks) || marks < 1) {
      setQuestionFormError('Marks must be at least 1.');
      return;
    }

    if (Number.isNaN(negativeMarks) || negativeMarks < 0) {
      setQuestionFormError('Negative marks cannot be negative.');
      return;
    }

    if (questionImageUploading) {
      setQuestionFormError('Wait for the question image upload to finish.');
      return;
    }

    const payload = {
      questionText: trimmedQuestionText,
      options: normalizedOptions,
      correctAnswer: questionForm.correctAnswer,
      category: questionForm.category,
      subject: questionForm.subject,
      topic: normalizedTopic,
      difficulty: questionForm.difficulty,
      marks,
      negativeMarks,
      questionImageUrl: questionForm.questionImageUrl,
      questionImagePublicId: questionForm.questionImagePublicId,
      explanation: normalizedExplanation
    };

    setQuestionSubmitting(true);

    try {
      const response = await createQuestion(payload);
      const createdQuestion = response.question;

      setQuestions((prev) => [createdQuestion, ...prev.filter((question) => question._id !== createdQuestion._id)]);
      setForm((prev) => {
        const alreadySelected = prev.selectedQuestions.some((item) => item.questionId === createdQuestion._id);
        if (alreadySelected) {
          return prev;
        }

        return {
          ...prev,
          selectedQuestions: [...prev.selectedQuestions, createSelectedQuestion(createdQuestion)]
        };
      });
      setPreviewQuestionId(createdQuestion._id);
      resetInlineQuestionForm(form.subject);
    } catch (err) {
      setQuestionFormError(err?.response?.data?.message || err.message);
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const syncSelectedQuestions = (questionIds) => {
    const uniqueIds = Array.from(new Set(questionIds));
    const selectedQuestions = uniqueIds
      .map((questionId) => questionMap.get(questionId))
      .filter(Boolean)
      .map(createSelectedQuestion);

    updateForm({ selectedQuestions });
  };

  const toggleQuestionSelect = (question) => {
    const nextIds = selectedQuestionIds.has(question._id)
      ? form.selectedQuestions.map((item) => item.questionId).filter((questionId) => questionId !== question._id)
      : [...form.selectedQuestions.map((item) => item.questionId), question._id];

    syncSelectedQuestions(nextIds);
    setPreviewQuestionId(question._id);
  };

  const selectAllVisible = () => {
    const nextIds = [
      ...form.selectedQuestions.map((item) => item.questionId),
      ...filteredQuestions.map((question) => question._id)
    ];
    syncSelectedQuestions(nextIds);
  };

  const clearSelection = () => {
    updateForm({ selectedQuestions: [] });
  };

  const toggleAssignedClass = (className) => {
    const normalizedClassName = String(className || '').trim();
    if (!normalizedClassName) {
      return;
    }

    updateForm({
      assignedClasses: form.assignedClasses.includes(normalizedClassName)
        ? form.assignedClasses.filter((entry) => entry !== normalizedClassName)
        : [...form.assignedClasses, normalizedClassName]
    });
  };

  const toggleAssignedLabBatch = (assignment) => {
    const normalizedAssignments = normalizeAssignedLabBatches(form.assignedLabBatches);
    const assignmentKey = buildLabBatchAssignmentKey(assignment);
    const hasAssignment = normalizedAssignments.some((entry) => buildLabBatchAssignmentKey(entry) === assignmentKey);

    updateForm({
      assignedLabBatches: hasAssignment
        ? normalizedAssignments.filter((entry) => buildLabBatchAssignmentKey(entry) !== assignmentKey)
        : [...normalizedAssignments, assignment]
    });
  };

  const handleAutoGenerateQuestions = () => {
    const requestedCounts = DIFFICULTY_OPTIONS.reduce((counts, difficulty) => {
      counts[difficulty] = Math.max(0, Number(autoConfig[difficulty]) || 0);
      return counts;
    }, {});

    const totalRequested = Object.values(requestedCounts).reduce((sum, count) => sum + count, 0);
    if (totalRequested <= 0) {
      setError('Enter at least one question count before auto-generating an exam.');
      return;
    }

    const nextSelectedQuestions = [];

    for (const difficulty of DIFFICULTY_OPTIONS) {
      const requiredCount = requestedCounts[difficulty];
      if (!requiredCount) {
        continue;
      }

      const matchingQuestions = autoGenerationPool.filter((question) => question.difficulty === difficulty);
      if (matchingQuestions.length < requiredCount) {
        setError(`Only ${matchingQuestions.length} ${difficulty.toLowerCase()} question(s) are available for ${form.subject === 'Mixed' ? 'the selected subject mix' : form.subject}. Reduce the requested count or add more questions.`);
        return;
      }

      nextSelectedQuestions.push(...shuffleQuestions(matchingQuestions).slice(0, requiredCount).map(createSelectedQuestion));
    }

    const totalMarks = computeSelectedMarks(nextSelectedQuestions);
    const recommendedPassingMarks = totalMarks > 0 ? Math.floor(totalMarks * 0.4) : 0;

    setError(null);
    setPreviewQuestionId(nextSelectedQuestions[0]?.questionId || null);
    setForm((prev) => ({
      ...prev,
      selectedQuestions: nextSelectedQuestions,
      totalMarks,
      passingMarks: recommendedPassingMarks
    }));
  };

  const handleEdit = async (exam) => {
    if (exam.isLocked) {
      showToast('This exam is locked because students have already started it. You can only change its active status now.', { type: 'warning' });
      return;
    }

    const discarded = await discardInlineQuestionForm(exam.subject || 'Mixed');
    if (!discarded && questionForm.questionImagePublicId) {
      return;
    }

    const selectedQuestions = exam.questions
      .map((question) => {
        const questionId = typeof question === 'string' ? question : question._id;
        const sourceQuestion = questionMap.get(questionId) || question;
        if (!sourceQuestion || !questionId) return null;

        return {
          questionId,
          marks: Number(sourceQuestion.marks) || 1
        };
      })
      .filter(Boolean);

    setError(null);
    setPreviewQuestionId(selectedQuestions[0]?.questionId || null);
    setQuestionSearch('');
    setQuestionSubjectFilter(isTeacher ? (exam.subject || teacherAssignedSubjects[0] || '') : FILTER_ALL);
    setQuestionDifficultyFilter(FILTER_ALL);
    setQuestionTopicFilter(FILTER_ALL);
    setExamCreationMode(EXAM_CREATION_MODE_MANUAL);
    setAutoConfig(buildDefaultAutoConfig());
    setQuestionFormError(null);
    setQuestionImageUploading(false);
    setShowInlineQuestionForm(false);
    setForm({
      title: exam.title,
      subject: exam.subject || 'Mixed',
      description: exam.description || '',
      duration: exam.duration,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      selectedQuestions,
      assignedClasses: normalizeAssignedClasses(exam.assignedClasses),
      assignedLabBatches: normalizeAssignedLabBatches(exam.assignedLabBatches),
      startDate: formatDateTimeLocal(exam.startDate),
      endDate: formatDateTimeLocal(exam.endDate),
      isActive: exam.isActive,
      enableNegativeMarking: exam.enableNegativeMarking || false
    });
    setQuestionForm(buildInlineQuestionForm(exam.subject || 'Mixed'));
    setEditId(exam._id);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!isFormValid) {
      setError('Please fix the highlighted fields before saving the exam.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      subject: form.subject,
      description: form.description.trim(),
      duration: Number(form.duration),
      totalMarks: Number(form.totalMarks),
      passingMarks: Number(form.passingMarks),
      questions: form.selectedQuestions.map((item) => item.questionId),
      assignedClasses: normalizeAssignedClasses(form.assignedClasses),
      assignedLabBatches: normalizeAssignedLabBatches(form.assignedLabBatches),
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: form.isActive,
      enableNegativeMarking: form.enableNegativeMarking
    };

    setSubmitting(true);

    try {
      if (editId) {
        await updateExam(editId, payload);
      } else {
        await createExam(payload);
      }

      const cleanedInlineImage = await cleanupInlineQuestionImage(questionForm.questionImagePublicId, { silent: true });
      if (!cleanedInlineImage && questionForm.questionImagePublicId) {
        setError('Exam was saved, but the temporary quick-add question image could not be deleted.');
      }

      setForm(buildDefaultExamForm(availableExamSubjects, isTeacher));
      setEditId(null);
      setPreviewQuestionId(null);
      resetInlineQuestionForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam?')) return;

    try {
      await deleteExam(id);
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  const handleToggleActive = async (exam) => {
    try {
      await updateExam(exam._id, { isActive: !exam.isActive });
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  const handleToggleAttemptOperations = async (exam) => {
    const nextExpandedExamId = expandedAttemptExamId === exam._id ? null : exam._id;
    setExpandedAttemptExamId(nextExpandedExamId);

    if (!nextExpandedExamId || attemptOperations[exam._id]) {
      return;
    }

    setAttemptOperationsLoadingExamId(exam._id);
    try {
      const response = await getActiveAttemptsForExam(exam._id);
      setAttemptOperations((prev) => ({
        ...prev,
        [exam._id]: response.attempts || [],
      }));
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    } finally {
      setAttemptOperationsLoadingExamId('');
    }
  };

  const handleResetManagedAttempt = async (examId, attemptId, studentName) => {
    if (!window.confirm(`Reset the in-progress attempt for ${studentName}? The student will have to restart the exam.`)) {
      return;
    }

    setAttemptResettingId(attemptId);
    try {
      await resetAttempt(attemptId);
      const response = await getActiveAttemptsForExam(examId);
      setAttemptOperations((prev) => ({
        ...prev,
        [examId]: response.attempts || [],
      }));
      await loadData();
      showToast('Attempt reset successfully.', { type: 'success' });
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    } finally {
      setAttemptResettingId('');
    }
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>{isTeacher ? 'Manage My Exams' : 'Manage Exams'}</h2>
        <button
          type="button"
          onClick={async () => {
            if (showForm) {
              const discarded = await discardInlineQuestionForm();
              if (!discarded && questionForm.questionImagePublicId) {
                return;
              }

              setShowForm(false);
              setEditId(null);
              setPreviewQuestionId(null);
              setExamCreationMode(EXAM_CREATION_MODE_MANUAL);
              setAutoConfig(buildDefaultAutoConfig());
              setForm(buildDefaultExamForm(availableExamSubjects, isTeacher));
              return;
            }

            openCreateForm();
          }}
        >
          {showForm ? 'Cancel' : 'Create Exam'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3>
            {editId
              ? 'Edit Exam'
              : examCreationMode === EXAM_CREATION_MODE_AUTO
                ? 'Auto Generate Exam'
                : 'Create Exam Manually'}
          </h3>

          {!editId && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                type="button"
                className={examCreationMode === EXAM_CREATION_MODE_MANUAL ? 'button' : 'button-secondary'}
                onClick={() => handleExamCreationModeChange(EXAM_CREATION_MODE_MANUAL)}
              >
                Create Exam Manually
              </button>
              <button
                type="button"
                className={examCreationMode === EXAM_CREATION_MODE_AUTO ? 'button' : 'button-secondary'}
                onClick={() => handleExamCreationModeChange(EXAM_CREATION_MODE_AUTO)}
              >
                Auto Generate Exam
              </button>
            </div>
          )}

          <div className="small" style={{ marginBottom: 12, color: '#475569' }}>
            Selected: <strong>{form.selectedQuestions.length}</strong> questions | Total Marks: <strong>{form.totalMarks}</strong>
          </div>

          <label>Title</label>
          <input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} />
          {validationErrors.title && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.title}</div>}

          <label style={{ marginTop: 8 }}>Subject</label>
          <select
            value={form.subject}
            onChange={(event) => updateForm({ subject: event.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            {!isTeacher && <option value="Mixed">Mixed (Multiple Subjects)</option>}
            {availableExamSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          {validationErrors.subject && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.subject}</div>}

          <label style={{ marginTop: 8 }}>Description</label>
          <textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} style={{ minHeight: '72px' }} />

          {isTeacher && (
            <>
              <label style={{ marginTop: 8 }}>Exam Audience</label>
              <div className="small" style={{ color: '#64748b', marginTop: 4, marginBottom: 8 }}>
                Select at least one class or lab batch. Only those students will see this exam in their exam tab.
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="small" style={{ color: '#334155', marginBottom: 6, fontWeight: 600 }}>Classes</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {teacherAssignedClasses.map((className) => {
                    const isSelected = form.assignedClasses.includes(className);
                    return (
                      <button
                        key={className}
                        type="button"
                        className={isSelected ? 'button' : 'button-secondary'}
                        onClick={() => toggleAssignedClass(className)}
                      >
                        {className}
                      </button>
                    );
                  })}
                  {!teacherAssignedClasses.length && <div className="small" style={{ color: '#94a3b8' }}>No assigned classes available.</div>}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div className="small" style={{ color: '#334155', marginBottom: 6, fontWeight: 600 }}>Lab Batches</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {teacherAssignedLabBatches.map((assignment) => {
                    const assignmentKey = buildLabBatchAssignmentKey(assignment);
                    const isSelected = selectedLabBatchKeys.has(assignmentKey);
                    return (
                      <button
                        key={assignmentKey}
                        type="button"
                        className={isSelected ? 'button' : 'button-secondary'}
                        onClick={() => toggleAssignedLabBatch(assignment)}
                      >
                        {buildLabBatchAssignmentLabel(assignment)}
                      </button>
                    );
                  })}
                  {!teacherAssignedLabBatches.length && <div className="small" style={{ color: '#94a3b8' }}>No assigned lab batches available.</div>}
                </div>
              </div>

              {validationErrors.audience && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.audience}</div>}
            </>
          )}

          <label style={{ marginTop: 8 }}>Duration (minutes)</label>
          <input type="number" min="1" max="180" value={form.duration} onChange={(event) => updateForm({ duration: Number(event.target.value) })} />
          <div className="small" style={{ color: '#64748b', marginTop: 4 }}>Enter duration in minutes. Maximum 180 minutes.</div>
          {validationErrors.duration && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.duration}</div>}

          <label style={{ marginTop: 8 }}>Total Marks</label>
          <input type="number" min="1" value={form.totalMarks} readOnly />
          <div className="small" style={{ color: '#64748b', marginTop: 6 }}>Computed from selected questions: <strong>{computeSelectedMarks(form.selectedQuestions)}</strong></div>
          {validationErrors.totalMarks && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.totalMarks}</div>}

          <label style={{ marginTop: 8 }}>Passing Marks</label>
          <input type="number" min="0" max={Math.max(form.totalMarks, 0)} value={form.passingMarks} onChange={(event) => updateForm({ passingMarks: Number(event.target.value) })} />
          <div className="small" style={{ color: '#64748b', marginTop: 4 }}>Default is 40% of total marks. You can adjust it as long as it stays within the total marks.</div>
          {validationErrors.passingMarks && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.passingMarks}</div>}

          <label style={{ marginTop: 8 }}>Start Date & Time</label>
          <input type="datetime-local" value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value })} />
          {validationErrors.startDate && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.startDate}</div>}

          <label style={{ marginTop: 8 }}>End Date & Time</label>
          <input type="datetime-local" value={form.endDate} onChange={(event) => updateForm({ endDate: event.target.value })} />
          {validationErrors.endDate && <div className="small" style={{ color: '#dc2626', marginTop: 4 }}>{validationErrors.endDate}</div>}

          {examCreationMode === EXAM_CREATION_MODE_MANUAL && (
            <>
              <label style={{ marginTop: 8 }}>{isTeacher ? 'Assigned Subject Library' : 'Questions'}</label>
              {isTeacher && (
                <div className="small" style={{ color: '#64748b', marginTop: 4, marginBottom: 8 }}>
                  Use questions from your assigned subjects, including your own questions and shared subject library questions.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                <input placeholder="Search question text..." value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} />
                <select value={questionSubjectFilter} onChange={(event) => setQuestionSubjectFilter(event.target.value)}>
                  {!isTeacher && <option value={FILTER_ALL}>All Subjects</option>}
                  {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
                <select value={questionDifficultyFilter} onChange={(event) => setQuestionDifficultyFilter(event.target.value)}>
                  <option value={FILTER_ALL}>All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select value={questionTopicFilter} onChange={(event) => setQuestionTopicFilter(event.target.value)}>
                  <option value={FILTER_ALL}>All Topics</option>
                  {topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={selectAllVisible}>Select Visible</button>
                <button type="button" onClick={clearSelection}>Clear Selection</button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={async () => {
                    if (showInlineQuestionForm) {
                      await discardInlineQuestionForm(form.subject);
                      return;
                    }

                    setQuestionForm(buildInlineQuestionForm(form.subject));
                    setQuestionFormError(null);
                    setShowInlineQuestionForm(true);
                  }}
                >
                  {showInlineQuestionForm ? 'Hide Quick Add' : (isTeacher ? 'Add Question To Assigned Subject Library' : 'Add Question Here')}
                </button>
                <div className="small" style={{ color: '#64748b' }}>Visible: <strong>{filteredQuestions.length}</strong> | Selected: <strong>{form.selectedQuestions.length}</strong> | Total Marks: <strong>{form.totalMarks}</strong></div>
              </div>
              {validationErrors.selectedQuestions && <div className="small" style={{ color: '#dc2626', marginBottom: 8 }}>{validationErrors.selectedQuestions}</div>}

              {showInlineQuestionForm && (
            <div style={{ marginBottom: 12, padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #dbeafe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <strong>Quick Add Custom Question</strong>
                <div className="small" style={{ color: '#64748b' }}>The new question will be added to the question bank and selected for this exam.</div>
              </div>

              {questionFormError && <div className="small" style={{ color: '#dc2626', marginBottom: 12 }}>{questionFormError}</div>}

              <div className="form-group">
                <label>Question Text</label>
                <div className="symbol-field">
                  <textarea
                    ref={inlineQuestionTextRef}
                    className="symbol-field-control symbol-field-control-textarea"
                    value={questionForm.questionText}
                    onChange={(event) => updateQuestionForm({ questionText: event.target.value })}
                    style={{ minHeight: '72px' }}
                  />
                  <SymbolPicker inputRef={inlineQuestionTextRef} onInsert={insertSymbolIntoQuestionText} />
                </div>
              </div>

              <div className="form-group">
                <label>Question Image (optional)</label>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleInlineQuestionImageUpload(event.target.files[0])} />
                <div className="small" style={{ marginTop: 8, color: '#64748b' }}>Uploads to Cloudinary. Supported formats: JPG, PNG, WEBP, GIF. Max 5 MB.</div>
                {questionImageUploading && <div className="small" style={{ marginTop: 8, color: '#64748b' }}>Uploading image...</div>}
                {questionForm.questionImageUrl && (
                  <div style={{ marginTop: 12 }}>
                    <img src={questionForm.questionImageUrl} alt="Question preview" style={{ maxWidth: '240px', width: '100%', borderRadius: '10px', border: '1px solid var(--border)' }} />
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="button-secondary button-sm" onClick={removeInlineQuestionImage} disabled={questionImageUploading}>Remove Image</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ marginBottom: 0 }}>Options</label>
                  <button type="button" className="button-secondary button-sm" onClick={addInlineQuestionOption}>Add Option</button>
                </div>

                <div className="option-editor-grid">
                  {questionForm.options.map((option, index) => (
                    <div key={`inline-question-option-${index}`} className="form-group" style={{ marginBottom: 0 }}>
                      <label>Option {getOptionLabel(index)}</label>
                      <div className="option-editor-row">
                        <div className="symbol-field symbol-field-full">
                          <input
                            ref={(element) => {
                              inlineOptionRefs.current[index] = element;
                            }}
                            className="symbol-field-control symbol-field-control-input"
                            value={option}
                            onChange={(event) => updateInlineQuestionOption(index, event.target.value)}
                          />
                          <SymbolPicker inputRef={{ current: inlineOptionRefs.current[index] }} onInsert={(symbol) => insertSymbolIntoOption(index, symbol)} />
                        </div>
                        <button type="button" className="button-secondary button-sm" onClick={() => removeInlineQuestionOption(index)} disabled={questionForm.options.length <= MIN_OPTIONS}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="small" style={{ marginTop: 8, color: '#64748b' }}>Add as many options as you need. Minimum {MIN_OPTIONS} options.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Correct Answer</label>
                  <select value={questionForm.correctAnswer} onChange={(event) => updateQuestionForm({ correctAnswer: Number(event.target.value) })}>
                    {questionForm.options.map((_, index) => (
                      <option key={`inline-correct-answer-${index}`} value={index}>Option {getOptionLabel(index)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Category</label>
                  <select value={questionForm.category} onChange={(event) => updateQuestionForm({ category: event.target.value })}>
                    <option value="Aptitude">Aptitude</option>
                    <option value="Logical">Logical</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Subject</label>
                  <select value={questionForm.subject} onChange={(event) => updateQuestionForm({ subject: event.target.value })}>
                    {availableExamSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Topic</label>
                  <input value={questionForm.topic} onChange={(event) => updateQuestionForm({ topic: event.target.value })} placeholder="General" />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Difficulty</label>
                  <select value={questionForm.difficulty} onChange={(event) => updateQuestionForm({ difficulty: event.target.value })}>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Marks</label>
                  <input type="number" min="1" value={questionForm.marks} onChange={(event) => updateQuestionForm({ marks: Number(event.target.value) })} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Negative Marks</label>
                  <input type="number" min="0" step="0.25" value={questionForm.negativeMarks} onChange={(event) => updateQuestionForm({ negativeMarks: Number(event.target.value) })} />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Explanation</label>
                <div className="symbol-field symbol-field-full">
                  <textarea
                    ref={inlineExplanationRef}
                    className="symbol-field-control symbol-field-control-textarea"
                    value={questionForm.explanation}
                    onChange={(event) => updateQuestionForm({ explanation: event.target.value })}
                    style={{ minHeight: '72px' }}
                  />
                  <SymbolPicker inputRef={inlineExplanationRef} onInsert={insertSymbolIntoExplanation} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleInlineQuestionCreate} disabled={questionSubmitting || questionImageUploading}>
                  {questionSubmitting ? 'Saving Question...' : 'Save Question And Add To Exam'}
                </button>
                <button type="button" className="button-secondary" onClick={() => discardInlineQuestionForm(form.subject)} disabled={questionSubmitting || questionImageUploading}>
                  Cancel Quick Add
                </button>
              </div>
            </div>
              )}

              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                {filteredQuestions.map((question) => {
                  const isSelected = selectedQuestionIds.has(question._id);
                  return (
                    <div
                      key={question._id}
                      onClick={() => setPreviewQuestionId(question._id)}
                      style={{
                        marginBottom: '8px',
                        padding: '10px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                        background: isSelected ? '#eff6ff' : '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleQuestionSelect(question)}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="small" title={question.questionText} style={{ fontWeight: 600, color: '#0f172a' }}>{question.questionText}</div>
                          <div className="small" style={{ marginTop: 4, color: '#64748b' }}>
                            Subject: {question.subject || 'General'} | Topic: {question.topic || 'General'} | Difficulty: {question.difficulty} | Marks: {question.marks || 1}
                          </div>
                          {question.questionImageUrl && <div className="small" style={{ marginTop: 4, color: '#0b5fff' }}>Image attached</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!filteredQuestions.length && <div className="small" style={{ color: '#64748b' }}>No questions match the current filters.</div>}
              </div>
            </>
          )}

          {examCreationMode === EXAM_CREATION_MODE_AUTO && !editId && (
            <>
              <label style={{ marginTop: 8 }}>Auto Generation Rules</label>
              <div className="small" style={{ color: '#64748b', marginTop: 4, marginBottom: 10 }}>
                Select the subject and how many random questions you want from each difficulty level. A count of 0 is allowed.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                {DIFFICULTY_OPTIONS.map((difficulty) => (
                  <div key={`auto-config-${difficulty}`} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                    <label style={{ marginTop: 0 }}>{difficulty} Questions</label>
                    <input
                      type="number"
                      min="0"
                      value={autoConfig[difficulty]}
                      onChange={(event) => updateAutoConfig(difficulty, event.target.value)}
                    />
                    <div className="small" style={{ color: '#64748b', marginTop: 6 }}>
                      Available: <strong>{autoGenerationStats[difficulty] || 0}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" onClick={handleAutoGenerateQuestions}>Generate Random Questions</button>
                <button type="button" className="button-secondary" onClick={() => {
                  setAutoConfig(buildDefaultAutoConfig());
                  clearSelection();
                  setPreviewQuestionId(null);
                }}>
                  Reset Auto Rules
                </button>
                <div className="small" style={{ color: '#64748b' }}>
                  Requested: <strong>{autoRequestedCount}</strong> | Generated: <strong>{form.selectedQuestions.length}</strong> | Total Marks: <strong>{form.totalMarks}</strong>
                </div>
              </div>
              {validationErrors.selectedQuestions && <div className="small" style={{ color: '#dc2626', marginBottom: 8 }}>{validationErrors.selectedQuestions}</div>}
            </>
          )}

          {previewQuestion && (
            <div style={{ marginTop: 12, padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>Question Preview</strong>
                <button type="button" className="button-sm" onClick={() => setPreviewQuestionId(null)}>Hide</button>
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>{previewQuestion.questionText}</div>
              {previewQuestion.questionImageUrl && (
                <img src={previewQuestion.questionImageUrl} alt="Question preview" style={{ marginTop: 12, maxWidth: '320px', width: '100%', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
              )}
              <div className="small" style={{ marginTop: 8, color: '#64748b' }}>
                Subject: {previewQuestion.subject || 'General'} | Topic: {previewQuestion.topic || 'General'} | Difficulty: {previewQuestion.difficulty} | Marks: {previewQuestion.marks || 1}
              </div>
              {Array.isArray(previewQuestion.options) && previewQuestion.options.length > 0 && (
                <ol style={{ margin: '10px 0 0 20px', color: '#334155' }}>
                  {previewQuestion.options.map((option, index) => <li key={index} style={{ marginBottom: 4 }}>{option}</li>)}
                </ol>
              )}
            </div>
          )}

          {selectedQuestionDetails.length > 0 && (
            <div style={{ marginTop: 12, padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong>{examCreationMode === EXAM_CREATION_MODE_AUTO && !editId ? 'Auto Generated Questions' : 'Selected Questions'}</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {selectedQuestionDetails.map((question) => (
                  <div key={question._id} className="small" style={{ color: '#334155' }}>
                    {question.questionText} <span style={{ color: '#64748b' }}>(Marks: {question.selectedMarks})</span>{question.questionImageUrl ? ' [Image]' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          <label style={{ marginTop: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm({ isActive: event.target.checked })} />
            <span style={{ marginLeft: '6px' }}>Active</span>
          </label>

          <label style={{ marginTop: 8 }}>
            <input type="checkbox" checked={form.enableNegativeMarking} onChange={(event) => updateForm({ enableNegativeMarking: event.target.checked })} />
            <span style={{ marginLeft: '6px' }}>Enable Negative Marking</span>
          </label>
          {form.enableNegativeMarking && (
            <div className="alert" style={{ marginTop: 8, padding: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <strong>Warning:</strong> Students can get negative total scores if they answer many questions incorrectly.
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={submitting || !isFormValid}>
              {submitting ? (editId ? 'Updating...' : 'Creating...') : editId ? 'Update Exam' : examCreationMode === EXAM_CREATION_MODE_AUTO ? 'Create Auto Generated Exam' : 'Create Exam Manually'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        {loading && <LoadingSpinner />}
        {!loading && !managedExams.length && <p className="text-muted text-center">No {isTeacher ? 'teacher-created' : 'admin-created'} exams yet. <a href="#0" onClick={(event) => { event.preventDefault(); openCreateForm(); }}>Create one</a></p>}
        {!loading && managedExams.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Marks</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managedExams.map((exam) => (
                <React.Fragment key={exam._id}>
                <tr>
                  <td>
                    <strong>{exam.title}</strong>
                    {exam.description && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{exam.description.substring(0, 50)}...</div>}
                    {isTeacher && (
                      <div style={{ marginTop: '8px' }}>
                        <div className="text-small" style={{ marginBottom: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Audience
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {buildTeacherAudienceBadges(exam).map((badge) => (
                            <span key={badge.key} style={{ ...audienceBadgeBaseStyle, ...getAudienceBadgeStyle(badge.tone) }}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>{exam.duration} min</td>
                  <td>{exam.totalMarks} <span className="text-small" style={{ color: 'var(--text-muted)' }}>/{exam.passingMarks}</span></td>
                  <td>{exam.questions.length}</td>
                  <td>
                    <span className={`badge ${exam.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {exam.isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                    {exam.isLocked && (
                      <div className="text-small" style={{ marginTop: '6px', color: 'var(--text-muted)' }}>
                        Locked after start • {exam.attemptStats?.startedCount || 0} started • {exam.attemptStats?.completedCount || 0} completed
                      </div>
                    )}
                  </td>
                  <td>
                    {exam.isLocked ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button className="button-sm" onClick={() => handleToggleActive(exam)}>
                          {exam.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="button-sm button-secondary" onClick={() => handleToggleAttemptOperations(exam)}>
                          {expandedAttemptExamId === exam._id ? 'Hide Attempts' : 'Manage Attempts'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button className="button-sm" onClick={() => handleEdit(exam)}>Edit</button>
                        <button className="button-sm button-danger" onClick={() => handleDelete(exam._id)} style={{ marginLeft: '4px' }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
                {expandedAttemptExamId === exam._id && exam.isLocked && (
                  <tr>
                    <td colSpan={6} style={{ background: '#f8fafc' }}>
                      <div style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div>
                            <strong>Active Attempt Operations</strong>
                            <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                              Review in-progress attempts and reset individual students when needed.
                            </div>
                          </div>
                          <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                            {attemptOperationsLoadingExamId === exam._id
                              ? 'Loading attempts...'
                              : `${(attemptOperations[exam._id] || []).length} active attempt(s)`}
                          </div>
                        </div>

                        {attemptOperationsLoadingExamId === exam._id ? (
                          <LoadingSpinner />
                        ) : !(attemptOperations[exam._id] || []).length ? (
                          <div className="text-small" style={{ color: 'var(--text-muted)' }}>No active attempts for this exam.</div>
                        ) : (
                          <div className="report-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Student</th>
                                  <th>Progress</th>
                                  <th>Started</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(attemptOperations[exam._id] || []).map((attempt) => {
                                  const studentName = attempt.user?.name || attempt.user?.firstName || 'Student';
                                  return (
                                    <tr key={attempt._id}>
                                      <td>
                                        <strong>{studentName}</strong>
                                        <div className="text-small">{attempt.user?.email || 'No email'}</div>
                                        <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                                          {attempt.user?.enrollmentNo || 'No enrollment'}
                                          {attempt.user?.batch ? ` • ${attempt.user.batch}` : ''}
                                          {attempt.user?.labBatch ? ` • ${attempt.user.labBatch}` : ''}
                                        </div>
                                      </td>
                                      <td>
                                        <strong>{attempt.answeredCount} / {attempt.totalQuestions}</strong>
                                        <div className="text-small" style={{ color: 'var(--text-muted)' }}>{attempt.progressPercent}% complete</div>
                                      </td>
                                      <td>{attempt.startTime ? new Date(attempt.startTime).toLocaleString() : '-'}</td>
                                      <td>
                                        <button
                                          className="button-sm button-danger"
                                          onClick={() => handleResetManagedAttempt(exam._id, attempt._id, studentName)}
                                          disabled={attemptResettingId === attempt._id}
                                        >
                                          {attemptResettingId === attempt._id ? 'Resetting...' : 'Reset Attempt'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
