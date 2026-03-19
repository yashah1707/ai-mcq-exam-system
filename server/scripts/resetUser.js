const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../src/models/user.model');

const resetUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const users = [
            {
                name: "Demo Student",
                email: "student@example.com",
                password: hashedPassword,
                role: "student",
                enrollmentNo: "STUDENT001",
                isVerified: true,
                isActive: true
            },
            {
                name: "Demo Admin",
                email: "admin@example.com",
                password: hashedPassword,
                role: "admin",
                enrollmentNo: "ADMIN001",
                isVerified: true,
                isActive: true
            }
        ];

        for (const u of users) {
            let user = await User.findOne({ email: u.email });
            if (user) {
                user.password = u.password;
                user.isVerified = true;
                user.enrollmentNo = u.enrollmentNo; // Update enrollment just in case
                await user.save();
                console.log(`Updated user: ${u.email}`);
            } else {
                // Check if enrollment exists (might be different email)
                const existingEnrollment = await User.findOne({ enrollmentNo: u.enrollmentNo });
                if (existingEnrollment) {
                    await User.deleteOne({ _id: existingEnrollment._id }); // Delete conflict
                    console.log(`Deleted conflict for enrollment: ${u.enrollmentNo}`);
                }

                await User.create(u);
                console.log(`Created user: ${u.email}`);
            }
        }

        console.log('User reset complete.');
        process.exit();
    } catch (error) {
        console.error('Error resetting users:', error);
        process.exit(1);
    }
};

resetUsers();
