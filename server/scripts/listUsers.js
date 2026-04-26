const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../src/models/user.model');

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await User.find({}, 'name email role isVerified enrollmentNo adminId employeeId isActive');
        console.log('\n--- User List ---');
        console.table(users.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role,
            verified: u.isVerified,
            enrollment: u.enrollmentNo || '-',
            adminId: u.adminId || '-',
            employeeId: u.employeeId || '-',
            active: u.isActive
        })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listUsers();
