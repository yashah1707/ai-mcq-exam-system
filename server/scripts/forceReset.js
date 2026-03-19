const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../src/config/db');
const User = require('../src/models/user.model');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

(async () => {
    try {
        await connectDB(MONGO_URI);

        // --- Admin Reset ---
        const email = 'admin@example.com';
        const password = 'ChangeMe123!';

        let user = await User.findOne({ email });
        if (!user) {
            console.log('Admin user not found. Creating...');
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            user = await User.create({
                name: 'Administrator',
                email,
                password: hashed,
                role: 'admin',
                enrollmentNo: 'ADMIN001',
                isVerified: true
            });
        } else {
            console.log('Admin user found. Updating password...');
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            user.password = hashed;
            await user.save();
        }
        console.log('Admin Password updated successfully.');

        // --- Student Reset ---
        const studentEmail = 'student@example.com';
        let student = await User.findOne({ email: studentEmail });
        if (!student) {
            console.log('Student user not found. Creating...');
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            student = await User.create({
                name: 'Student User',
                email: studentEmail,
                password: hashed,
                role: 'student',
                enrollmentNo: 'STUDENT001',
                isVerified: true
            });
        } else {
            console.log('Student user found. Updating password...');
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            student.password = hashed;
            student.isVerified = true;
            await student.save();
        }
        console.log('Student Password updated successfully.');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
