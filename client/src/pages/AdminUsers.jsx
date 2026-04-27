import React, { useEffect, useRef, useState } from 'react';
import { bulkCreateUsers, createUserAccount, deleteUser, fetchUsers, sendUserPasswordLink, updateRole, updateUserDetails, toggleStatus } from '../services/userService';
import { fetchClasses } from '../services/classService';
import { fetchSubjects } from '../services/subjectService';
import LoadingSpinner from '../components/LoadingSpinner';
import { downloadCsv } from '../utils/csvExport';
import { showToast } from '../utils/appEvents';

const MAX_BULK_USERS = 500;
const CREATE_ROLE_OPTIONS = [
  {
    value: 'student',
    title: 'Create Account - Student',
    description: 'Create a student account first. Class assignment can be done later.',
  },
  {
    value: 'teacher',
    title: 'Create Account - Teacher',
    description: 'Create a teacher account with subjects and assigned classes or lab batches.',
  },
  {
    value: 'admin',
    title: 'Create Account - Admin',
    description: 'Create a platform administrator account with full access.',
  },
];

const BULK_ROLE_OPTIONS = [
  {
    value: 'student',
    title: 'Bulk Upload - Student',
    description: 'Upload a file of student accounts. Class assignment can be done later.',
  },
  {
    value: 'teacher',
    title: 'Bulk Upload - Teacher',
    description: 'Upload a file of teacher accounts with subjects and assigned classes or lab batches.',
  },
  {
    value: 'admin',
    title: 'Bulk Upload - Admin',
    description: 'Upload a file of administrator accounts with platform access.',
  },
];

const USER_LIST_TABS = [
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
];

const parseSubjectsInput = (value, allowedSubjects = []) => Array.from(new Set(String(value || '')
  .split(',')
  .map((subject) => subject.trim())
  .filter((subject) => !allowedSubjects.length || allowedSubjects.includes(subject))));

const normalizeSubjects = (subjects, allowedSubjects = []) => Array.from(new Set(
  (Array.isArray(subjects) ? subjects : parseSubjectsInput(subjects, allowedSubjects))
    .map((subject) => String(subject || '').trim())
    .filter((subject) => !allowedSubjects.length || allowedSubjects.includes(subject))
));

const formatSubjectsInput = (subjects) => Array.isArray(subjects) ? subjects.join(', ') : '';
const parseBatchListInput = (value) => Array.from(new Set(String(value || '')
  .split(',')
  .map((batch) => batch.trim())
  .filter(Boolean)));

const normalizeClassList = (classes) => Array.from(new Set(
  (Array.isArray(classes) ? classes : parseBatchListInput(classes))
    .map((className) => String(className || '').trim())
    .filter(Boolean)
));

const parseLabBatchAssignmentToken = (value) => {
  if (typeof value === 'string') {
    const [className, labBatchName] = value.split('::').map((item) => String(item || '').trim());
    if (!className || !labBatchName) {
      return null;
    }

    return { className, labBatchName };
  }

  const className = String(value?.className || value?.class || '').trim();
  const labBatchName = String(value?.labBatchName || value?.labBatch || '').trim();
  if (!className || !labBatchName) {
    return null;
  }

  return { className, labBatchName };
};

const buildLabBatchAssignmentKey = (assignment) => `${assignment.className}::${assignment.labBatchName}`;
const buildLabBatchAssignmentLabel = (assignment) => `${assignment.className} / ${assignment.labBatchName}`;

const normalizeLabBatchAssignments = (assignments) => Array.from(new Map(
  (Array.isArray(assignments) ? assignments : [])
    .map((assignment) => parseLabBatchAssignmentToken(assignment))
    .filter(Boolean)
    .map((assignment) => [buildLabBatchAssignmentKey(assignment), assignment])
).values());

const hasLabBatchAssignment = (assignments, candidate) => normalizeLabBatchAssignments(assignments)
  .some((assignment) => buildLabBatchAssignmentKey(assignment) === buildLabBatchAssignmentKey(candidate));

const formatBatchListInput = (batches) => Array.isArray(batches) ? batches.join(', ') : '';
const getRoleOption = (role) => CREATE_ROLE_OPTIONS.find((option) => option.value === role) || CREATE_ROLE_OPTIONS[0];
const getBulkRoleOption = (role) => BULK_ROLE_OPTIONS.find((option) => option.value === role) || BULK_ROLE_OPTIONS[0];
const getIdentifierConfig = (role) => {
  if (role === 'teacher') {
    return {
      key: 'employeeId',
      label: 'Employee ID',
      placeholder: 'e.g., TCH-102',
    };
  }

  if (role === 'admin') {
    return {
      key: 'adminId',
      label: 'Admin ID',
      placeholder: 'e.g., ADM-001',
    };
  }

  return {
    key: 'enrollmentNo',
    label: 'Enrollment Number',
    placeholder: 'Optional auto-generated',
  };
};

export default function AdminUsers(){
  const emptyBulkSelection = {
    fileName: '',
    users: [],
    totalRows: 0,
    overLimit: false,
    parseError: '',
  };
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    enrollmentNo: '',
    adminId: '',
    password: '',
    role: 'student',
    batch: '',
    employeeId: '',
    department: '',
    subjects: [],
    subjectToAdd: '',
    assignedClasses: [],
    assignedLabBatches: [],
    classToAdd: '',
    labBatchToAdd: '',
    sendInvite: false,
  });
  const [users, setUsers] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [classCatalog, setClassCatalog] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [sendingLinkId, setSendingLinkId] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [error, setError] = useState(null);
  const [bulkForm, setBulkForm] = useState({
    role: 'student',
    temporaryPassword: '',
    sendInvite: true,
  });
  const [bulkSelection, setBulkSelection] = useState(emptyBulkSelection);
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [userListRole, setUserListRole] = useState('student');
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const bulkFileInputRef = useRef(null);

  const load = async () => {
    setError(null);
    try{
      const [userResponse, classResponse, subjectResponse] = await Promise.all([fetchUsers(), fetchClasses(), fetchSubjects({ includeInactive: false })]);
      setUsers(userResponse.users || []);
      setClassCatalog(classResponse.classes || []);
      setClassOptions((classResponse.classes || []).map((academicClass) => academicClass.name));
      setSubjectOptions((subjectResponse.subjectOptions || []).map((subject) => subject.code || subject));
    }catch(err){
      setError(err?.response?.data?.message || err.message);
    }finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenActionMenuId(null);
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const activeCreateRole = getRoleOption(form.role);
  const activeBulkRole = getBulkRoleOption(bulkForm.role);
  const createIdentifierConfig = getIdentifierConfig(form.role);
  const defaultSubjectOption = subjectOptions[0] || '';
  const availableCreateSubjects = subjectOptions.filter((subject) => !form.subjects.includes(subject));
  const availableCreateClasses = classOptions.filter((className) => !form.assignedClasses.includes(className));
  const labBatchOptions = classCatalog.flatMap((academicClass) => (academicClass.labBatches || []).map((labBatch) => ({
    className: academicClass.name,
    labBatchName: labBatch.name,
  })));
  const availableCreateLabBatches = labBatchOptions.filter((assignment) => !hasLabBatchAssignment(form.assignedLabBatches, assignment));
  const visibleUsers = users.filter((user) => user.role === userListRole);

  useEffect(() => {
    setForm((current) => {
      if (current.role !== 'teacher') {
        return current;
      }

      const nextClassToAdd = availableCreateClasses.includes(current.classToAdd)
        ? current.classToAdd
        : (availableCreateClasses[0] || '');

      return nextClassToAdd === current.classToAdd ? current : { ...current, classToAdd: nextClassToAdd };
    });
  }, [availableCreateClasses]);

  useEffect(() => {
    setForm((current) => {
      if (current.role !== 'teacher') {
        return current;
      }

      const nextLabBatchToAdd = availableCreateLabBatches.some((assignment) => buildLabBatchAssignmentKey(assignment) === current.labBatchToAdd)
        ? current.labBatchToAdd
        : (availableCreateLabBatches[0] ? buildLabBatchAssignmentKey(availableCreateLabBatches[0]) : '');

      return nextLabBatchToAdd === current.labBatchToAdd ? current : { ...current, labBatchToAdd: nextLabBatchToAdd };
    });
  }, [availableCreateLabBatches]);

  useEffect(() => {
    setForm((current) => {
      if (current.role !== 'teacher') {
        return current;
      }

      const nextSubjectToAdd = availableCreateSubjects.includes(current.subjectToAdd)
        ? current.subjectToAdd
        : (availableCreateSubjects[0] || '');

      return nextSubjectToAdd === current.subjectToAdd ? current : { ...current, subjectToAdd: nextSubjectToAdd };
    });
  }, [availableCreateSubjects]);

  useEffect(() => {
    setEditForm((current) => {
      if (!current || current.role !== 'teacher') {
        return current;
      }

      const availableEditClasses = classOptions.filter((className) => !current.assignedClasses.includes(className));
      const nextClassToAdd = availableEditClasses.includes(current.classToAdd)
        ? current.classToAdd
        : (availableEditClasses[0] || '');

      const availableEditLabBatches = labBatchOptions.filter((assignment) => !hasLabBatchAssignment(current.assignedLabBatches, assignment));
      const nextLabBatchToAdd = availableEditLabBatches.some((assignment) => buildLabBatchAssignmentKey(assignment) === current.labBatchToAdd)
        ? current.labBatchToAdd
        : (availableEditLabBatches[0] ? buildLabBatchAssignmentKey(availableEditLabBatches[0]) : '');

      if (nextClassToAdd === current.classToAdd && nextLabBatchToAdd === current.labBatchToAdd) {
        return current;
      }

      return { ...current, classToAdd: nextClassToAdd, labBatchToAdd: nextLabBatchToAdd };
    });
  }, [classOptions, labBatchOptions]);

  const handleCreateRoleChange = (role) => {
    setForm((current) => ({
      ...current,
      role,
      batch: role === 'student' ? current.batch : '',
      adminId: role === 'admin' ? current.adminId : '',
      employeeId: role === 'teacher' ? current.employeeId : '',
      department: role === 'teacher' ? current.department : '',
      subjects: role === 'teacher' ? current.subjects : [],
      subjectToAdd: role === 'teacher' ? current.subjectToAdd : defaultSubjectOption,
      assignedClasses: role === 'teacher' ? current.assignedClasses : [],
      assignedLabBatches: role === 'teacher' ? current.assignedLabBatches : [],
      classToAdd: role === 'teacher' ? current.classToAdd : '',
      labBatchToAdd: role === 'teacher' ? current.labBatchToAdd : '',
    }));
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBulkOptionChange = (event) => {
    const { name, value, type, checked } = event.target;
    setBulkForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBulkRoleChange = (role) => {
    setBulkForm((current) => ({
      ...current,
      role,
    }));
    setBulkResult(null);
    setError(null);
    resetBulkSelection();
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => {
      if (name === 'role') {
        return {
          ...current,
          role: value,
          batch: value === 'student' ? current.batch : '',
          adminId: value === 'admin' ? current.adminId : '',
          employeeId: value === 'teacher' ? current.employeeId : '',
          department: value === 'teacher' ? current.department : '',
          subjects: value === 'teacher' ? current.subjects : [],
          subjectToAdd: value === 'teacher' ? current.subjectToAdd : defaultSubjectOption,
          assignedClasses: value === 'teacher' ? current.assignedClasses : [],
          assignedLabBatches: value === 'teacher' ? current.assignedLabBatches : [],
          classToAdd: value === 'teacher' ? current.classToAdd : '',
          labBatchToAdd: value === 'teacher' ? current.labBatchToAdd : '',
        };
      }

      return { ...current, [name]: value };
    });
  };

  const addCreateSubject = () => {
    if (!form.subjectToAdd) {
      return;
    }

    setForm((current) => ({
      ...current,
      subjects: normalizeSubjects([...current.subjects, current.subjectToAdd]),
      subjectToAdd: subjectOptions.find((subject) => !current.subjects.includes(subject) && subject !== current.subjectToAdd) || current.subjectToAdd,
    }));
  };

  const removeCreateSubject = (subjectToRemove) => {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.filter((subject) => subject !== subjectToRemove),
      subjectToAdd: subjectToRemove,
    }));
  };

  const addEditSubject = () => {
    if (!editForm?.subjectToAdd) {
      return;
    }

    setEditForm((current) => ({
      ...current,
      subjects: normalizeSubjects([...current.subjects, current.subjectToAdd]),
      subjectToAdd: subjectOptions.find((subject) => !current.subjects.includes(subject) && subject !== current.subjectToAdd) || current.subjectToAdd,
    }));
  };

  const removeEditSubject = (subjectToRemove) => {
    setEditForm((current) => ({
      ...current,
      subjects: current.subjects.filter((subject) => subject !== subjectToRemove),
      subjectToAdd: subjectToRemove,
    }));
  };

  const addCreateAssignedClass = () => {
    const nextClass = String(form.classToAdd || '').trim();
    if (!nextClass) {
      return;
    }

    setForm((current) => ({
      ...current,
      assignedClasses: normalizeClassList([...current.assignedClasses, nextClass]),
      classToAdd: '',
    }));
  };

  const removeCreateAssignedClass = (classToRemove) => {
    setForm((current) => ({
      ...current,
      assignedClasses: current.assignedClasses.filter((className) => className !== classToRemove),
      classToAdd: current.classToAdd,
    }));
  };

  const addCreateAssignedLabBatch = () => {
    const nextAssignment = parseLabBatchAssignmentToken(form.labBatchToAdd);
    if (!nextAssignment) {
      return;
    }

    setForm((current) => ({
      ...current,
      assignedLabBatches: normalizeLabBatchAssignments([...current.assignedLabBatches, nextAssignment]),
      labBatchToAdd: '',
    }));
  };

  const removeCreateAssignedLabBatch = (assignmentToRemove) => {
    const assignmentKey = buildLabBatchAssignmentKey(assignmentToRemove);
    setForm((current) => ({
      ...current,
      assignedLabBatches: normalizeLabBatchAssignments(current.assignedLabBatches).filter((assignment) => buildLabBatchAssignmentKey(assignment) !== assignmentKey),
      labBatchToAdd: current.labBatchToAdd,
    }));
  };

  const addEditAssignedClass = () => {
    const nextClass = String(editForm?.classToAdd || '').trim();
    if (!nextClass) {
      return;
    }

    setEditForm((current) => ({
      ...current,
      assignedClasses: normalizeClassList([...current.assignedClasses, nextClass]),
      classToAdd: '',
    }));
  };

  const removeEditAssignedClass = (classToRemove) => {
    setEditForm((current) => ({
      ...current,
      assignedClasses: current.assignedClasses.filter((className) => className !== classToRemove),
      classToAdd: current.classToAdd,
    }));
  };

  const addEditAssignedLabBatch = () => {
    const nextAssignment = parseLabBatchAssignmentToken(editForm?.labBatchToAdd);
    if (!nextAssignment) {
      return;
    }

    setEditForm((current) => ({
      ...current,
      assignedLabBatches: normalizeLabBatchAssignments([...current.assignedLabBatches, nextAssignment]),
      labBatchToAdd: '',
    }));
  };

  const removeEditAssignedLabBatch = (assignmentToRemove) => {
    const assignmentKey = buildLabBatchAssignmentKey(assignmentToRemove);
    setEditForm((current) => ({
      ...current,
      assignedLabBatches: normalizeLabBatchAssignments(current.assignedLabBatches).filter((assignment) => buildLabBatchAssignmentKey(assignment) !== assignmentKey),
      labBatchToAdd: current.labBatchToAdd,
    }));
  };

  const resetBulkSelection = () => {
    setBulkSelection(emptyBulkSelection);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError(null);

    const trimmedFirstName = form.firstName.trim();
    const trimmedLastName = form.lastName.trim();
    const trimmedName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ');
    const trimmedEmail = form.email.trim();
    const trimmedEnrollmentNo = form.enrollmentNo.trim();
    const trimmedAdminId = form.adminId.trim();
    const trimmedPassword = form.password.trim();
    const teacherSubjects = normalizeSubjects(form.subjects);
    const assignedBatches = normalizeClassList(form.assignedClasses);
    const assignedLabBatches = normalizeLabBatchAssignments(form.assignedLabBatches);

    if (!trimmedName || !trimmedEmail || (!form.sendInvite && !trimmedPassword)) {
      setError('First name, last name, email, and either a temporary password or setup invite are required.');
      return;
    }

    if (form.role === 'teacher' && !form.employeeId.trim()) {
      setError('Teacher accounts must include an employee ID.');
      return;
    }

    if (form.role === 'admin' && !trimmedAdminId) {
      setError('Admin accounts must include an admin ID.');
      return;
    }

    setCreating(true);
    try {
      const response = await createUserAccount({
        name: trimmedName,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        enrollmentNo: trimmedEnrollmentNo || undefined,
        adminId: form.role === 'admin' ? trimmedAdminId : undefined,
        password: trimmedPassword || undefined,
        role: form.role,
        employeeId: form.role === 'teacher' ? form.employeeId.trim() : undefined,
        department: form.role === 'teacher' ? form.department.trim() : undefined,
        subjects: form.role === 'teacher' ? teacherSubjects : undefined,
        assignedBatches: form.role === 'teacher' ? assignedBatches : undefined,
        assignedLabBatches: form.role === 'teacher' ? assignedLabBatches : undefined,
        sendInvite: form.sendInvite,
      });
      showToast(response.message || 'Account created successfully.', { type: 'success' });
      setForm((current) => ({ ...current, firstName: '', lastName: '', email: '', enrollmentNo: '', adminId: '', password: '', batch: '', employeeId: '', department: '', subjects: [], subjectToAdd: defaultSubjectOption, assignedClasses: [], assignedLabBatches: [], classToAdd: '', labBatchToAdd: '', sendInvite: false }));
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleSendPasswordLink = async (userId) => {
    setError(null);
    setSendingLinkId(userId);
    try {
      const response = await sendUserPasswordLink(userId);
      showToast(response.message || 'Password access email sent successfully.', { type: 'success' });
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setSendingLinkId(null);
    }
  };

  const downloadBulkSampleCsv = () => {
    const sampleRowsByRole = {
      student: [
        ['firstName', 'lastName', 'email', 'enrollmentNo', 'role', 'class'],
        ['Aarav', 'Patel', 'aarav@example.com', 'STU001', 'student', 'TY-AIA-7'],
        ['Diya', 'Shah', 'diya@example.com', 'STU002', 'student', 'TY-AIA-9'],
      ],
      teacher: [
        ['firstName', 'lastName', 'email', 'enrollmentNo', 'role', 'employeeId', 'department', 'subjects', 'assignedClasses', 'assignedLabBatches'],
        ['Rohan', 'Mehta', 'rohan@example.com', 'TEA003', 'teacher', 'TCH003', 'Computer Science', 'DBMS, DSA', 'TY-AIA-7, TY-AIA-9', 'TY-AIA-7::Batch A'],
        ['Neha', 'Iyer', 'neha@example.com', 'TEA004', 'teacher', 'TCH004', 'Information Technology', 'OS', '', 'TY-AIA-9::Batch B'],
      ],
      admin: [
        ['firstName', 'lastName', 'email', 'adminId', 'role'],
        ['Admin', 'One', 'admin.one@example.com', 'ADM001', 'admin'],
        ['Admin', 'Two', 'admin.two@example.com', 'ADM002', 'admin'],
      ],
    };

    const sampleData = sampleRowsByRole[bulkForm.role] || sampleRowsByRole.student;

    const csvContent = sampleData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sample_${bulkForm.role}_users.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseBulkRows = async (file) => {
    const text = await file.text();

    if (file.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON import must be an array of users');
      }
      return parsed;
    }

    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`CSV parsing errors: ${parsed.errors.map((entry) => entry.message).join(', ')}`);
    }

    return parsed.data;
  };

  const normalizeBulkUserRow = (row, index, expectedRole) => {
    const firstName = String(row.firstName || '').trim();
    const lastName = String(row.lastName || '').trim();
    const email = String(row.email || '').trim();
    const enrollmentNo = String(row.enrollmentNo || row.enrollment || '').trim();
    const adminId = String(row.adminId || row.admin || '').trim();
    const role = String(row.role || expectedRole || 'student').trim().toLowerCase() || 'student';
    const batch = String(row.batch || row.class || '').trim();
    const employeeId = String(row.employeeId || '').trim();
    const department = String(row.department || '').trim();
    const subjects = parseSubjectsInput(String(row.subjects || '').replace(/\|/g, ','));
    const assignedBatches = parseBatchListInput(String(row.assignedBatches || row.assignedClasses || '').replace(/\|/g, ','));
    const assignedLabBatches = normalizeLabBatchAssignments(String(row.assignedLabBatches || row.teacherLabBatches || '').replace(/\|/g, ',').split(',').map((entry) => entry.trim()));

    if (!firstName || !lastName || !email) {
      throw new Error(`Row ${index + 2}: firstName, lastName, and email are required`);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Row ${index + 2}: email must be valid`);
    }

    if (!['student', 'teacher', 'admin'].includes(role)) {
      throw new Error(`Row ${index + 2}: role must be student, teacher, or admin`);
    }

    if (expectedRole && role !== expectedRole) {
      throw new Error(`Row ${index + 2}: role must be ${expectedRole} for the selected bulk upload mode`);
    }

    if (role === 'teacher' && !employeeId) {
      throw new Error(`Row ${index + 2}: teacher rows must include an employee ID`);
    }

    if (role === 'admin' && !adminId) {
      throw new Error(`Row ${index + 2}: admin rows must include an admin ID`);
    }

    return {
      firstName,
      lastName,
      email,
      enrollmentNo,
      adminId,
      role,
      class: batch,
      employeeId,
      department,
      subjects,
      assignedBatches,
      assignedLabBatches,
    };
  };

  const openEditUser = (user) => {
    const normalizedAssignedClasses = normalizeClassList(user.assignedBatches);
    const normalizedAssignedLabBatches = normalizeLabBatchAssignments(user.assignedLabBatches);
    const availableEditClasses = classOptions.filter((className) => !normalizedAssignedClasses.includes(className));
    const availableEditLabBatches = labBatchOptions.filter((assignment) => !hasLabBatchAssignment(normalizedAssignedLabBatches, assignment));
    setEditUserId(user._id);
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      enrollmentNo: user.enrollmentNo || '',
      adminId: user.adminId || '',
      role: user.role || 'student',
      batch: user.class || user.batch || '',
      employeeId: user.employeeId || '',
      department: user.department || '',
      subjects: normalizeSubjects(user.subjects),
      subjectToAdd: subjectOptions.find((subject) => !normalizeSubjects(user.subjects, subjectOptions).includes(subject)) || defaultSubjectOption,
      assignedClasses: normalizedAssignedClasses,
      assignedLabBatches: normalizedAssignedLabBatches,
      classToAdd: availableEditClasses[0] || '',
      labBatchToAdd: availableEditLabBatches[0] ? buildLabBatchAssignmentKey(availableEditLabBatches[0]) : '',
    });
  };

  const handleSaveUserDetails = async (event) => {
    event.preventDefault();
    if (!editUserId || !editForm) {
      return;
    }

    const teacherSubjects = normalizeSubjects(editForm.subjects);
    const studentBatch = editForm.batch.trim();
    const assignedBatches = normalizeClassList(editForm.assignedClasses);
    const assignedLabBatches = normalizeLabBatchAssignments(editForm.assignedLabBatches);
    const adminId = editForm.adminId.trim();

    if (editForm.role === 'teacher' && !editForm.employeeId.trim()) {
      setError('Teacher accounts must include an employee ID.');
      return;
    }

    if (editForm.role === 'admin' && !adminId) {
      setError('Admin accounts must include an admin ID.');
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      const response = await updateUserDetails(editUserId, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        enrollmentNo: editForm.enrollmentNo.trim() || undefined,
        adminId: editForm.role === 'admin' ? adminId : undefined,
        role: editForm.role,
        class: editForm.role === 'student' ? studentBatch : undefined,
        employeeId: editForm.role === 'teacher' ? editForm.employeeId.trim() : undefined,
        department: editForm.role === 'teacher' ? editForm.department.trim() : undefined,
        subjects: editForm.role === 'teacher' ? teacherSubjects : undefined,
        assignedBatches: editForm.role === 'teacher' ? assignedBatches : undefined,
        assignedLabBatches: editForm.role === 'teacher' ? assignedLabBatches : undefined,
      });
      showToast(response.message || 'User details updated successfully.', { type: 'success' });
      setEditUserId(null);
      setEditForm(null);
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBulkFileUpload = async (file) => {
    setBulkResult(null);
    if (!file) return;
    setError(null);

    try {
      const rows = await parseBulkRows(file);
      const usersPayload = rows.map((row, index) => normalizeBulkUserRow(row, index, bulkForm.role));

      if (!usersPayload.length) {
        throw new Error('No valid users found in the uploaded file');
      }

      const overLimit = usersPayload.length > MAX_BULK_USERS;
      setBulkSelection({
        fileName: file.name,
        users: usersPayload,
        totalRows: usersPayload.length,
        overLimit,
        parseError: '',
      });

      if (overLimit) {
        const message = `Selected file contains ${usersPayload.length} users. Bulk import supports up to ${MAX_BULK_USERS} users per upload.`;
        setError(message);
        showToast(message, { type: 'error' });
        return;
      }

      showToast(`Validated ${usersPayload.length} users from ${file.name}. Ready to import.`, { type: 'success' });
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setBulkSelection({
        fileName: file.name,
        users: [],
        totalRows: 0,
        overLimit: false,
        parseError: message,
      });
      setBulkResult({ error: message });
      setError(message);
      showToast(message, { type: 'error' });
    }
  };

  const handleBulkImport = async () => {
    if (!bulkForm.temporaryPassword.trim()) {
      const message = 'Temporary password is required before importing users.';
      setError(message);
      showToast(message, { type: 'error' });
      return;
    }

    if (!bulkSelection.users.length) {
      const message = 'Select a valid CSV or JSON file before starting the import.';
      setError(message);
      showToast(message, { type: 'error' });
      return;
    }

    if (bulkSelection.overLimit) {
      const message = `Selected file contains ${bulkSelection.totalRows} users. Split it into smaller files of ${MAX_BULK_USERS} or fewer.`;
      setError(message);
      showToast(message, { type: 'error' });
      return;
    }

    setBulkUploading(true);
    setBulkResult(null);
    setError(null);

    try {
      const response = await bulkCreateUsers({
        users: bulkSelection.users,
        temporaryPassword: bulkForm.temporaryPassword,
        sendInvite: bulkForm.sendInvite,
      });

      setBulkResult(response);
      showToast(response.message || 'Bulk user import completed.', {
        type: response.failedCount > 0 ? 'warning' : 'success',
      });
      await load();
      resetBulkSelection();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setBulkResult({ error: message });
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadBulkFailuresCsv = () => {
    if (!bulkResult?.errors?.length) {
      return;
    }

    downloadCsv('bulk_user_import_failures.csv', [
      { key: 'row', label: 'row' },
      { key: 'email', label: 'email' },
      { key: 'message', label: 'error' },
    ], bulkResult.errors.map((rowError) => ({
      row: rowError.row,
      email: rowError.email || '',
      message: rowError.message,
    })));
  };

  const changeRole = async (id, role) => {
    try{
      await updateRole(id, role);
      setOpenActionMenuId(null);
      await load();
    }catch(err){
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  const changeStatus = async (id) => {
    try{
      await toggleStatus(id);
      setOpenActionMenuId(null);
      await load();
    }catch(err){
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(
      `⚠️ Permanently delete ${user.name || user.email}?\n\nThis will remove the user and all their exam attempts, analytics, and pending emails. This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const response = await deleteUser(user._id);
      showToast(response.message || 'User deleted permanently.', { type: 'success' });
      setOpenActionMenuId(null);
      await load();
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  return (
    <div className="container">
      <div className="nav"><h2>Manage Users</h2><div className="small">Admin panel</div></div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{activeCreateRole.title}</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {CREATE_ROLE_OPTIONS.map((option) => {
            const isActive = form.role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? '' : 'button-secondary'}
                onClick={() => handleCreateRoleChange(option.value)}
                style={{
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color, #dbe3f0)'}`,
                  background: isActive ? 'rgba(37, 99, 235, 0.08)' : '#fff',
                  color: 'inherit',
                  boxShadow: isActive ? '0 0 0 1px rgba(37, 99, 235, 0.12)' : 'none',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 6 }}>{option.title}</strong>
              </button>
            );
          })}
        </div>
        <form onSubmit={handleCreateUser}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="admin-user-first-name">First Name</label>
              <input id="admin-user-first-name" name="firstName" value={form.firstName} onChange={handleFormChange} placeholder="e.g., Alex" required />
            </div>
            <div className="form-group">
              <label htmlFor="admin-user-last-name">Last Name</label>
              <input id="admin-user-last-name" name="lastName" value={form.lastName} onChange={handleFormChange} placeholder="e.g., Johnson" required />
            </div>
            <div className="form-group">
              <label htmlFor="admin-user-email">Email</label>
              <input id="admin-user-email" name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="user@example.com" required />
            </div>
            <div className="form-group">
              <label htmlFor={`admin-user-${createIdentifierConfig.key}`}>
                {createIdentifierConfig.label}
              </label>
              <input
                id={`admin-user-${createIdentifierConfig.key}`}
                name={createIdentifierConfig.key}
                value={form[createIdentifierConfig.key]}
                onChange={handleFormChange}
                placeholder={createIdentifierConfig.placeholder}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin-user-password">Temporary Password</label>
              <input id="admin-user-password" name="password" type="password" value={form.password} onChange={handleFormChange} placeholder={form.sendInvite ? 'Optional temporary password when emailing setup link' : 'Set an initial password'} required={!form.sendInvite} />
            </div>
            {form.role === 'teacher' && (
              <>
                <div className="form-group">
                  <label htmlFor="admin-user-department">Department</label>
                  <input id="admin-user-department" name="department" value={form.department} onChange={handleFormChange} placeholder="e.g., Computer Science" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="admin-user-subjects">Assigned Subjects</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      id="admin-user-subjects"
                      name="subjectToAdd"
                      value={availableCreateSubjects.includes(form.subjectToAdd) ? form.subjectToAdd : (availableCreateSubjects[0] || '')}
                      onChange={handleFormChange}
                      disabled={availableCreateSubjects.length === 0}
                      style={{ minWidth: 220 }}
                    >
                      {availableCreateSubjects.length === 0 ? (
                        <option value="">All subjects added</option>
                      ) : (
                        availableCreateSubjects.map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))
                      )}
                    </select>
                    <button type="button" className="button-secondary" onClick={addCreateSubject} disabled={availableCreateSubjects.length === 0}>
                      Add Subject
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {form.subjects.map((subject) => (
                      <span key={subject} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                        {subject}
                        <button
                          type="button"
                          onClick={() => removeCreateSubject(subject)}
                          style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          aria-label={`Remove ${subject}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>Optional at creation. Add subjects now or later if the teacher handles one or more subjects.</small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="admin-user-class-to-add">Assigned Classes</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      id="admin-user-class-to-add"
                      name="classToAdd"
                      value={availableCreateClasses.includes(form.classToAdd) ? form.classToAdd : (availableCreateClasses[0] || '')}
                      onChange={handleFormChange}
                      disabled={availableCreateClasses.length === 0}
                      style={{ minWidth: 220 }}
                    >
                      {availableCreateClasses.length === 0 ? (
                        <option value="">All created classes assigned</option>
                      ) : (
                        availableCreateClasses.map((className) => (
                          <option key={className} value={className}>{className}</option>
                        ))
                      )}
                    </select>
                    <button type="button" className="button-secondary" onClick={addCreateAssignedClass} disabled={availableCreateClasses.length === 0 || !String(form.classToAdd || '').trim()}>
                      Add Class
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {form.assignedClasses.map((className) => (
                      <span key={className} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                        {className}
                        <button
                          type="button"
                          onClick={() => removeCreateAssignedClass(className)}
                          style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          aria-label={`Remove ${className}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                    {classOptions.length === 0
                      ? 'Create theory classes in Manage Classes before assigning them to teachers.'
                      : 'Optional at creation. Choose from the created class list now or leave it empty and assign classes later.'}
                  </small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="admin-user-lab-batch-to-add">Assigned Lab Batches</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      id="admin-user-lab-batch-to-add"
                      name="labBatchToAdd"
                      value={availableCreateLabBatches.some((assignment) => buildLabBatchAssignmentKey(assignment) === form.labBatchToAdd) ? form.labBatchToAdd : (availableCreateLabBatches[0] ? buildLabBatchAssignmentKey(availableCreateLabBatches[0]) : '')}
                      onChange={handleFormChange}
                      disabled={availableCreateLabBatches.length === 0}
                      style={{ minWidth: 260 }}
                    >
                      {availableCreateLabBatches.length === 0 ? (
                        <option value="">All created lab batches assigned</option>
                      ) : (
                        availableCreateLabBatches.map((assignment) => (
                          <option key={buildLabBatchAssignmentKey(assignment)} value={buildLabBatchAssignmentKey(assignment)}>{buildLabBatchAssignmentLabel(assignment)}</option>
                        ))
                      )}
                    </select>
                    <button type="button" className="button-secondary" onClick={addCreateAssignedLabBatch} disabled={availableCreateLabBatches.length === 0 || !String(form.labBatchToAdd || '').trim()}>
                      Add Lab Batch
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {normalizeLabBatchAssignments(form.assignedLabBatches).map((assignment) => (
                      <span key={buildLabBatchAssignmentKey(assignment)} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                        {buildLabBatchAssignmentLabel(assignment)}
                        <button
                          type="button"
                          onClick={() => removeCreateAssignedLabBatch(assignment)}
                          style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                          aria-label={`Remove ${buildLabBatchAssignmentLabel(assignment)}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                    {labBatchOptions.length === 0
                      ? 'Create lab batches in Manage Classes before assigning them to teachers.'
                      : 'Optional at creation. Use lab batches when a teacher handles only a specific practical group instead of the full class.'}
                  </small>
                </div>
              </>
            )}
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label htmlFor="admin-user-send-invite" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                <input id="admin-user-send-invite" name="sendInvite" type="checkbox" checked={form.sendInvite} onChange={handleFormChange} style={{ width: 16, height: 16 }} />
                  Send password setup email
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" disabled={creating}>{creating ? 'Creating…' : activeCreateRole.title}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{activeBulkRole.title}</h3>
        <p className="text-muted">{activeBulkRole.description}</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {BULK_ROLE_OPTIONS.map((option) => {
            const isActive = bulkForm.role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? '' : 'button-secondary'}
                onClick={() => handleBulkRoleChange(option.value)}
                style={{
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 12,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color, #dbe3f0)'}`,
                  background: isActive ? 'rgba(37, 99, 235, 0.08)' : '#fff',
                  color: 'inherit',
                  boxShadow: isActive ? '0 0 0 1px rgba(37, 99, 235, 0.12)' : 'none',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 6 }}>{option.title}</strong>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Bulk Import Users</h3>
          {bulkSelection.fileName && (
            <span className={`badge ${bulkSelection.overLimit || bulkSelection.parseError ? 'badge-danger' : 'badge-info'}`}>
              {bulkSelection.totalRows > 0 ? `${bulkSelection.totalRows} row${bulkSelection.totalRows === 1 ? '' : 's'}` : 'file selected'}
            </span>
          )}
        </div>
        <p className="text-muted">
          {bulkForm.role === 'student' && `Upload a CSV or JSON file to create student accounts in bulk. You can leave the class empty and assign it later. Maximum ${MAX_BULK_USERS} users per upload.`}
          {bulkForm.role === 'teacher' && `Upload a CSV or JSON file to create teacher accounts in bulk. Each row must include employeeId, department, subjects, and assigned classes like Class A or Class B. Maximum ${MAX_BULK_USERS} users per upload.`}
          {bulkForm.role === 'admin' && `Upload a CSV or JSON file to create administrator accounts in bulk. Each row must include adminId. Maximum ${MAX_BULK_USERS} users per upload.`}
        </p>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'end' }}>
          <div className="form-group">
            <label htmlFor="bulk-user-password">Temporary Password</label>
            <input
              id="bulk-user-password"
              name="temporaryPassword"
              type="password"
              value={bulkForm.temporaryPassword}
              onChange={handleBulkOptionChange}
              placeholder="Shared password for imported users"
              required
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
            <label htmlFor="bulk-user-send-invite" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <input
                id="bulk-user-send-invite"
                name="sendInvite"
                type="checkbox"
                checked={bulkForm.sendInvite}
                onChange={handleBulkOptionChange}
                style={{ width: 16, height: 16 }}
              />
              Email each imported user a password setup link
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".csv,.json"
              style={{ display: 'none' }}
              onChange={(event) => handleBulkFileUpload(event.target.files?.[0])}
            />
            <button type="button" className="button-secondary" onClick={downloadBulkSampleCsv}>
              Download Sample CSV
            </button>
            <button type="button" className="button-secondary" onClick={() => bulkFileInputRef.current?.click()} disabled={bulkUploading}>
              Choose CSV or JSON
            </button>
            <button type="button" onClick={handleBulkImport} disabled={bulkUploading || !bulkSelection.users.length || bulkSelection.overLimit || Boolean(bulkSelection.parseError)}>
              {bulkUploading ? 'Importing…' : `Start ${bulkForm.role.charAt(0).toUpperCase() + bulkForm.role.slice(1)} Import`}
            </button>
            <button type="button" className="button-secondary" onClick={resetBulkSelection} disabled={bulkUploading || !bulkSelection.fileName}>
              Clear Selection
            </button>
          </div>
        </div>

        {bulkSelection.fileName && (
          <div className={`alert ${bulkSelection.overLimit || bulkSelection.parseError ? 'alert-danger' : 'alert-info'}`} style={{ marginTop: 16 }}>
            <strong>{bulkSelection.fileName}</strong>
            <div style={{ marginTop: 6 }}>
              {bulkSelection.parseError
                ? bulkSelection.parseError
                : `Detected ${bulkSelection.totalRows} user row(s). ${bulkSelection.overLimit ? `Split this file into smaller files of ${MAX_BULK_USERS} or fewer before importing.` : 'File is ready to import.'}`}
            </div>
          </div>
        )}

        {bulkResult && !bulkResult.error && (
          <div style={{ marginTop: 16 }}>
            <div className={`alert ${bulkResult.failedCount > 0 ? 'alert-warning' : 'alert-success'}`}>
              Created {bulkResult.createdCount} account(s). Failed {bulkResult.failedCount}.
            </div>
            {bulkResult.errors?.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="button-secondary" onClick={downloadBulkFailuresCsv}>
                    Download Failed Rows CSV
                  </button>
                </div>
                <div className="report-table" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Email</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.errors.map((rowError, index) => (
                        <tr key={`${rowError.row}-${rowError.email}-${index}`}>
                          <td>{rowError.row}</td>
                          <td>{rowError.email || 'N/A'}</td>
                          <td>{rowError.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {bulkResult?.error && <div className="alert alert-danger" style={{ marginTop: 16 }}>{bulkResult.error}</div>}
      </div>

      {editForm && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Edit User Details</h3>
          <form onSubmit={handleSaveUserDetails}>
            {(() => {
              const editIdentifierConfig = getIdentifierConfig(editForm.role);

              return (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label htmlFor="edit-user-first-name">First Name</label>
                <input id="edit-user-first-name" name="firstName" value={editForm.firstName} onChange={handleEditFormChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="edit-user-last-name">Last Name</label>
                <input id="edit-user-last-name" name="lastName" value={editForm.lastName} onChange={handleEditFormChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="edit-user-email">Email</label>
                <input id="edit-user-email" name="email" type="email" value={editForm.email} onChange={handleEditFormChange} required />
              </div>
              <div className="form-group">
                <label htmlFor={`edit-user-${editIdentifierConfig.key}`}>
                  {editIdentifierConfig.label}
                </label>
                <input
                  id={`edit-user-${editIdentifierConfig.key}`}
                  name={editIdentifierConfig.key}
                  value={editForm[editIdentifierConfig.key]}
                  onChange={handleEditFormChange}
                  required={editForm.role !== 'teacher'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-user-role">Role</label>
                <select id="edit-user-role" name="role" value={editForm.role} onChange={handleEditFormChange}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editForm.role === 'student' && (
                <div className="form-group">
                  <label htmlFor="edit-user-batch">Class</label>
                  <select id="edit-user-batch" name="batch" value={classOptions.includes(editForm.batch) ? editForm.batch : ''} onChange={handleEditFormChange}>
                    <option value="">No class assigned</option>
                    {classOptions.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                  <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                    {classOptions.length === 0
                      ? 'Create classes in Manage Classes before assigning one here.'
                      : 'Choose from the created class list or leave this user unassigned.'}
                  </small>
                </div>
              )}
              {editForm.role === 'teacher' && (
                <>
                  {(() => {
                    const availableEditSubjects = subjectOptions.filter((subject) => !editForm.subjects.includes(subject));
                    return (
                      <>
                  <div className="form-group">
                    <label htmlFor="edit-user-department">Department</label>
                    <input id="edit-user-department" name="department" value={editForm.department} onChange={handleEditFormChange} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="edit-user-subjects">Assigned Subjects</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        id="edit-user-subjects"
                        name="subjectToAdd"
                        value={availableEditSubjects.includes(editForm.subjectToAdd) ? editForm.subjectToAdd : (availableEditSubjects[0] || '')}
                        onChange={handleEditFormChange}
                        disabled={availableEditSubjects.length === 0}
                        style={{ minWidth: 220 }}
                      >
                        {availableEditSubjects.length === 0 ? (
                          <option value="">All subjects added</option>
                        ) : (
                          availableEditSubjects.map((subject) => (
                            <option key={subject} value={subject}>{subject}</option>
                          ))
                        )}
                      </select>
                      <button type="button" className="button-secondary" onClick={addEditSubject} disabled={availableEditSubjects.length === 0}>
                        Add Subject
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {editForm.subjects.map((subject) => (
                        <span key={subject} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                          {subject}
                          <button
                            type="button"
                            onClick={() => removeEditSubject(subject)}
                            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            aria-label={`Remove ${subject}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="edit-user-class-to-add">Assigned Classes</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        id="edit-user-class-to-add"
                        name="classToAdd"
                        value={classOptions.filter((className) => !editForm.assignedClasses.includes(className)).includes(editForm.classToAdd) ? editForm.classToAdd : (classOptions.filter((className) => !editForm.assignedClasses.includes(className))[0] || '')}
                        onChange={handleEditFormChange}
                        disabled={classOptions.filter((className) => !editForm.assignedClasses.includes(className)).length === 0}
                        style={{ minWidth: 220 }}
                      >
                        {classOptions.filter((className) => !editForm.assignedClasses.includes(className)).length === 0 ? (
                          <option value="">All created classes assigned</option>
                        ) : (
                          classOptions.filter((className) => !editForm.assignedClasses.includes(className)).map((className) => (
                            <option key={className} value={className}>{className}</option>
                          ))
                        )}
                      </select>
                      <button type="button" className="button-secondary" onClick={addEditAssignedClass} disabled={classOptions.filter((className) => !editForm.assignedClasses.includes(className)).length === 0 || !String(editForm.classToAdd || '').trim()}>
                        Add Class
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {editForm.assignedClasses.map((className) => (
                        <span key={className} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                          {className}
                          <button
                            type="button"
                            onClick={() => removeEditAssignedClass(className)}
                            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            aria-label={`Remove ${className}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                      {classOptions.length === 0
                        ? 'Create theory classes in Manage Classes before assigning them to teachers.'
                        : 'Optional. Choose from the created class list now or leave it empty and assign classes later.'}
                    </small>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="edit-user-lab-batch-to-add">Assigned Lab Batches</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        id="edit-user-lab-batch-to-add"
                        name="labBatchToAdd"
                        value={labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment)).some((assignment) => buildLabBatchAssignmentKey(assignment) === editForm.labBatchToAdd) ? editForm.labBatchToAdd : (labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment))[0] ? buildLabBatchAssignmentKey(labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment))[0]) : '')}
                        onChange={handleEditFormChange}
                        disabled={labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment)).length === 0}
                        style={{ minWidth: 260 }}
                      >
                        {labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment)).length === 0 ? (
                          <option value="">All created lab batches assigned</option>
                        ) : (
                          labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment)).map((assignment) => (
                            <option key={buildLabBatchAssignmentKey(assignment)} value={buildLabBatchAssignmentKey(assignment)}>{buildLabBatchAssignmentLabel(assignment)}</option>
                          ))
                        )}
                      </select>
                      <button type="button" className="button-secondary" onClick={addEditAssignedLabBatch} disabled={labBatchOptions.filter((assignment) => !hasLabBatchAssignment(editForm.assignedLabBatches, assignment)).length === 0 || !String(editForm.labBatchToAdd || '').trim()}>
                        Add Lab Batch
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {normalizeLabBatchAssignments(editForm.assignedLabBatches).map((assignment) => (
                        <span key={buildLabBatchAssignmentKey(assignment)} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                          {buildLabBatchAssignmentLabel(assignment)}
                          <button
                            type="button"
                            onClick={() => removeEditAssignedLabBatch(assignment)}
                            style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            aria-label={`Remove ${buildLabBatchAssignmentLabel(assignment)}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>
                      {labBatchOptions.length === 0
                        ? 'Create lab batches in Manage Classes before assigning them to teachers.'
                        : 'Optional. Use lab batches when a teacher handles only a specific practical group instead of the full class.'}
                    </small>
                  </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" className="button-secondary" onClick={() => { setEditUserId(null); setEditForm(null); }} disabled={savingEdit}>Cancel</button>
              <button type="submit" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Details'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading && <LoadingSpinner />}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {USER_LIST_TABS.map((tab) => {
              const isActive = userListRole === tab.value;
              const count = users.filter((user) => user.role === tab.value).length;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={isActive ? '' : 'button-secondary'}
                  onClick={() => setUserListRole(tab.value)}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
        )}
        {!loading && !visibleUsers.length && <p className="text-muted text-center">No {userListRole}s found.</p>}
        {!loading && visibleUsers.length > 0 && (
          <table>
            <thead>
              <tr>
                {userListRole === 'student' && <th>Enrollment ID</th>}
                {userListRole === 'teacher' && <th>Employee ID</th>}
                {userListRole === 'admin' && <th>Admin ID</th>}
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {userListRole === 'teacher' && <th>Subjects</th>}
                {userListRole === 'teacher' && <th>Classes</th>}
                {userListRole === 'teacher' && <th>Lab Batches</th>}
                {userListRole !== 'admin' && (
                  <th>
                    {userListRole === 'student' ? 'Class' : 'Department'}
                  </th>
                )}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u=> (
                <tr key={u._id}>
                  {userListRole === 'student' && <td className="text-small">{u.enrollmentNo || '—'}</td>}
                  {userListRole === 'teacher' && <td className="text-small">{u.employeeId || '—'}</td>}
                  {userListRole === 'admin' && <td className="text-small">{u.adminId || '—'}</td>}
                  <td><strong>{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.name}</strong></td>
                  <td className="text-small">{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : u.role === 'teacher' ? 'badge-warning' : 'badge-info'}`}>
                      {u.role}
                    </span>
                  </td>
                  {userListRole === 'teacher' && (
                    <td className="text-small">
                      {Array.isArray(u.subjects) && u.subjects.length > 0
                        ? u.subjects.join(', ')
                        : 'Subjects not set'}
                    </td>
                  )}
                  {userListRole === 'teacher' && (
                    <td className="text-small">
                      {Array.isArray(u.assignedBatches) && u.assignedBatches.length > 0
                        ? u.assignedBatches.join(', ')
                        : 'Classes not set'}
                    </td>
                  )}
                  {userListRole === 'teacher' && (
                    <td className="text-small">
                      {Array.isArray(u.assignedLabBatches) && u.assignedLabBatches.length > 0
                        ? u.assignedLabBatches.map((assignment) => buildLabBatchAssignmentLabel(assignment)).join(', ')
                        : 'Lab batches not set'}
                    </td>
                  )}
                  {userListRole !== 'admin' && (
                    <td className="text-small">
                      {u.role === 'teacher'
                        ? u.department || 'Department not set'
                        : u.class || u.batch || 'Class not set'}
                    </td>
                  )}
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {u.isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ position: 'relative', display: 'inline-block' }} onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="button-sm button-secondary"
                        onClick={() => setOpenActionMenuId((current) => current === u._id ? null : u._id)}
                        aria-label={`Open actions for ${u.name || u.email}`}
                        style={{ minWidth: 40, paddingInline: 12, fontSize: 18, lineHeight: 1 }}
                      >
                        ⋮
                      </button>
                      {openActionMenuId === u._id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            minWidth: 220,
                            padding: 10,
                            borderRadius: 12,
                            background: '#fff',
                            border: '1px solid var(--border-color, #dbe3f0)',
                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                            zIndex: 20,
                          }}
                        >
                          <div style={{ display: 'grid', gap: 8 }}>
                            <button
                              type="button"
                              className="button-sm button-secondary"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                openEditUser(u);
                              }}
                              style={{ width: '100%' }}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              className="button-sm button-secondary"
                              onClick={() => handleSendPasswordLink(u._id)}
                              disabled={sendingLinkId === u._id}
                              style={{ width: '100%' }}
                            >
                              {sendingLinkId === u._id ? 'Sending…' : (u.isVerified ? 'Send Reset Link' : 'Send Setup Link')}
                            </button>
                            <button
                              type="button"
                              className={`button-sm ${u.isActive ? 'button-danger' : 'button-success'}`}
                              onClick={() => changeStatus(u._id)}
                              style={{ width: '100%' }}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <div style={{ borderTop: '1px solid var(--border-color, #dbe3f0)', paddingTop: 8, marginTop: 4 }}>
                              <div className="text-small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Change role</div>
                              <div style={{ display: 'grid', gap: 6 }}>
                                {['student', 'teacher', 'admin'].filter((role) => role !== u.role).map((role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    className="button-sm button-secondary"
                                    onClick={() => changeRole(u._id, role)}
                                    style={{ width: '100%' }}
                                  >
                                    Make {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-color, #dbe3f0)', paddingTop: 8, marginTop: 4 }}>
                              <button
                                type="button"
                                className="button-sm button-danger"
                                onClick={() => handleDeleteUser(u)}
                                style={{ width: '100%' }}
                              >
                                🗑 Delete Permanently
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
