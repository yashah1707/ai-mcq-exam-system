const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true }, // Required for verification/password reset
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  enrollmentNo: { type: String, required: true, unique: true, trim: true, uppercase: true, default: function() { return (`AUTO${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).substring(2,6).toUpperCase()}`); } }, // PRIMARY KEY
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false }, // SRS requirement: email verification
  verificationToken: { type: String, default: null }, // For email verification
  resetPasswordToken: { type: String, default: null }, // For password reset
  resetPasswordExpires: { type: Date, default: null }, // Token expiration
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
