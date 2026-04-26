const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user.model');
const AcademicClass = require('../models/academicClass.model');
const { buildAdminId, buildEmployeeId, buildEnrollmentNo, normalizeRoleIdentifier, normalizeUserIdentity, serializeUser } = require('../utils/userIdentity');
const { queueAccountSetupEmail, queuePasswordResetEmail } = require('../services/email.service');
const { getAvailableSubjectCodes, normalizeSubjectCode } = require('../utils/subjects');
const { createTokenRecord } = require('../utils/tokenSecurity');

const buildPlaceholderPassword = () => `Invite#${crypto.randomBytes(8).toString('hex')}`;
const MAX_BULK_USERS = 500;

const normalizeBoolean = (value) => value === true || value === 'true';

const normalizeSubjects = async (subjects) => {
  if (!Array.isArray(subjects)) {
    return [];
  }

  const availableSubjectCodes = await getAvailableSubjectCodes({ includeInactive: false });

  return Array.from(new Set(subjects
    .map((subject) => normalizeSubjectCode(subject))
    .filter((subject) => availableSubjectCodes.includes(subject))));
};

const normalizeBatchValue = (batch) => String(batch || '').trim();

const normalizeBatchList = (batches) => {
  if (!Array.isArray(batches)) {
    return [];
  }

  return Array.from(new Set(batches
    .map((batch) => normalizeBatchValue(batch))
    .filter(Boolean)));
};

const normalizeAssignedLabBatchList = (assignedLabBatches) => {
  if (!Array.isArray(assignedLabBatches)) {
    return [];
  }

  const normalizedEntries = assignedLabBatches
    .map((entry) => {
      if (typeof entry === 'string') {
        const [className, labBatchName] = entry.split('::').map((value) => String(value || '').trim());
        return { className, labBatchName };
      }

      return {
        className: normalizeBatchValue(entry?.className || entry?.class || ''),
        labBatchName: normalizeBatchValue(entry?.labBatchName || entry?.labBatch || ''),
      };
    })
    .filter((entry) => entry.className && entry.labBatchName);

  return Array.from(new Map(
    normalizedEntries.map((entry) => [`${entry.className}::${entry.labBatchName}`, entry])
  ).values());
};

const validateAssignedClasses = async (assignedClasses) => {
  const normalizedClasses = normalizeBatchList(assignedClasses).map((className) => className.toUpperCase());
  if (normalizedClasses.length === 0) {
    return [];
  }

  const existingClasses = await AcademicClass.find({ name: { $in: normalizedClasses } }).select('name');
  const existingClassNames = new Set(existingClasses.map((academicClass) => academicClass.name));
  const missingClasses = normalizedClasses.filter((className) => !existingClassNames.has(className));

  if (missingClasses.length > 0) {
    const error = new Error(`Assigned classes must match created classes. Missing: ${missingClasses.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return normalizedClasses;
};

const validateAssignedLabBatches = async (assignedLabBatches) => {
  const normalizedAssignments = normalizeAssignedLabBatchList(assignedLabBatches).map((entry) => ({
    className: entry.className.toUpperCase(),
    labBatchName: entry.labBatchName,
  }));

  if (normalizedAssignments.length === 0) {
    return [];
  }

  const classNames = Array.from(new Set(normalizedAssignments.map((entry) => entry.className)));
  const existingClasses = await AcademicClass.find({ name: { $in: classNames } }).select('name labBatches');
  const classMap = new Map(existingClasses.map((academicClass) => [academicClass.name, academicClass]));

  const missingAssignments = normalizedAssignments.filter((entry) => {
    const academicClass = classMap.get(entry.className);
    if (!academicClass) {
      return true;
    }

    return !academicClass.labBatches.some((labBatch) => labBatch.name === entry.labBatchName);
  });

  if (missingAssignments.length > 0) {
    const error = new Error(`Assigned lab batches must match created class lab batches. Missing: ${missingAssignments.map((entry) => `${entry.className} :: ${entry.labBatchName}`).join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return normalizedAssignments;
};

const buildCreationMessage = (role, inviteMode) => {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Student';
  if (inviteMode === 'setup') {
    return `${roleLabel} account created and setup email sent.`;
  }
  if (inviteMode === 'invite') {
    return `${roleLabel} account created, temporary password set, and invite email sent.`;
  }
  return `${roleLabel} account created successfully.`;
};

const prepareUserData = ({ name, firstName, lastName, email, password, role = 'student', enrollmentNo, adminId, sendInvite = false, employeeId, department, subjects, batch, class: className, assignedBatches, assignedClasses, assignedLabBatches }) => {
  const normalizedIdentity = normalizeUserIdentity({ name, firstName, lastName });
  const normalizedRole = ['admin', 'teacher', 'student'].includes(role) ? role : 'student';
  return {
    normalizedIdentity,
    normalizedEmail: typeof email === 'string' ? email.trim().toLowerCase() : '',
    normalizedPassword: typeof password === 'string' ? password.trim() : '',
    normalizedRole,
    normalizedAdminId: normalizedRole === 'admin' ? normalizeRoleIdentifier(adminId) : '',
    normalizedEmployeeId: normalizedRole === 'teacher' ? normalizeRoleIdentifier(employeeId) : '',
    normalizedDepartment: typeof department === 'string' ? department.trim() : '',
    rawSubjects: normalizedRole === 'teacher' ? subjects : [],
    normalizedBatch: normalizedRole === 'student' ? normalizeBatchValue(className ?? batch) : '',
    normalizedAssignedBatches: normalizedRole === 'teacher' ? normalizeBatchList(assignedClasses ?? assignedBatches) : [],
    normalizedAssignedLabBatches: normalizedRole === 'teacher' ? normalizeAssignedLabBatchList(assignedLabBatches) : [],
    normalizedEnrollment: enrollmentNo ? enrollmentNo.trim().toUpperCase() : buildEnrollmentNo(),
    shouldSendInvite: normalizeBoolean(sendInvite),
  };
};

const ensureUserUniqueness = async ({ normalizedEmail, normalizedEnrollment, normalizedRole, normalizedAdminId, normalizedEmployeeId }) => {
  const existingEnrollment = await User.findOne({ enrollmentNo: normalizedEnrollment });
  if (existingEnrollment) {
    const error = new Error('User with this enrollment number already exists');
    error.statusCode = 409;
    throw error;
  }

  if (normalizedRole === 'admin' && normalizedAdminId) {
    const existingAdminId = await User.findOne({ adminId: normalizedAdminId });
    if (existingAdminId) {
      const error = new Error('User with this admin ID already exists');
      error.statusCode = 409;
      throw error;
    }
  }

  if (normalizedRole === 'teacher' && normalizedEmployeeId) {
    const existingEmployeeId = await User.findOne({ employeeId: normalizedEmployeeId });
    if (existingEmployeeId) {
      const error = new Error('User with this employee ID already exists');
      error.statusCode = 409;
      throw error;
    }
  }

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }
};

const issuePasswordAccessLink = async (user, mode = 'setup') => {
  const token = createTokenRecord();
  user.resetPasswordToken = token.hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + ((mode === 'setup' || mode === 'invite') ? 24 * 3600000 : 3600000));
  await user.save();

  if (process.env.NODE_ENV === 'test') {
    return token.rawToken;
  }

  const displayName = user.name;
  if (mode === 'setup' || mode === 'invite') {
    await queueAccountSetupEmail(user.email, token.rawToken, displayName);
  } else {
    await queuePasswordResetEmail(user.email, token.rawToken, displayName);
  }

  return null;
};

const createManagedUser = async (payload, options = {}) => {
  const prepared = prepareUserData(payload);
  prepared.normalizedSubjects = prepared.normalizedRole === 'teacher'
    ? await normalizeSubjects(prepared.rawSubjects)
    : [];

  if (!prepared.normalizedIdentity.name || !prepared.normalizedEmail || (!prepared.normalizedPassword && !prepared.shouldSendInvite)) {
    const error = new Error('First name, last name, email, and either a password or setup invite are required');
    error.statusCode = 400;
    throw error;
  }

  if (prepared.normalizedRole === 'teacher' && !prepared.normalizedEmployeeId) {
    const error = new Error('Teacher accounts must include an employee ID');
    error.statusCode = 400;
    throw error;
  }

  if (prepared.normalizedRole === 'teacher') {
    prepared.normalizedAssignedBatches = await validateAssignedClasses(prepared.normalizedAssignedBatches);
    prepared.normalizedAssignedLabBatches = await validateAssignedLabBatches(prepared.normalizedAssignedLabBatches);
  }

  if (prepared.normalizedRole === 'admin' && !prepared.normalizedAdminId) {
    const error = new Error('Admin accounts must include an admin ID');
    error.statusCode = 400;
    throw error;
  }

  await ensureUserUniqueness(prepared);

  const salt = await bcrypt.genSalt(10);
  const effectivePassword = prepared.normalizedPassword || buildPlaceholderPassword();
  const hashed = await bcrypt.hash(effectivePassword, salt);
  const inviteMode = prepared.shouldSendInvite
    ? (prepared.normalizedPassword ? 'invite' : 'setup')
    : null;

  const user = await User.create({
    name: prepared.normalizedIdentity.name,
    firstName: prepared.normalizedIdentity.firstName,
    lastName: prepared.normalizedIdentity.lastName,
    email: prepared.normalizedEmail,
    password: hashed,
    role: prepared.normalizedRole,
    adminId: prepared.normalizedRole === 'admin' ? prepared.normalizedAdminId : undefined,
    employeeId: prepared.normalizedRole === 'teacher' ? prepared.normalizedEmployeeId : undefined,
    department: prepared.normalizedRole === 'teacher' ? prepared.normalizedDepartment : '',
    subjects: prepared.normalizedSubjects,
    batch: prepared.normalizedBatch,
    labBatch: '',
    assignedBatches: prepared.normalizedAssignedBatches,
    assignedLabBatches: prepared.normalizedAssignedLabBatches,
    enrollmentNo: prepared.normalizedEnrollment,
    isVerified: Boolean(prepared.normalizedPassword),
    verificationToken: null,
    isActive: true,
  });

  let passwordLinkToken = null;
  if (inviteMode) {
    try {
      passwordLinkToken = await issuePasswordAccessLink(user, inviteMode);
    } catch (error) {
      if (options.rollbackOnInviteFailure !== false) {
        await User.findByIdAndDelete(user._id);
      }
      const inviteError = new Error(inviteMode === 'setup'
        ? 'Failed to send setup email. User was not created.'
        : 'Failed to send invite email. User was not created.');
      inviteError.statusCode = 500;
      throw inviteError;
    }
  }

  return {
    user,
    passwordLinkToken,
    inviteMode,
    normalizedRole: prepared.normalizedRole,
  };
};

const createUser = async (req, res, next) => {
  try {
    const result = await createManagedUser(req.body);

    const response = {
      user: serializeUser(result.user),
      message: buildCreationMessage(result.normalizedRole, result.inviteMode),
    };

    if (result.passwordLinkToken) {
      response.inviteToken = result.passwordLinkToken;
    }

    res.status(201).json(response);
  } catch (err) {
    if (err.statusCode) {
      res.status(err.statusCode);
    }
    next(err);
  }
};

const bulkCreateUsers = async (req, res, next) => {
  try {
    const { users, temporaryPassword, sendInvite = false } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      res.status(400);
      throw new Error('Users must be a non-empty array');
    }

    if (users.length > MAX_BULK_USERS) {
      res.status(400);
      throw new Error(`Bulk import supports up to ${MAX_BULK_USERS} users per upload`);
    }

    const seenEmails = new Set();
    const seenEnrollments = new Set();
    const seenAdminIds = new Set();
    const seenEmployeeIds = new Set();
    const createdUsers = [];
    const errors = [];

    for (let index = 0; index < users.length; index += 1) {
      const row = users[index];
      const prepared = prepareUserData({ ...row, password: temporaryPassword, sendInvite });
      const rowNumber = index + 2;

      if (!prepared.normalizedIdentity.firstName || !prepared.normalizedIdentity.lastName || !prepared.normalizedEmail) {
        errors.push({ row: rowNumber, email: row?.email || '', message: 'First name, last name, and email are required' });
        continue;
      }

      if (seenEmails.has(prepared.normalizedEmail)) {
        errors.push({ row: rowNumber, email: prepared.normalizedEmail, message: 'Duplicate email in import file' });
        continue;
      }

      if (seenEnrollments.has(prepared.normalizedEnrollment)) {
        errors.push({ row: rowNumber, email: prepared.normalizedEmail, message: 'Duplicate enrollment number in import file' });
        continue;
      }

      if (prepared.normalizedRole === 'admin' && seenAdminIds.has(prepared.normalizedAdminId)) {
        errors.push({ row: rowNumber, email: prepared.normalizedEmail, message: 'Duplicate admin ID in import file' });
        continue;
      }

      if (prepared.normalizedRole === 'teacher' && seenEmployeeIds.has(prepared.normalizedEmployeeId)) {
        errors.push({ row: rowNumber, email: prepared.normalizedEmail, message: 'Duplicate employee ID in import file' });
        continue;
      }

      seenEmails.add(prepared.normalizedEmail);
      seenEnrollments.add(prepared.normalizedEnrollment);
      if (prepared.normalizedRole === 'admin' && prepared.normalizedAdminId) {
        seenAdminIds.add(prepared.normalizedAdminId);
      }
      if (prepared.normalizedRole === 'teacher' && prepared.normalizedEmployeeId) {
        seenEmployeeIds.add(prepared.normalizedEmployeeId);
      }

      try {
        const result = await createManagedUser({
          ...row,
          password: temporaryPassword,
          sendInvite,
        });

        createdUsers.push({
          row: rowNumber,
          user: serializeUser(result.user),
          inviteMode: result.inviteMode,
          passwordLinkToken: result.passwordLinkToken || undefined,
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          email: prepared.normalizedEmail,
          message: error.message,
        });
      }
    }

    const response = {
      createdCount: createdUsers.length,
      failedCount: errors.length,
      createdUsers,
      errors,
      message: `Bulk import finished. Created ${createdUsers.length} account(s) and failed ${errors.length}.`,
    };

    res.status(createdUsers.length > 0 ? 201 : 400).json(response);
  } catch (err) {
    next(err);
  }
};

const sendUserPasswordLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const mode = user.isVerified ? 'reset' : 'setup';
    const token = await issuePasswordAccessLink(user, mode);
    const response = {
      message: mode === 'setup'
        ? 'Account setup email sent successfully.'
        : 'Password reset email sent successfully.',
    };

    if (token) {
      response.resetToken = token;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ users: users.map(serializeUser) });
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['student', 'teacher', 'admin'].includes(role)) {
      res.status(400);
      throw new Error('Invalid role');
    }
    const user = await User.findById(id).select('-password');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (role === 'teacher') {
      user.assignedBatches = await validateAssignedClasses(user.assignedBatches);
      user.assignedLabBatches = await validateAssignedLabBatches(user.assignedLabBatches);
    }

    if (role === 'teacher' && !String(user.employeeId || '').trim()) {
      user.employeeId = buildEmployeeId();
    }

    if (role === 'admin' && !String(user.adminId || '').trim()) {
      user.adminId = buildAdminId();
    }

    user.role = role;
    if (role !== 'admin') {
      user.adminId = undefined;
    }
    if (role !== 'teacher') {
      user.employeeId = undefined;
      user.assignedLabBatches = [];
    }
    if (role !== 'student') {
      user.labBatch = '';
    }
    await user.save();
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
};

const updateUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const nextRole = ['student', 'teacher', 'admin'].includes(req.body.role) ? req.body.role : user.role;
    const normalizedIdentity = normalizeUserIdentity({
      name: req.body.name ?? user.name,
      firstName: req.body.firstName ?? user.firstName,
      lastName: req.body.lastName ?? user.lastName,
    });
    const nextEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : user.email;
    const nextEnrollmentNo = typeof req.body.enrollmentNo === 'string' && req.body.enrollmentNo.trim()
      ? req.body.enrollmentNo.trim().toUpperCase()
      : user.enrollmentNo;
    const nextAdminId = nextRole === 'admin'
      ? (normalizeRoleIdentifier(req.body.adminId) || normalizeRoleIdentifier(user.adminId))
      : '';
    const nextEmployeeId = nextRole === 'teacher'
      ? (normalizeRoleIdentifier(req.body.employeeId) || normalizeRoleIdentifier(user.employeeId))
      : '';

    if (!normalizedIdentity.name || !nextEmail) {
      res.status(400);
      throw new Error('First name, last name, and email are required');
    }

    if (nextEmail !== user.email) {
      const existingEmail = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (existingEmail) {
        res.status(409);
        throw new Error('User with this email already exists');
      }
    }

    if (nextEnrollmentNo !== user.enrollmentNo) {
      const existingEnrollment = await User.findOne({ enrollmentNo: nextEnrollmentNo, _id: { $ne: user._id } });
      if (existingEnrollment) {
        res.status(409);
        throw new Error('User with this enrollment number already exists');
      }
    }

    if (nextRole === 'admin' && !nextAdminId) {
      res.status(400);
      throw new Error('Admin accounts must include an admin ID');
    }

    if (nextRole === 'admin' && nextAdminId !== normalizeRoleIdentifier(user.adminId)) {
      const existingAdminId = await User.findOne({ adminId: nextAdminId, _id: { $ne: user._id } });
      if (existingAdminId) {
        res.status(409);
        throw new Error('User with this admin ID already exists');
      }
    }

    if (nextRole === 'teacher' && !nextEmployeeId) {
      res.status(400);
      throw new Error('Teacher accounts must include an employee ID');
    }

    if (nextRole === 'teacher' && nextEmployeeId !== normalizeRoleIdentifier(user.employeeId)) {
      const existingEmployeeId = await User.findOne({ employeeId: nextEmployeeId, _id: { $ne: user._id } });
      if (existingEmployeeId) {
        res.status(409);
        throw new Error('User with this employee ID already exists');
      }
    }

    const nextSubjects = nextRole === 'teacher'
      ? await normalizeSubjects(req.body.subjects ?? user.subjects)
      : [];
    const nextBatch = nextRole === 'student'
      ? normalizeBatchValue(req.body.class ?? req.body.batch ?? user.batch)
      : '';
    let nextAssignedBatches = nextRole === 'teacher'
      ? normalizeBatchList(req.body.assignedClasses ?? req.body.assignedBatches ?? user.assignedBatches)
      : [];
    let nextAssignedLabBatches = nextRole === 'teacher'
      ? normalizeAssignedLabBatchList(req.body.assignedLabBatches ?? user.assignedLabBatches)
      : [];
    const nextLabBatch = nextRole === 'student' && nextBatch === user.batch
      ? String(req.body.labBatch ?? user.labBatch ?? '').trim()
      : '';

    if (nextRole === 'teacher') {
      nextAssignedBatches = await validateAssignedClasses(nextAssignedBatches);
      nextAssignedLabBatches = await validateAssignedLabBatches(nextAssignedLabBatches);
    }

    user.firstName = normalizedIdentity.firstName;
    user.lastName = normalizedIdentity.lastName;
    user.name = normalizedIdentity.name;
    user.email = nextEmail;
    user.enrollmentNo = nextEnrollmentNo;
    user.role = nextRole;
    user.adminId = nextRole === 'admin' ? nextAdminId : undefined;
    user.employeeId = nextRole === 'teacher' ? nextEmployeeId : undefined;
    user.department = nextRole === 'teacher' ? String(req.body.department ?? user.department ?? '').trim() : '';
    user.subjects = nextSubjects;
    user.batch = nextBatch;
    user.labBatch = nextRole === 'student' ? nextLabBatch : '';
    user.assignedBatches = nextAssignedBatches;
    user.assignedLabBatches = nextAssignedLabBatches;

    await user.save();

    res.json({ user: serializeUser(user), message: 'User details updated successfully.' });
  } catch (err) {
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user._id) === String(id)) {
      res.status(400);
      throw new Error('You cannot delete your own account');
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Clean up related data
    const ExamAttempt = require('../models/examAttempt.model');
    const PerformanceAnalytics = require('../models/performanceAnalytics.model');
    const AnalyticsJob = require('../models/analyticsJob.model');
    const EmailJob = require('../models/emailJob.model');

    await Promise.all([
      ExamAttempt.deleteMany({ user: user._id }),
      PerformanceAnalytics.deleteMany({ userId: user._id }),
      AnalyticsJob.deleteMany({ userId: user._id }),
      EmailJob.deleteMany({ recipient: user.email }),
    ]);

    await User.findByIdAndDelete(id);

    res.json({ message: `User ${user.name} (${user.email}) has been permanently deleted.` });
  } catch (err) {
    next(err);
  }
};

module.exports = { createUser, bulkCreateUsers, getUsers, updateUserRole, updateUserDetails, toggleUserStatus, sendUserPasswordLink, deleteUser };
