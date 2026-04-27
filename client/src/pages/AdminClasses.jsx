import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../utils/appEvents';
import {
  assignLabBatch,
  assignStudentsToClass,
  bulkAssignStudentsToClass,
  bulkCreateClasses,
  createClass,
  createLabBatch,
  deleteClass,
  deleteLabBatch,
  fetchClasses,
  promoteClasses,
  removeStudentsFromClass,
  updateClass,
  updateLabBatch,
} from '../services/classService';

const YEAR_OPTIONS = [1, 2, 3, 4];

const EMPTY_CLASS_FORM = {
  name: '',
  year: 1,
  course: 'GENERAL',
  capacity: 60,
  description: '',
};

const EMPTY_LAB_BATCH_FORM = {
  name: '',
  capacity: 20,
};

const MAX_BULK_CLASSES = 200;
const MAX_BULK_STUDENT_ASSIGNMENTS = 500;

const normalizeUploadedClass = (row = {}) => ({
  name: String(row.name || '').trim().toUpperCase(),
  year: Number(row.year || 1),
  course: String(row.course || 'GENERAL').trim().toUpperCase(),
  capacity: Number(row.capacity || 60),
  description: String(row.description || '').trim(),
});

const normalizeUploadedStudentAssignment = (row = {}) => ({
  enrollmentNo: String(row.enrollmentNo || row.enrollment || '').trim().toUpperCase(),
  labBatch: String(row.labBatch || '').trim(),
});

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

const filterStudentsByQuery = (students, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return students;
  }

  return students.filter((student) => {
    const values = [student.name, student.email, student.enrollmentNo, student.batch, student.labBatch]
      .map((value) => String(value || '').toLowerCase());
    return values.some((value) => value.includes(normalizedQuery));
  });
};

const getCapacityTone = (currentCount, capacity) => {
  if (!capacity) {
    return '#475569';
  }

  if (currentCount >= capacity) {
    return '#dc2626';
  }

  if (currentCount >= capacity * 0.8) {
    return '#d97706';
  }

  return '#15803d';
};

const ChevronIcon = ({ expanded }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: 999,
      background: expanded ? 'rgba(255, 255, 255, 0.16)' : '#e2e8f0',
      color: expanded ? '#ffffff' : '#1e3a8a',
      transform: `rotate(${expanded ? 180 : 0}deg)`,
      transition: 'transform 0.2s ease, background-color 0.2s ease, color 0.2s ease',
      flexShrink: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export default function AdminClasses() {
  const bulkUploadInputRef = useRef(null);
  const bulkStudentUploadInputRef = useRef(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classForm, setClassForm] = useState(EMPTY_CLASS_FORM);
  const [classEditForm, setClassEditForm] = useState(EMPTY_CLASS_FORM);
  const [labBatchForm, setLabBatchForm] = useState(EMPTY_LAB_BATCH_FORM);
  const [labBatchEditForm, setLabBatchEditForm] = useState(EMPTY_LAB_BATCH_FORM);
  const [classStudentSelection, setClassStudentSelection] = useState([]);
  const [labStudentSelection, setLabStudentSelection] = useState([]);
  const [selectedPromotionClassIds, setSelectedPromotionClassIds] = useState([]);
  const [labBatchAssignmentName, setLabBatchAssignmentName] = useState('');
  const [selectedLabBatchId, setSelectedLabBatchId] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [classStudentSearch, setClassStudentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkStudentAssigning, setBulkStudentAssigning] = useState(false);
  const [bulkStudentResult, setBulkStudentResult] = useState(null);
  const [bulkStudentPreviewRows, setBulkStudentPreviewRows] = useState([]);
  const [bulkStudentPreviewFileName, setBulkStudentPreviewFileName] = useState('');
  const [promotingClasses, setPromotingClasses] = useState(false);
  const [updatingClass, setUpdatingClass] = useState(false);
  const [deletingSelectedClass, setDeletingSelectedClass] = useState(false);
  const [assigningStudents, setAssigningStudents] = useState(false);
  const [creatingLabBatch, setCreatingLabBatch] = useState(false);
  const [updatingSelectedLabBatch, setUpdatingSelectedLabBatch] = useState(false);
  const [deletingSelectedLabBatch, setDeletingSelectedLabBatch] = useState(false);
  const [assigningLabBatch, setAssigningLabBatch] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState(null);
  const [clearingLabBatchStudentId, setClearingLabBatchStudentId] = useState(null);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchClasses();
      setClasses(response.classes || []);
      setStudents(response.students || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedClass = useMemo(
    () => classes.find((academicClass) => academicClass._id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedClassId(null);
      setSelectedPromotionClassIds([]);
      setBulkStudentResult(null);
      setBulkStudentPreviewRows([]);
      setBulkStudentPreviewFileName('');
      return;
    }

    if (selectedClassId && !classes.some((academicClass) => academicClass._id === selectedClassId)) {
      setSelectedClassId(null);
    }

    setSelectedPromotionClassIds((currentSelection) => currentSelection.filter((classId) => classes.some((academicClass) => academicClass._id === classId)));
  }, [classes, selectedClassId]);

  useEffect(() => {
    setBulkStudentResult(null);
    setBulkStudentPreviewRows([]);
    setBulkStudentPreviewFileName('');
    if (bulkStudentUploadInputRef.current) {
      bulkStudentUploadInputRef.current.value = '';
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClass) {
      setClassEditForm(EMPTY_CLASS_FORM);
      return;
    }

    setClassEditForm({
      name: selectedClass.name || '',
      year: selectedClass.year || 1,
      course: selectedClass.course || 'GENERAL',
      capacity: selectedClass.capacity || 1,
      description: selectedClass.description || '',
    });
  }, [selectedClass]);

  const selectedLabBatch = useMemo(
    () => selectedClass?.labBatches.find((labBatch) => labBatch._id === selectedLabBatchId) || selectedClass?.labBatches[0] || null,
    [selectedClass, selectedLabBatchId]
  );

  useEffect(() => {
    if (!selectedClass?.labBatches?.length) {
      setSelectedLabBatchId(null);
      setLabBatchEditForm(EMPTY_LAB_BATCH_FORM);
      return;
    }

    if (!selectedClass.labBatches.some((labBatch) => labBatch._id === selectedLabBatchId)) {
      setSelectedLabBatchId(selectedClass.labBatches[0]._id);
    }
  }, [selectedClass, selectedLabBatchId]);

  useEffect(() => {
    if (!selectedLabBatch) {
      setLabBatchEditForm(EMPTY_LAB_BATCH_FORM);
      return;
    }

    setLabBatchEditForm({
      name: selectedLabBatch.name || '',
      capacity: selectedLabBatch.capacity || 1,
    });
  }, [selectedLabBatch]);

  useEffect(() => {
    if (!selectedClass?.labBatches?.length) {
      setLabBatchAssignmentName('');
      return;
    }

    if (!selectedClass.labBatches.some((labBatch) => labBatch.name === labBatchAssignmentName)) {
      setLabBatchAssignmentName(selectedClass.labBatches[0].name);
    }
  }, [selectedClass, labBatchAssignmentName]);

  const selectedClassStudents = useMemo(
    () => students.filter((student) => student.batch === selectedClass?.name),
    [students, selectedClass?.name]
  );
  const previewStudentLookup = useMemo(
    () => new Map(students.map((student) => [String(student.enrollmentNo || '').trim().toUpperCase(), student])),
    [students]
  );
  const visibleStudents = useMemo(
    () => filterStudentsByQuery(students, studentSearch),
    [students, studentSearch]
  );
  const visibleClassStudents = useMemo(
    () => filterStudentsByQuery(selectedClassStudents, classStudentSearch),
    [selectedClassStudents, classStudentSearch]
  );
  const classUtilizationColor = useMemo(
    () => getCapacityTone(selectedClass?.studentCount || 0, selectedClass?.capacity || 0),
    [selectedClass?.capacity, selectedClass?.studentCount]
  );
  const selectedClassOpenSeats = useMemo(
    () => Math.max((selectedClass?.capacity || 0) - (selectedClass?.studentCount || 0), 0),
    [selectedClass?.capacity, selectedClass?.studentCount]
  );

  const toggleSelection = (currentSelection, setSelection, studentId) => {
    setSelection((prev) => (
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    ));
  };

  const togglePromotionClassSelection = (classId) => {
    setSelectedPromotionClassIds((currentSelection) => (
      currentSelection.includes(classId)
        ? currentSelection.filter((entry) => entry !== classId)
        : [...currentSelection, classId]
    ));
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();
    setSavingClass(true);
    setError(null);

    try {
      const response = await createClass({
        name: classForm.name,
        year: Number(classForm.year),
        course: classForm.course,
        capacity: Number(classForm.capacity),
        description: classForm.description,
      });
      showToast(response.message || 'Class created successfully.', { type: 'success' });
      setClassForm(EMPTY_CLASS_FORM);
      await loadData();
      if (response.class?._id) {
        setSelectedClassId(response.class._id);
      }
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setSavingClass(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleRows = [
      ['name', 'year', 'course', 'capacity', 'description'],
      ['FY-GENERAL-A', '1', 'GENERAL', '120', 'First year common batch'],
      ['SY-CSE-1', '2', 'CSE', '60', 'Second year CSE division 1'],
      ['TY-ECE-B', '3', 'ECE', '60', 'Third year ECE section B'],
    ];

    const csvContent = sampleRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_classes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFileUpload = async (file) => {
    setBulkResult(null);
    if (!file) {
      return;
    }

    setBulkUploading(true);
    setError(null);
    try {
      const text = await file.text();
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing errors: ${parsed.errors.map((entry) => entry.message).join(', ')}`);
      }

      if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
        throw new Error('No valid class rows found in the CSV file');
      }

      if (parsed.data.length > MAX_BULK_CLASSES) {
        throw new Error(`Bulk import supports up to ${MAX_BULK_CLASSES} classes per upload`);
      }

      const rows = parsed.data.map((row, index) => {
        const normalizedRow = normalizeUploadedClass(row);

        if (!normalizedRow.name) {
          throw new Error(`Row ${index + 2}: Class name is required`);
        }

        if (!YEAR_OPTIONS.includes(normalizedRow.year)) {
          throw new Error(`Row ${index + 2}: Year must be between 1 and 4`);
        }

        if (!normalizedRow.course) {
          throw new Error(`Row ${index + 2}: Course is required`);
        }

        if (!Number.isInteger(normalizedRow.capacity) || normalizedRow.capacity <= 0) {
          throw new Error(`Row ${index + 2}: Capacity must be a positive integer`);
        }

        return normalizedRow;
      });

      const response = await bulkCreateClasses(rows);
      setBulkResult(response);
      setClasses(response.classes || []);
      setStudents(response.students || []);
      showToast(response.message || 'Bulk class import finished.', {
        type: response.failedCount > 0 ? 'warning' : 'success',
      });
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      setBulkResult({ error: message });
      showToast(message, { type: 'error' });
    } finally {
      setBulkUploading(false);
      if (bulkUploadInputRef.current) {
        bulkUploadInputRef.current.value = '';
      }
    }
  };

  const handleAssignStudentsToClass = async () => {
    if (!selectedClass || classStudentSelection.length === 0) {
      return;
    }

    setAssigningStudents(true);
    setError(null);
    try {
      const response = await assignStudentsToClass(selectedClass._id, classStudentSelection);
      setClasses((response.classes || []).length ? response.classes : classes.map((academicClass) => academicClass._id === response.class._id ? response.class : academicClass));
      setStudents(response.students || students);
      setClassStudentSelection([]);
      showToast(response.message || 'Students assigned to class successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setAssigningStudents(false);
    }
  };

  const downloadStudentAssignmentSampleCSV = () => {
    if (!selectedClass) {
      return;
    }

    const preferredLabBatch = selectedClass.labBatches?.[0]?.name || '';
    const sampleRows = [
      ['enrollmentNo', 'labBatch'],
      ['STUDENT001', preferredLabBatch],
      ['STUDENT002', ''],
      ['STUDENT003', preferredLabBatch],
    ];

    downloadCsvFile(sampleRows, `${selectedClass.name.toLowerCase()}_student_assignments.csv`);
  };

  const exportCurrentClassRosterCSV = () => {
    if (!selectedClass) {
      return;
    }

    const rosterRows = [
      ['enrollmentNo', 'labBatch'],
      ...selectedClassStudents
        .slice()
        .sort((left, right) => String(left.enrollmentNo || '').localeCompare(String(right.enrollmentNo || '')))
        .map((student) => [student.enrollmentNo || '', student.labBatch || '']),
    ];

    downloadCsvFile(rosterRows, `${selectedClass.name.toLowerCase()}_current_roster.csv`);
  };

  const clearBulkStudentPreview = () => {
    setBulkStudentPreviewRows([]);
    setBulkStudentPreviewFileName('');
    setBulkStudentResult(null);
    if (bulkStudentUploadInputRef.current) {
      bulkStudentUploadInputRef.current.value = '';
    }
  };

  const handleBulkStudentUpload = async (file) => {
    setBulkStudentResult(null);
    if (!file || !selectedClass) {
      return;
    }

    setBulkStudentAssigning(true);
    setError(null);
    try {
      const text = await file.text();
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing errors: ${parsed.errors.map((entry) => entry.message).join(', ')}`);
      }

      if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
        throw new Error('No valid student assignment rows found in the CSV file');
      }

      if (parsed.data.length > MAX_BULK_STUDENT_ASSIGNMENTS) {
        throw new Error(`Bulk student assignment supports up to ${MAX_BULK_STUDENT_ASSIGNMENTS} rows per upload`);
      }

      const seenEnrollments = new Set();
      const rows = parsed.data.map((row, index) => {
        const normalizedRow = normalizeUploadedStudentAssignment(row);
        if (!normalizedRow.enrollmentNo) {
          throw new Error(`Row ${index + 2}: Enrollment number is required`);
        }

        const matchedStudent = previewStudentLookup.get(normalizedRow.enrollmentNo) || null;
        const matchingLabBatch = normalizedRow.labBatch
          ? selectedClass.labBatches.find((labBatch) => labBatch.name.toLowerCase() === normalizedRow.labBatch.toLowerCase()) || null
          : null;
        let previewError = '';

        if (seenEnrollments.has(normalizedRow.enrollmentNo)) {
          previewError = 'Duplicate enrollment number in file';
        } else if (!matchedStudent) {
          previewError = 'Student not found';
        } else if (normalizedRow.labBatch && !matchingLabBatch) {
          previewError = `Lab batch ${normalizedRow.labBatch} does not exist in ${selectedClass.name}`;
        }

        seenEnrollments.add(normalizedRow.enrollmentNo);

        return {
          ...normalizedRow,
          rowNumber: index + 2,
          studentName: matchedStudent?.name || '',
          currentClass: matchedStudent?.batch || '',
          currentLabBatch: matchedStudent?.labBatch || '',
          previewError,
        };
      });

      setBulkStudentPreviewRows(rows);
      setBulkStudentPreviewFileName(file.name || 'student_assignments.csv');
      showToast(`Parsed ${rows.length} student assignment row(s). Review the preview before importing.`, { type: 'success' });
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      setBulkStudentResult({ error: message });
      showToast(message, { type: 'error' });
    } finally {
      setBulkStudentAssigning(false);
      if (bulkStudentUploadInputRef.current) {
        bulkStudentUploadInputRef.current.value = '';
      }
    }
  };

  const handleConfirmBulkStudentUpload = async () => {
    if (!selectedClass || bulkStudentPreviewRows.length === 0) {
      return;
    }

    const hasPreviewErrors = bulkStudentPreviewRows.some((row) => row.previewError);
    if (hasPreviewErrors) {
      const message = 'Resolve the preview issues before importing student assignments.';
      setError(message);
      showToast(message, { type: 'error' });
      return;
    }

    setBulkStudentAssigning(true);
    setError(null);
    setBulkStudentResult(null);
    try {
      const response = await bulkAssignStudentsToClass(
        selectedClass._id,
        bulkStudentPreviewRows.map((row) => ({
          enrollmentNo: row.enrollmentNo,
          labBatch: row.labBatch,
        }))
      );
      setStudents(response.students || students);
      setBulkStudentResult(response);
      setBulkStudentPreviewRows([]);
      setBulkStudentPreviewFileName('');
      showToast(response.message || 'Bulk student assignment finished.', {
        type: response.failedCount > 0 ? 'warning' : 'success',
      });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      setBulkStudentResult({ error: message });
      showToast(message, { type: 'error' });
    } finally {
      setBulkStudentAssigning(false);
      if (bulkStudentUploadInputRef.current) {
        bulkStudentUploadInputRef.current.value = '';
      }
    }
  };

  const handleUpdateClass = async (event) => {
    event.preventDefault();
    if (!selectedClass) {
      return;
    }

    setUpdatingClass(true);
    setError(null);
    try {
      const response = await updateClass(selectedClass._id, {
        name: classEditForm.name,
        year: Number(classEditForm.year),
        course: classEditForm.course,
        capacity: Number(classEditForm.capacity),
        description: classEditForm.description,
      });
      showToast(response.message || 'Class updated successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setUpdatingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedClass.name}? This clears that class from students and teachers.`);
    if (!confirmed) {
      return;
    }

    setDeletingSelectedClass(true);
    setError(null);
    try {
      const response = await deleteClass(selectedClass._id);
      showToast(response.message || 'Class deleted successfully.', { type: 'success' });
      setSelectedClassId(null);
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setDeletingSelectedClass(false);
    }
  };

  const handlePromoteSelectedClasses = async () => {
    if (selectedPromotionClassIds.length === 0) {
      return;
    }

    const selectedClasses = classes.filter((academicClass) => selectedPromotionClassIds.includes(academicClass._id));
    const finalYearClasses = selectedClasses.filter((academicClass) => Number(academicClass.year || 1) >= 4);
    if (finalYearClasses.length > 0) {
      const message = `Cannot promote final-year classes: ${finalYearClasses.map((academicClass) => academicClass.name).join(', ')}`;
      setError(message);
      showToast(message, { type: 'error' });
      return;
    }

    const confirmed = window.confirm(`Promote ${selectedClasses.length} selected class(es) to the next year? Student memberships remain the same, but year-wise subject scope will change.`);
    if (!confirmed) {
      return;
    }

    setPromotingClasses(true);
    setError(null);
    try {
      const response = await promoteClasses(selectedPromotionClassIds);
      setSelectedPromotionClassIds([]);
      showToast(response.message || 'Selected classes promoted successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setPromotingClasses(false);
    }
  };

  const handleCreateLabBatch = async (event) => {
    event.preventDefault();
    if (!selectedClass) {
      return;
    }

    setCreatingLabBatch(true);
    setError(null);
    try {
      const response = await createLabBatch(selectedClass._id, {
        name: labBatchForm.name,
        capacity: Number(labBatchForm.capacity),
      });
      setLabBatchForm(EMPTY_LAB_BATCH_FORM);
      const createdLabBatch = response.class?.labBatches?.[response.class.labBatches.length - 1];
      setLabBatchAssignmentName(createdLabBatch?.name || labBatchAssignmentName);
      setSelectedLabBatchId(createdLabBatch?._id || null);
      showToast(response.message || 'Lab batch created successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setCreatingLabBatch(false);
    }
  };

  const handleUpdateSelectedLabBatch = async (event) => {
    event.preventDefault();
    if (!selectedClass || !selectedLabBatch) {
      return;
    }

    setUpdatingSelectedLabBatch(true);
    setError(null);
    try {
      const response = await updateLabBatch(selectedClass._id, selectedLabBatch._id, {
        name: labBatchEditForm.name,
        capacity: Number(labBatchEditForm.capacity),
      });
      showToast(response.message || 'Lab batch updated successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setUpdatingSelectedLabBatch(false);
    }
  };

  const handleDeleteSelectedLabBatch = async () => {
    if (!selectedClass || !selectedLabBatch) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedLabBatch.name}? Students in this lab batch will be unassigned.`);
    if (!confirmed) {
      return;
    }

    setDeletingSelectedLabBatch(true);
    setError(null);
    try {
      const response = await deleteLabBatch(selectedClass._id, selectedLabBatch._id);
      showToast(response.message || 'Lab batch deleted successfully.', { type: 'success' });
      setSelectedLabBatchId(null);
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setDeletingSelectedLabBatch(false);
    }
  };

  const handleAssignLabBatch = async (labBatchName = labBatchAssignmentName) => {
    if (!selectedClass || labStudentSelection.length === 0) {
      return;
    }

    setAssigningLabBatch(true);
    setError(null);
    try {
      const response = await assignLabBatch(selectedClass._id, {
        labBatchName,
        studentIds: labStudentSelection,
      });
      setStudents(response.students || students);
      setLabStudentSelection([]);
      showToast(response.message || 'Lab batch assignments updated successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setAssigningLabBatch(false);
    }
  };

  const handleRemoveStudentFromSelectedClass = async (studentId) => {
    if (!selectedClass || !studentId) {
      return;
    }

    const student = students.find((entry) => entry._id === studentId);
    const confirmed = window.confirm(`Remove ${student?.name || 'this student'} from ${selectedClass.name}? This also clears their lab batch.`);
    if (!confirmed) {
      return;
    }

    setRemovingStudentId(studentId);
    setError(null);
    try {
      const response = await removeStudentsFromClass(selectedClass._id, [studentId]);
      setStudents(response.students || students);
      showToast(response.message || 'Student removed from class successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleClearStudentLabBatch = async (studentId) => {
    if (!selectedClass || !studentId) {
      return;
    }

    setClearingLabBatchStudentId(studentId);
    setError(null);
    try {
      const response = await assignLabBatch(selectedClass._id, {
        labBatchName: '',
        studentIds: [studentId],
      });
      setStudents(response.students || students);
      showToast(response.message || 'Student removed from lab batch successfully.', { type: 'success' });
      await loadData();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setClearingLabBatchStudentId(null);
    }
  };

  const handleToggleClass = (classId) => {
    setSelectedClassId((currentId) => (currentId === classId ? null : classId));
  };

  return (
    <div className="admin-page">
      {/* Hidden file inputs */}
      <input ref={bulkUploadInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(event) => handleBulkFileUpload(event.target.files?.[0])} />
      <input ref={bulkStudentUploadInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(event) => handleBulkStudentUpload(event.target.files?.[0])} />

      {/* â”€â”€ Page Header â”€â”€ */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Manage Classes</h1>
          <div className="page-title-bar" />
          <p className="page-subtitle">Theory classes, lab batches &amp; student assignments</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn-outline" onClick={downloadSampleCSV}>â†“ Sample CSV</button>
          <button type="button" className="btn-outline" onClick={() => bulkUploadInputRef.current?.click()} disabled={bulkUploading}>
            {bulkUploading ? 'Uploading…' : 'ðŸ“ Bulk Upload'}
          </button>
          <button type="button" className="btn-cta" onClick={() => setShowCreateModal(true)}>+ Create Class</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      {bulkResult?.error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{bulkResult.error}</div>}
      {bulkResult && !bulkResult.error && (
        <div style={{ marginBottom: 16 }}>
          <div className={`alert ${bulkResult.failedCount > 0 ? 'alert-warning' : 'alert-success'}`}>
            Created {bulkResult.createdCount} class(es). Failed {bulkResult.failedCount}.
          </div>
          {bulkResult.errors?.length > 0 && (
            <div className="preview-panel" style={{ marginTop: 8 }}>
              <strong style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem' }}>Import Issues</strong>
              {bulkResult.errors.map((rowError, index) => (
                <div key={`${rowError.row}-${rowError.name || 'class'}-${index}`} className="small">
                  Row {rowError.row}{rowError.name ? ` (${rowError.name})` : ''}: {rowError.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Stat Cards â”€â”€ */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-accent" style={{ background: '#6A0DAD' }} />
          <div className="stat-card-value">{loading ? '—' : classes.length}</div>
          <div className="stat-card-label">Total Classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-accent" style={{ background: '#9B30E0' }} />
          <div className="stat-card-value">{loading ? '—' : students.filter(s => s.batch).length}</div>
          <div className="stat-card-label">Assigned Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-accent" style={{ background: '#4B0082' }} />
          <div className="stat-card-value">{loading ? '—' : classes.reduce((sum, c) => sum + Math.max((c.capacity || 0) - (c.studentCount || 0), 0), 0)}</div>
          <div className="stat-card-label">Open Seats</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-accent" style={{ background: '#C0359E' }} />
          <div className="stat-card-value">{loading ? '—' : classes.reduce((sum, c) => sum + (c.labBatches?.length || 0), 0)}</div>
          <div className="stat-card-label">Lab Batches</div>
        </div>
      </div>

      {/* â”€â”€ Promotion Bar â”€â”€ */}
      {!loading && classes.length > 0 && (
        <div className="promotion-bar">
          <div className="inline-toolbar">
            <span style={{ fontSize: '0.82rem', color: '#5A5A7A' }}>Promotion:</span>
            <span className="badge badge-primary">{selectedPromotionClassIds.length} selected</span>
          </div>
          <div className="inline-toolbar">
            <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => setSelectedPromotionClassIds(classes.filter((c) => Number(c.year || 1) < 4).map((c) => c._id))}>Select Promotable</button>
            <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => setSelectedPromotionClassIds([])}>Clear</button>
            <button type="button" className="btn-purple" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={handlePromoteSelectedClasses} disabled={promotingClasses || selectedPromotionClassIds.length === 0}>
              {promotingClasses ? 'Promoting…' : 'Promote Selected'}
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ Class List â”€â”€ */}
      <div className="data-card">
        {loading && <div className="empty-state"><LoadingSpinner /></div>}
        {!loading && classes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">ðŸ›ï¸</div>
            <div className="empty-state-title">No classes created yet</div>
            <div className="empty-state-text">Create your first theory class to get started.</div>
            <button type="button" className="btn-cta" onClick={() => setShowCreateModal(true)}>+ Create Class</button>
          </div>
        )}
        {!loading && classes.length > 0 && (
          <div className="data-card-body" style={{ padding: 0 }}>
            <div className="data-card-header">
              <h3 className="data-card-title">{classes.length} Classes</h3>
              <span className="small">Click a class to expand details</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
            {classes.map((academicClass) => {
              const isActive = selectedClass?._id === academicClass._id;
              const classStudents = students.filter((student) => student.batch === academicClass.name);
              const visibleStudentsForSelectedClass = isActive ? visibleClassStudents : [];
              const isPromotionSelected = selectedPromotionClassIds.includes(academicClass._id);
              const isFinalYear = Number(academicClass.year || 1) >= 4;
              const capacityPct = Math.min(((academicClass.studentCount || 0) / (academicClass.capacity || 1)) * 100, 100);
              return (
                <div key={academicClass._id} className={`class-accordion-card${isActive ? ' active' : ''}`}>
                  <button type="button" className="class-accordion-trigger" onClick={() => handleToggleClass(academicClass._id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={isPromotionSelected}
                        disabled={isFinalYear}
                        onChange={(event) => { event.stopPropagation(); togglePromotionClassSelection(academicClass._id); }}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${academicClass.name} for promotion`}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1A1A2E' }}>{academicClass.name}</span>
                          <span style={{ fontSize: '0.72rem', color: '#5A5A7A', fontWeight: 600 }}>{academicClass.course || 'GENERAL'} · Year {academicClass.year || 1}</span>
                          {isFinalYear && <span className="badge badge-warning">Final Year</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                          <span style={{ fontSize: '0.78rem', color: '#5A5A7A' }}>
                            <strong style={{ color: getCapacityTone(academicClass.studentCount, academicClass.capacity) }}>{academicClass.studentCount}</strong> / {academicClass.capacity} students
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#5A5A7A' }}>
                            {academicClass.labBatches.length} lab {academicClass.labBatches.length === 1 ? 'batch' : 'batches'}
                          </span>
                        </div>
                        <div className="capacity-bar" style={{ maxWidth: 180, marginTop: 4 }}>
                          <div className="capacity-fill" style={{ width: `${capacityPct}%`, background: getCapacityTone(academicClass.studentCount, academicClass.capacity) }} />
                        </div>
                      </div>
                    </div>
                    <ChevronIcon expanded={isActive} />
                  </button>

                  {isActive && (
                    <div className="class-accordion-body">
                      {/* â”€â”€ Overview Stats â”€â”€ */}
                      <div className="accordion-section">
                        <div className="mini-stats-row">
                          <div className="mini-stat">
                            <div className="mini-stat-value">{Math.max((academicClass.capacity || 0) - (academicClass.studentCount || 0), 0)}</div>
                            <div className="mini-stat-label">Open Seats</div>
                          </div>
                          <div className="mini-stat">
                            <div className="mini-stat-value">{academicClass.labBatches.length}</div>
                            <div className="mini-stat-label">Lab Batches</div>
                          </div>
                          <div className="mini-stat">
                            <div className="mini-stat-value">{classStudents.filter((s) => s.labBatch).length}</div>
                            <div className="mini-stat-label">In Lab Batches</div>
                          </div>
                        </div>
                        {academicClass.description && <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>{academicClass.description}</p>}
                      </div>

                      {/* â”€â”€ Edit Class â”€â”€ */}
                      <div className="accordion-section">
                        <h4 className="accordion-section-title">Edit Class</h4>
                        <form onSubmit={handleUpdateClass}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="mit-label">Class Name</label>
                              <input value={classEditForm.name} onChange={(event) => setClassEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
                            </div>
                            <div className="form-group">
                              <label className="mit-label">Year</label>
                              <select value={classEditForm.year} onChange={(event) => setClassEditForm((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                                {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="mit-label">Course</label>
                              <input value={classEditForm.course} onChange={(event) => setClassEditForm((prev) => ({ ...prev, course: event.target.value.toUpperCase() }))} required />
                            </div>
                            <div className="form-group">
                              <label className="mit-label">Capacity</label>
                              <input type="number" min="1" value={classEditForm.capacity} onChange={(event) => setClassEditForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                            </div>
                          </div>
                          <div className="form-group" style={{ marginTop: 8 }}>
                            <label className="mit-label">Description</label>
                            <input value={classEditForm.description} onChange={(event) => setClassEditForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional note" />
                          </div>
                          <div className="form-actions form-actions-spread">
                            <button type="button" className="btn-danger-outline" onClick={handleDeleteClass} disabled={deletingSelectedClass || updatingClass}>
                              {deletingSelectedClass ? 'Deleting…' : 'Delete Class'}
                            </button>
                            <button type="submit" className="btn-purple" disabled={updatingClass || deletingSelectedClass}>
                              {updatingClass ? 'Saving…' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* â”€â”€ Student Roster â”€â”€ */}
                      <div className="accordion-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                          <h4 className="accordion-section-title" style={{ marginBottom: 0 }}>Student Roster ({classStudents.length})</h4>
                          <input value={classStudentSearch} onChange={(event) => setClassStudentSearch(event.target.value)} placeholder="Search students…" style={{ maxWidth: 260 }} />
                        </div>
                        {!classStudents.length && <p className="small" style={{ margin: 0, color: '#5A5A7A' }}>No students assigned to this class yet.</p>}
                        {classStudents.length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Enrollment No</th>
                                  <th>Lab Batch</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleStudentsForSelectedClass.map((student) => {
                                  const isRemoving = removingStudentId === student._id;
                                  const isClearingLab = clearingLabBatchStudentId === student._id;
                                  return (
                                    <tr key={student._id}>
                                      <td style={{ fontWeight: 600 }}>{student.name}</td>
                                      <td>{student.email}</td>
                                      <td>{student.enrollmentNo || <span style={{ color: '#5A5A7A' }}>—</span>}</td>
                                      <td>{student.labBatch || <span style={{ color: '#5A5A7A' }}>—</span>}</td>
                                      <td>
                                        <div className="inline-toolbar">
                                          <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => handleClearStudentLabBatch(student._id)} disabled={!student.labBatch || isRemoving || isClearingLab}>
                                            {isClearingLab ? '…' : 'Clear Lab'}
                                          </button>
                                          <button type="button" className="btn-danger-outline" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => handleRemoveStudentFromSelectedClass(student._id)} disabled={isRemoving || isClearingLab}>
                                            {isRemoving ? '…' : 'Remove'}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* â”€â”€ Assign Students â”€â”€ */}
                      <div className="accordion-section">
                        <h4 className="accordion-section-title">Assign Students to {academicClass.name}</h4>
                        <p className="small" style={{ margin: '0 0 10px' }}>Assigning moves students into this class and clears any previous lab batch.</p>
                        <div className="inline-toolbar" style={{ marginBottom: 8 }}>
                          <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search all students…" style={{ flex: 1, minWidth: 200 }} />
                          <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setClassStudentSelection(visibleStudents.map((s) => s._id))}>Select All</button>
                          <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setClassStudentSelection([])}>Clear</button>
                          <span className="badge badge-primary">{classStudentSelection.length} selected</span>
                        </div>
                        <div className="student-checklist">
                          {visibleStudents.map((student) => (
                            <label key={student._id} className="student-checklist-item">
                              <input type="checkbox" checked={classStudentSelection.includes(student._id)} onChange={() => toggleSelection(classStudentSelection, setClassStudentSelection, student._id)} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{student.name}</div>
                                <div className="small">{student.email} · {student.enrollmentNo || 'No enrollment'}</div>
                                <div className="small">Class: {student.batch || 'Unassigned'} · Lab: {student.labBatch || '—'}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <div className="form-actions">
                          <button type="button" className="btn-purple" onClick={handleAssignStudentsToClass} disabled={assigningStudents || classStudentSelection.length === 0}>
                            {assigningStudents ? 'Assigning…' : `Assign to ${academicClass.name}`}
                          </button>
                        </div>

                        {/* Bulk CSV Student Assign */}
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(106,13,173,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                            <div>
                              <h5 className="accordion-section-title" style={{ marginBottom: 2 }}>Bulk CSV Student Import</h5>
                              <p className="small" style={{ margin: 0 }}>Columns: enrollmentNo, labBatch</p>
                            </div>
                            <div className="inline-toolbar">
                              <button type="button" className="btn-outline" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={downloadStudentAssignmentSampleCSV}>Sample CSV</button>
                              <button type="button" className="btn-outline" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={exportCurrentClassRosterCSV}>Export Roster</button>
                              <button type="button" className="btn-purple" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={() => bulkStudentUploadInputRef.current?.click()} disabled={bulkStudentAssigning}>
                                {bulkStudentAssigning ? 'Working…' : 'Upload CSV'}
                              </button>
                            </div>
                          </div>

                          {bulkStudentPreviewRows.length > 0 && (
                            <div className="preview-panel">
                              <div className="preview-panel-header">
                                <div>
                                  <strong style={{ fontSize: '0.85rem' }}>Preview {bulkStudentPreviewFileName ? `— ${bulkStudentPreviewFileName}` : ''}</strong>
                                  <div className="small">Ready: {bulkStudentPreviewRows.filter((r) => !r.previewError).length} · Issues: {bulkStudentPreviewRows.filter((r) => r.previewError).length}</div>
                                </div>
                                <div className="inline-toolbar">
                                  <button type="button" className="btn-outline" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={clearBulkStudentPreview} disabled={bulkStudentAssigning}>Clear</button>
                                  <button type="button" className="btn-purple" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={handleConfirmBulkStudentUpload} disabled={bulkStudentAssigning || bulkStudentPreviewRows.some((r) => r.previewError)}>
                                    {bulkStudentAssigning ? 'Importing…' : 'Confirm Import'}
                                  </button>
                                </div>
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table className="admin-table">
                                  <thead><tr><th>Row</th><th>Enrollment</th><th>Name</th><th>Current Class</th><th>Current Lab</th><th>New Lab</th><th>Status</th></tr></thead>
                                  <tbody>
                                    {bulkStudentPreviewRows.map((row) => (
                                      <tr key={`${row.rowNumber}-${row.enrollmentNo}`}>
                                        <td>{row.rowNumber}</td>
                                        <td>{row.enrollmentNo}</td>
                                        <td>{row.studentName || <span style={{ color: '#5A5A7A' }}>Unknown</span>}</td>
                                        <td>{row.currentClass || 'Unassigned'}</td>
                                        <td>{row.currentLabBatch || '—'}</td>
                                        <td>{row.labBatch || '—'}</td>
                                        <td style={{ color: row.previewError ? '#b45309' : '#15803d', fontWeight: 600, fontSize: '0.78rem' }}>{row.previewError || 'Ready'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {bulkStudentPreviewRows.some((r) => r.previewError) && (
                                <div className="small" style={{ color: '#b45309', marginTop: 8 }}>Fix the flagged rows and re-upload before confirming.</div>
                              )}
                            </div>
                          )}

                          {bulkStudentResult?.error && <div className="alert alert-danger" style={{ marginTop: 8 }}>{bulkStudentResult.error}</div>}
                          {bulkStudentResult && !bulkStudentResult.error && (
                            <div style={{ marginTop: 8 }}>
                              <div className={`alert ${bulkStudentResult.failedCount > 0 ? 'alert-warning' : 'alert-success'}`}>
                                Assigned {bulkStudentResult.assignedCount} student(s). Failed {bulkStudentResult.failedCount}.
                              </div>
                              {bulkStudentResult.errors?.length > 0 && (
                                <div className="preview-panel" style={{ marginTop: 6 }}>
                                  <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem' }}>Issues</strong>
                                  {bulkStudentResult.errors.map((rowError, index) => (
                                    <div key={`${rowError.row}-${rowError.enrollmentNo || 'student'}-${index}`} className="small">
                                      Row {rowError.row}{rowError.enrollmentNo ? ` (${rowError.enrollmentNo})` : ''}: {rowError.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* â”€â”€ Lab Batch Operations â”€â”€ */}
                      <div className="accordion-section">
                        <h4 className="accordion-section-title">Lab Batches</h4>

                        {/* Create Lab Batch */}
                        <form onSubmit={handleCreateLabBatch} style={{ marginBottom: 16 }}>
                          <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <div className="form-group">
                              <label className="mit-label">Batch Name</label>
                              <input value={labBatchForm.name} onChange={(event) => setLabBatchForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g., Batch A" required />
                            </div>
                            <div className="form-group">
                              <label className="mit-label">Capacity</label>
                              <input type="number" min="1" value={labBatchForm.capacity} onChange={(event) => setLabBatchForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                            </div>
                          </div>
                          <div className="form-actions">
                            <button type="submit" className="btn-purple" style={{ padding: '6px 14px', fontSize: '0.78rem' }} disabled={creatingLabBatch}>{creatingLabBatch ? 'Creating…' : 'Create Lab Batch'}</button>
                          </div>
                        </form>

                        {/* Edit Existing Lab Batches */}
                        {!academicClass.labBatches.length && <p className="small" style={{ margin: 0 }}>No lab batches yet.</p>}
                        {academicClass.labBatches.length > 0 && (
                          <>
                            <div className="role-tabs" style={{ marginBottom: 12 }}>
                              {academicClass.labBatches.map((labBatch) => (
                                <button key={labBatch._id} type="button" className={`role-tab${selectedLabBatch?._id === labBatch._id ? ' active' : ''}`} onClick={() => setSelectedLabBatchId(labBatch._id)}>
                                  {labBatch.name} ({labBatch.studentCount}/{labBatch.capacity})
                                </button>
                              ))}
                            </div>

                            {selectedLabBatch && (
                              <form onSubmit={handleUpdateSelectedLabBatch} style={{ marginBottom: 16 }}>
                                <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                  <div className="form-group">
                                    <label className="mit-label">Batch Name</label>
                                    <input value={labBatchEditForm.name} onChange={(event) => setLabBatchEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
                                  </div>
                                  <div className="form-group">
                                    <label className="mit-label">Capacity</label>
                                    <input type="number" min="1" value={labBatchEditForm.capacity} onChange={(event) => setLabBatchEditForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                                  </div>
                                </div>
                                <div className="form-actions form-actions-spread">
                                  <button type="button" className="btn-danger-outline" style={{ padding: '5px 12px', fontSize: '0.72rem' }} onClick={handleDeleteSelectedLabBatch} disabled={deletingSelectedLabBatch || updatingSelectedLabBatch}>
                                    {deletingSelectedLabBatch ? 'Deleting…' : 'Delete Batch'}
                                  </button>
                                  <button type="submit" className="btn-purple" style={{ padding: '5px 12px', fontSize: '0.72rem' }} disabled={updatingSelectedLabBatch || deletingSelectedLabBatch}>
                                    {updatingSelectedLabBatch ? 'Saving…' : 'Save Changes'}
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Assign Students to Lab Batch */}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(106,13,173,0.06)' }}>
                              <h5 className="accordion-section-title" style={{ marginBottom: 8 }}>Assign to Lab Batch</h5>
                              <p className="small" style={{ margin: '0 0 8px' }}>Students must already belong to {academicClass.name}.</p>
                              <div className="inline-toolbar" style={{ marginBottom: 8 }}>
                                <select value={labBatchAssignmentName} onChange={(event) => setLabBatchAssignmentName(event.target.value)} style={{ maxWidth: 220 }}>
                                  <option value="">Remove from lab batch</option>
                                  {academicClass.labBatches.map((labBatch) => (
                                    <option key={labBatch._id} value={labBatch.name}>{labBatch.name} ({labBatch.studentCount}/{labBatch.capacity})</option>
                                  ))}
                                </select>
                                <button type="button" className="btn-outline" style={{ padding: '5px 10px', fontSize: '0.72rem' }} onClick={() => setLabStudentSelection(visibleStudentsForSelectedClass.map((s) => s._id))}>Select All</button>
                                <button type="button" className="btn-outline" style={{ padding: '5px 10px', fontSize: '0.72rem' }} onClick={() => setLabStudentSelection([])}>Clear</button>
                                <span className="badge badge-primary">{labStudentSelection.length}</span>
                              </div>
                              <div className="student-checklist">
                                {visibleStudentsForSelectedClass.map((student) => (
                                  <label key={student._id} className="student-checklist-item">
                                    <input type="checkbox" checked={labStudentSelection.includes(student._id)} onChange={() => toggleSelection(labStudentSelection, setLabStudentSelection, student._id)} />
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{student.name}</div>
                                      <div className="small">{student.enrollmentNo || '—'} · Lab: {student.labBatch || 'None'}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                              <div className="form-actions">
                                <button type="button" className="btn-purple" onClick={() => handleAssignLabBatch(labBatchAssignmentName)} disabled={assigningLabBatch || labStudentSelection.length === 0}>
                                  {assigningLabBatch ? 'Saving…' : (labBatchAssignmentName ? `Assign to ${labBatchAssignmentName}` : 'Remove from Lab Batch')}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Create Class Modal â”€â”€ */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Theory Class</h2>
              <button type="button" className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-rainbow" />
            <div className="modal-body">
              <form onSubmit={handleCreateClass}>
                <div className="form-group">
                  <label className="mit-label">Class Name</label>
                  <input value={classForm.name} onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g., TY-AIA-9" required />
                </div>
                <div className="form-row" style={{ marginTop: 8 }}>
                  <div className="form-group">
                    <label className="mit-label">Year</label>
                    <select value={classForm.year} onChange={(event) => setClassForm((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                      {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="mit-label">Course</label>
                    <input value={classForm.course} onChange={(event) => setClassForm((prev) => ({ ...prev, course: event.target.value.toUpperCase() }))} placeholder="e.g., CSE" required />
                  </div>
                  <div className="form-group">
                    <label className="mit-label">Capacity</label>
                    <input type="number" min="1" value={classForm.capacity} onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="mit-label">Description</label>
                  <input value={classForm.description} onChange={(event) => setClassForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional note about the class" />
                </div>
                <div className="form-actions" style={{ marginTop: 20 }}>
                  <button type="button" className="btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn-cta" disabled={savingClass}>{savingClass ? 'Creating…' : 'Create Class'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
