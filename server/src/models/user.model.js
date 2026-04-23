const mongoose = require('mongoose');
const { buildAdminId, buildEmployeeId, buildEnrollmentNo, normalizeRoleIdentifier, normalizeUserIdentity } = require('../utils/userIdentity');

const teacherLabBatchAssignmentSchema = new mongoose.Schema({
  className: { type: String, trim: true, default: '' },
  labBatchName: { type: String, trim: true, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true }, // Required for verification/password reset
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  adminId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  employeeId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
  department: { type: String, trim: true, default: '' },
  subjects: {
    type: [String],
    default: [],
  },
  batch: { type: String, trim: true, default: '' },
  labBatch: { type: String, trim: true, default: '' },
  assignedBatches: { type: [String], default: [] },
  assignedLabBatches: { type: [teacherLabBatchAssignmentSchema], default: [] },
  enrollmentNo: { type: String, required: true, unique: true, trim: true, uppercase: true, default: buildEnrollmentNo }, // PRIMARY KEY
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false }, // SRS requirement: email verification
  verificationToken: { type: String, default: null }, // Stores a hash of the email verification token
  resetPasswordToken: { type: String, default: null }, // Stores a hash of the password reset token
  resetPasswordExpires: { type: Date, default: null }, // Token expiration
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('validate', function syncNameFields(next) {
  const normalizedIdentity = normalizeUserIdentity({
    name: this.name,
    firstName: this.firstName,
    lastName: this.lastName,
  });

  this.name = normalizedIdentity.name;
  this.firstName = normalizedIdentity.firstName;
  this.lastName = normalizedIdentity.lastName;

  if (!this.enrollmentNo) {
    this.enrollmentNo = buildEnrollmentNo();
  }

  if (this.role === 'admin') {
    this.adminId = normalizeRoleIdentifier(this.adminId) || buildAdminId();
  } else {
    this.adminId = undefined;
  }

  if (this.role === 'teacher') {
    this.employeeId = normalizeRoleIdentifier(this.employeeId) || buildEmployeeId();
  } else {
    this.employeeId = undefined;
  }

  next();
});

module.exports = mongoose.model('User', userSchema);
