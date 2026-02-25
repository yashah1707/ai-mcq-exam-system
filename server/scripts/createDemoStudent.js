const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../src/models/user.model');

async function createDemo() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const email = 'demo@student.com';
        const password = 'Demo123!';
        const enrollmentNo = 'DEMO001';

        // Check if exists
        let user = await User.findOne({ email });
        if (user) {
            console.log('Demo user already exists.');
            // Update password just in case
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.isVerified = true;
            await user.save();
            console.log('Password updated.');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = await User.create({
                name: 'Demo Student',
                email,
                password: hashedPassword,
                role: 'student',
                enrollmentNo,
                isVerified: true
            });
            console.log('Demo user created.');
        }

        console.log(`\n✅ Credentials:\nEmail: ${email}\nPassword: ${password}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createDemo();
