const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/user.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        // Remove any existing student with this email or enrollment
        await User.deleteOne({ email: 'student@example.com' });
        await User.deleteOne({ enrollmentNo: 'STU001' });
        console.log('Cleared old student');

        const hashed = await bcrypt.hash('Student123!', 10);
        const student = await User.create({
            name: 'Test Student',
            email: 'student@example.com',
            password: hashed,
            role: 'student',
            enrollmentNo: 'STU001',
            isVerified: true,
            verificationToken: null,
        });
        console.log('Student created:', student.email, '| enrollmentNo:', student.enrollmentNo, '| isVerified:', student.isVerified);
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
