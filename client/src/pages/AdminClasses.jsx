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
    <div className="container">
      <div className="nav">
        <h2>Manage Classes</h2>
        <div className="small">Theory classes and lab batches</div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create Theory Class</h3>
        <form onSubmit={handleCreateClass}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Class Name</label>
              <input value={classForm.name} onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g., TY-AIA-9" required />
            </div>
            <div className="form-group">
              <label>Year</label>
              <select value={classForm.year} onChange={(event) => setClassForm((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Course</label>
              <input value={classForm.course} onChange={(event) => setClassForm((prev) => ({ ...prev, course: event.target.value.toUpperCase() }))} placeholder="e.g., GENERAL or CSE" required />
            </div>
            <div className="form-group">
              <label>Student Capacity</label>
              <input type="number" min="1" value={classForm.capacity} onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input value={classForm.description} onChange={(event) => setClassForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional note about the class" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" disabled={savingClass}>{savingClass ? 'Creating...' : 'Create Class'}</button>
          </div>
        </form>

        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e5e7eb', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0 }}>Bulk Upload Classes (CSV)</h4>
              <div className="small">Columns: name, year, course, capacity, description. Student enrollment is not part of this file.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={bulkUploadInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(event) => handleBulkFileUpload(event.target.files?.[0])}
              />
              <button type="button" className="button-secondary" onClick={downloadSampleCSV}>Download Sample CSV</button>
              <button type="button" onClick={() => bulkUploadInputRef.current?.click()} disabled={bulkUploading}>
                {bulkUploading ? 'Uploading...' : 'Upload CSV'}
              </button>
            </div>
          </div>

          {bulkResult?.error && (
            <div className="alert alert-error">{bulkResult.error}</div>
          )}

          {bulkResult && !bulkResult.error && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className={`alert ${bulkResult.failedCount > 0 ? 'alert-warning' : 'alert-success'}`}>
                Created {bulkResult.createdCount} class(es). Failed {bulkResult.failedCount}.
              </div>
              {bulkResult.errors?.length > 0 && (
                <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 12, padding: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 8 }}>Import Issues</strong>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {bulkResult.errors.map((rowError, index) => (
                      <div key={`${rowError.row}-${rowError.name || 'class'}-${index}`} className="small">
                        Row {rowError.row}{rowError.name ? ` (${rowError.name})` : ''}: {rowError.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading && <LoadingSpinner />}
        {!loading && classes.length === 0 && <p className="text-muted text-center">No classes created yet.</p>}
        {!loading && classes.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0 }}>Class List</h3>
                <div className="small">Click a class to open its students, details, and operations.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="small">Selected for promotion: <strong>{selectedPromotionClassIds.length}</strong></div>
                <button type="button" className="button-secondary" onClick={() => setSelectedPromotionClassIds(classes.filter((academicClass) => Number(academicClass.year || 1) < 4).map((academicClass) => academicClass._id))}>Select Promotable</button>
                <button type="button" className="button-secondary" onClick={() => setSelectedPromotionClassIds([])}>Clear Selection</button>
                <button type="button" onClick={handlePromoteSelectedClasses} disabled={promotingClasses || selectedPromotionClassIds.length === 0}>{promotingClasses ? 'Promoting...' : 'Promote Selected Classes'}</button>
                <div className="small">Total classes: <strong>{classes.length}</strong></div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
            {classes.map((academicClass) => {
              const isActive = selectedClass?._id === academicClass._id;
              const classStudents = students.filter((student) => student.batch === academicClass.name);
              const visibleStudentsForSelectedClass = isActive ? visibleClassStudents : [];
              const isPromotionSelected = selectedPromotionClassIds.includes(academicClass._id);
              const isFinalYear = Number(academicClass.year || 1) >= 4;
              return (
                <div
                  key={academicClass._id}
                  style={{
                    border: `1px solid ${isActive ? '#93c5fd' : '#e5e7eb'}`,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <button
                    type="button"
                    className={isActive ? '' : 'button-secondary'}
                    onClick={() => handleToggleClass(academicClass._id)}
                    style={{ textAlign: 'left', padding: 16, borderRadius: 0, width: '100%' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={isPromotionSelected}
                          disabled={isFinalYear}
                          onChange={(event) => {
                            event.stopPropagation();
                            togglePromotionClassSelection(academicClass._id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${academicClass.name} for promotion`}
                        />
                        <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>{academicClass.name}</strong>
                        <div className="small">Course: {academicClass.course || 'GENERAL'} | Year: {academicClass.year || 1}</div>
                        <div className="small" style={{ color: getCapacityTone(academicClass.studentCount, academicClass.capacity) }}>
                          Students: {academicClass.studentCount} / {academicClass.capacity}
                        </div>
                        <div className="small">Lab Batches: {academicClass.labBatches.length ? academicClass.labBatches.map((labBatch) => `${labBatch.name} (${labBatch.studentCount}/${labBatch.capacity})`).join(', ') : 'None created yet'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isFinalYear && <span className="badge badge-warning">Final Year</span>}
                        {isActive && <span className="badge badge-info">Selected</span>}
                        <ChevronIcon expanded={isActive} />
                      </div>
                    </div>
                  </button>

                  {isActive && (
                    <div style={{ padding: 20, borderTop: '1px solid #e5e7eb', display: 'grid', gap: 24 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div>
                            <h3 style={{ marginTop: 0, marginBottom: 6 }}>{academicClass.name}</h3>
                            <div className="small">Course: {academicClass.course || 'GENERAL'} | Year: {academicClass.year || 1}</div>
                            <div className="small">{academicClass.description || 'No class description added yet.'}</div>
                          </div>
                          <div className="small" style={{ color: classUtilizationColor }}>
                            Utilization: <strong>{academicClass.studentCount} / {academicClass.capacity}</strong>
                          </div>
                        </div>

                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
                          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                            <div className="small">Open Seats</div>
                            <strong>{Math.max((academicClass.capacity || 0) - (academicClass.studentCount || 0), 0)}</strong>
                          </div>
                          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                            <div className="small">Lab Batches</div>
                            <strong>{academicClass.labBatches.length}</strong>
                          </div>
                          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                            <div className="small">Students In Lab Batches</div>
                            <strong>{classStudents.filter((student) => student.labBatch).length}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 16 }}>
                        <h4 style={{ margin: 0 }}>Edit Theory Class</h4>
                        <p className="text-muted" style={{ margin: 0 }}>Renaming a class also updates teacher assignments and student class membership.</p>
                        <form onSubmit={handleUpdateClass}>
                          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                            <div className="form-group">
                              <label>Class Name</label>
                              <input value={classEditForm.name} onChange={(event) => setClassEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
                            </div>
                            <div className="form-group">
                              <label>Year</label>
                              <select value={classEditForm.year} onChange={(event) => setClassEditForm((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                                {YEAR_OPTIONS.map((year) => <option key={year} value={year}>Year {year}</option>)}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Course</label>
                              <input value={classEditForm.course} onChange={(event) => setClassEditForm((prev) => ({ ...prev, course: event.target.value.toUpperCase() }))} required />
                            </div>
                            <div className="form-group">
                              <label>Student Capacity</label>
                              <input type="number" min="1" value={classEditForm.capacity} onChange={(event) => setClassEditForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                              <label>Description</label>
                              <input value={classEditForm.description} onChange={(event) => setClassEditForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional note about the class" />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                            <button type="button" className="button-secondary" onClick={handleDeleteClass} disabled={deletingSelectedClass || updatingClass}>
                              {deletingSelectedClass ? 'Deleting...' : 'Delete Class'}
                            </button>
                            <button type="submit" disabled={updatingClass || deletingSelectedClass}>
                              {updatingClass ? 'Saving...' : 'Save Class Changes'}
                            </button>
                          </div>
                        </form>
                      </div>

                      <div style={{ display: 'grid', gap: 16 }}>
                        <h4 style={{ margin: 0 }}>Student List</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div className="small">Students currently assigned to this class: <strong>{classStudents.length}</strong></div>
                          <input value={classStudentSearch} onChange={(event) => setClassStudentSearch(event.target.value)} placeholder="Search students in this class" style={{ minWidth: 260 }} />
                        </div>

                        {!classStudents.length && <p className="text-muted" style={{ margin: 0 }}>No students are assigned to this class yet.</p>}
                        {classStudents.length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <table>
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
                                      <td>{student.name}</td>
                                      <td>{student.email}</td>
                                      <td>{student.enrollmentNo || 'Not set'}</td>
                                      <td>{student.labBatch || 'Not assigned'}</td>
                                      <td>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            className="button-secondary"
                                            onClick={() => handleClearStudentLabBatch(student._id)}
                                            disabled={!student.labBatch || isRemoving || isClearingLab}
                                          >
                                            {isClearingLab ? 'Clearing...' : 'Clear Lab'}
                                          </button>
                                          <button
                                            type="button"
                                            className="button-secondary"
                                            onClick={() => handleRemoveStudentFromSelectedClass(student._id)}
                                            disabled={isRemoving || isClearingLab}
                                          >
                                            {isRemoving ? 'Removing...' : 'Remove From Class'}
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

                      <div style={{ display: 'grid', gap: 16 }}>
                        <h4 style={{ margin: 0 }}>Assign Students To {academicClass.name}</h4>
                        <p className="text-muted" style={{ margin: 0 }}>A student belongs to only one theory class. Assigning them here moves them into this class and clears any previous lab batch.</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search all students by name, email, or enrollment number" />
                          <button type="button" className="button-secondary" onClick={() => setClassStudentSelection(visibleStudents.map((student) => student._id))}>Select Visible</button>
                          <button type="button" className="button-secondary" onClick={() => setClassStudentSelection([])}>Clear Selection</button>
                          <div className="small">Selected: <strong>{classStudentSelection.length}</strong></div>
                        </div>
                        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                          {visibleStudents.map((student) => (
                            <label key={student._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <input type="checkbox" checked={classStudentSelection.includes(student._id)} onChange={() => toggleSelection(classStudentSelection, setClassStudentSelection, student._id)} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{student.name}</div>
                                <div className="small">{student.email} | {student.enrollmentNo || 'No enrollment number'}</div>
                                <div className="small">Current Class: {student.batch || 'Unassigned'} | Lab Batch: {student.labBatch || 'Not assigned'}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={handleAssignStudentsToClass} disabled={assigningStudents || classStudentSelection.length === 0}>
                            {assigningStudents ? 'Assigning...' : `Assign Selected Students To ${academicClass.name}`}
                          </button>
                        </div>

                        <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #e5e7eb', display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <h5 style={{ margin: 0 }}>Bulk Assign Students via CSV</h5>
                              <div className="small">Columns: enrollmentNo, labBatch. Leave labBatch blank to assign the student without a lab group. Upload first, review the preview, then confirm import.</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <input
                                ref={bulkStudentUploadInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                style={{ display: 'none' }}
                                onChange={(event) => handleBulkStudentUpload(event.target.files?.[0])}
                              />
                              <button type="button" className="button-secondary" onClick={downloadStudentAssignmentSampleCSV}>
                                Download Sample CSV
                              </button>
                              <button type="button" className="button-secondary" onClick={exportCurrentClassRosterCSV}>
                                Export Current Roster
                              </button>
                              <button type="button" onClick={() => bulkStudentUploadInputRef.current?.click()} disabled={bulkStudentAssigning}>
                                {bulkStudentAssigning ? 'Working...' : 'Upload Student CSV'}
                              </button>
                            </div>
                          </div>

                          {bulkStudentPreviewRows.length > 0 && (
                            <div style={{ display: 'grid', gap: 12, border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: 12, padding: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                  <strong style={{ display: 'block' }}>Preview {bulkStudentPreviewFileName ? `(${bulkStudentPreviewFileName})` : ''}</strong>
                                  <div className="small">
                                    Ready rows: {bulkStudentPreviewRows.filter((row) => !row.previewError).length} | Issues: {bulkStudentPreviewRows.filter((row) => row.previewError).length}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button type="button" className="button-secondary" onClick={clearBulkStudentPreview} disabled={bulkStudentAssigning}>
                                    Clear Preview
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleConfirmBulkStudentUpload}
                                    disabled={bulkStudentAssigning || bulkStudentPreviewRows.some((row) => row.previewError)}
                                  >
                                    {bulkStudentAssigning ? 'Importing...' : `Confirm Import Into ${academicClass.name}`}
                                  </button>
                                </div>
                              </div>

                              <div style={{ overflowX: 'auto' }}>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Row</th>
                                      <th>Enrollment No</th>
                                      <th>Name</th>
                                      <th>Current Class</th>
                                      <th>Current Lab</th>
                                      <th>New Lab</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bulkStudentPreviewRows.map((row) => (
                                      <tr key={`${row.rowNumber}-${row.enrollmentNo}`}>
                                        <td>{row.rowNumber}</td>
                                        <td>{row.enrollmentNo}</td>
                                        <td>{row.studentName || 'Unknown student'}</td>
                                        <td>{row.currentClass || 'Unassigned'}</td>
                                        <td>{row.currentLabBatch || 'None'}</td>
                                        <td>{row.labBatch || 'No lab batch'}</td>
                                        <td style={{ color: row.previewError ? '#b45309' : '#15803d', fontWeight: 600 }}>
                                          {row.previewError || 'Ready'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {bulkStudentPreviewRows.some((row) => row.previewError) && (
                                <div className="small" style={{ color: '#b45309' }}>
                                  Fix the rows marked above and upload again before confirming the import.
                                </div>
                              )}
                            </div>
                          )}

                          {bulkStudentResult?.error && (
                            <div className="alert alert-error">{bulkStudentResult.error}</div>
                          )}

                          {bulkStudentResult && !bulkStudentResult.error && (
                            <div style={{ display: 'grid', gap: 12 }}>
                              <div className={`alert ${bulkStudentResult.failedCount > 0 ? 'alert-warning' : 'alert-success'}`}>
                                Assigned {bulkStudentResult.assignedCount} student(s). Failed {bulkStudentResult.failedCount}.
                              </div>
                              {bulkStudentResult.errors?.length > 0 && (
                                <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 12, padding: 12 }}>
                                  <strong style={{ display: 'block', marginBottom: 8 }}>Assignment Issues</strong>
                                  <div style={{ display: 'grid', gap: 6 }}>
                                    {bulkStudentResult.errors.map((rowError, index) => (
                                      <div key={`${rowError.row}-${rowError.enrollmentNo || 'student'}-${index}`} className="small">
                                        Row {rowError.row}{rowError.enrollmentNo ? ` (${rowError.enrollmentNo})` : ''}: {rowError.message}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 16 }}>
                        <h4 style={{ margin: 0 }}>Lab Batch Operations</h4>

                        <div style={{ display: 'grid', gap: 12 }}>
                          <h5 style={{ margin: 0 }}>Create Lab Batch</h5>
                          <form onSubmit={handleCreateLabBatch}>
                            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                              <div className="form-group">
                                <label>Lab Batch Name</label>
                                <input value={labBatchForm.name} onChange={(event) => setLabBatchForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g., Batch A" required />
                              </div>
                              <div className="form-group">
                                <label>Batch Capacity</label>
                                <input type="number" min="1" value={labBatchForm.capacity} onChange={(event) => setLabBatchForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                              <button type="submit" disabled={creatingLabBatch}>{creatingLabBatch ? 'Creating...' : 'Create Lab Batch'}</button>
                            </div>
                          </form>
                        </div>

                        <div style={{ display: 'grid', gap: 12 }}>
                          <h5 style={{ margin: 0 }}>Edit Existing Lab Batches</h5>
                          {!academicClass.labBatches.length && <p className="text-muted" style={{ margin: 0 }}>Create a lab batch to edit or delete it.</p>}
                          {academicClass.labBatches.length > 0 && (
                            <>
                              <div style={{ display: 'grid', gap: 12 }}>
                                {academicClass.labBatches.map((labBatch) => {
                                  const isSelectedLabBatch = selectedLabBatch?._id === labBatch._id;
                                  return (
                                    <button
                                      key={labBatch._id}
                                      type="button"
                                      className={isSelectedLabBatch ? '' : 'button-secondary'}
                                      onClick={() => setSelectedLabBatchId(labBatch._id)}
                                      style={{ textAlign: 'left', padding: 12, borderRadius: 10 }}
                                    >
                                      <strong style={{ display: 'block' }}>{labBatch.name}</strong>
                                      <div className="small">Students: {labBatch.studentCount} / {labBatch.capacity}</div>
                                    </button>
                                  );
                                })}
                              </div>

                              {selectedLabBatch && (
                                <form onSubmit={handleUpdateSelectedLabBatch}>
                                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                    <div className="form-group">
                                      <label>Lab Batch Name</label>
                                      <input value={labBatchEditForm.name} onChange={(event) => setLabBatchEditForm((prev) => ({ ...prev, name: event.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                      <label>Batch Capacity</label>
                                      <input type="number" min="1" value={labBatchEditForm.capacity} onChange={(event) => setLabBatchEditForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))} required />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                                    <button type="button" className="button-secondary" onClick={handleDeleteSelectedLabBatch} disabled={deletingSelectedLabBatch || updatingSelectedLabBatch}>
                                      {deletingSelectedLabBatch ? 'Deleting...' : 'Delete Lab Batch'}
                                    </button>
                                    <button type="submit" disabled={updatingSelectedLabBatch || deletingSelectedLabBatch}>
                                      {updatingSelectedLabBatch ? 'Saving...' : 'Save Lab Batch Changes'}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </>
                          )}
                        </div>

                        <div style={{ display: 'grid', gap: 12 }}>
                          <h5 style={{ margin: 0 }}>Assign Students To Lab Batches</h5>
                          <p className="text-muted" style={{ margin: 0 }}>Students must already belong to {academicClass.name}. Choosing a different lab batch moves the selected students there. Leave the lab batch blank to remove them from lab groups.</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={labBatchAssignmentName} onChange={(event) => setLabBatchAssignmentName(event.target.value)}>
                              <option value="">Remove from lab batch</option>
                              {academicClass.labBatches.map((labBatch) => (
                                <option key={labBatch._id} value={labBatch.name}>{labBatch.name} ({labBatch.studentCount}/{labBatch.capacity})</option>
                              ))}
                            </select>
                            <button type="button" className="button-secondary" onClick={() => setLabStudentSelection(visibleStudentsForSelectedClass.map((student) => student._id))}>Select Visible</button>
                            <button type="button" className="button-secondary" onClick={() => setLabStudentSelection([])}>Clear Selection</button>
                            <div className="small">Selected: <strong>{labStudentSelection.length}</strong></div>
                          </div>
                          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                            {visibleStudentsForSelectedClass.map((student) => (
                              <label key={student._id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                <input type="checkbox" checked={labStudentSelection.includes(student._id)} onChange={() => toggleSelection(labStudentSelection, setLabStudentSelection, student._id)} />
                                <div>
                                  <div style={{ fontWeight: 600 }}>{student.name}</div>
                                  <div className="small">{student.email} | {student.enrollmentNo || 'No enrollment number'}</div>
                                  <div className="small">Current Lab Batch: {student.labBatch || 'Not assigned'}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => handleAssignLabBatch(labBatchAssignmentName)} disabled={assigningLabBatch || labStudentSelection.length === 0}>
                              {assigningLabBatch ? 'Saving...' : (labBatchAssignmentName ? `Assign Selected To ${labBatchAssignmentName}` : 'Remove Selected From Lab Batch')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}