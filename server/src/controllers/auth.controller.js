const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const register = async (req, res, next) => {
  try {
    let { name, email, password, role = 'student', enrollmentNo } = req.body;
    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email, and password are required');
    }

    // Auto-generate enrollmentNo for students if not provided (convenient for tests/dev)
    if (!enrollmentNo) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      enrollmentNo = `AUTO${Date.now().toString(36).toUpperCase().slice(-5)}${rand}`.toUpperCase();
    }

    // Prevent open admin registration unless explicitly allowed via env
    if (role === 'admin' && process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
      res.status(403);
      throw new Error('Admin registration is disabled');
    }

    // Check for duplicate enrollment number (primary key)
    const existingEnrollment = await User.findOne({ enrollmentNo: enrollmentNo.toUpperCase() });
    if (existingEnrollment) {
      res.status(409);
      throw new Error('User with this enrollment number already exists');
    }

    // Check for duplicate email (still need unique emails for verification)
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(409);
      throw new Error('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Generate verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name,
      email,
      password: hashed,
      role,
      enrollmentNo,
      verificationToken,
      isVerified: false // Require email verification for students
    });

    // Send verification email (only for students, admins are pre-verified)
    if (role === 'student') {
      try {
        const { sendVerificationEmail } = require('../services/email.service');
        await sendVerificationEmail(user.email, verificationToken, user.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails, but log it
      }
    } else {
      // Admins are automatically verified
      user.isVerified = true;
      user.verificationToken = null;
      await user.save();
    }

    // Only return token for verified users (admins)
    // Students must verify email first before they can login
    if (user.isVerified || process.env.NODE_ENV === 'test') {
      // In test mode, auto-verify to simplify integration tests
      if (!user.isVerified) {
        user.isVerified = true;
        user.verificationToken = null;
        await user.save();
      }

      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
      });

      res.status(201).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrollmentNo: user.enrollmentNo,
          isVerified: user.isVerified
        },
        token,
        message: 'Registration successful.'
      });
    } else {
      // Student registration - no token until verified
      res.status(201).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrollmentNo: user.enrollmentNo,
          isVerified: user.isVerified
        },
        message: 'Registration successful! Please check your email to verify your account before logging in.'
      });
    }
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error('Email/Enrollment number and password are required');
    }

    // Find user by email OR enrollment number
    const user = await User.findOne({
      $or: [
        { email: email },
        { enrollmentNo: email } // 'email' field can contain enrollment number
      ]
    });

    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    // Check if email is verified (only for students)
    if (user.role === 'student' && !user.isVerified) {
      res.status(403);
      throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        enrollmentNo: user.enrollmentNo,
        isVerified: user.isVerified
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };
