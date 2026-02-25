/*
  Run this script to create an initial admin account from environment variables.
  Usage: npm run seed:admin
  Requires in .env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
*/
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

(async () => {
  try {
    await connectDB(MONGO_URI);

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Administrator';

    if (!email || !password) {
      console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment to seed admin.');
      process.exit(1);
    }

    let user = await User.findOne({ email });
    if (user) {
      console.log('Admin already exists:', email);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    user = await User.create({
      name,
      email,
      password: hashed,
      role: 'admin',
      enrollmentNo: 'ADMIN001', // Dummy enrollment number for admin
      isVerified: true // Admin is pre-verified
    });
    console.log('Seeded admin:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin:', err.message);
    process.exit(1);
  }
})();
