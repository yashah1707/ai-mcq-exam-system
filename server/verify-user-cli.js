const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const User = require('./src/models/user.model');

async function verifyUser() {
    const email = process.argv[2];
    if (!email) {
        console.error('Please provide an email address.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-mcq');

        const result = await User.updateOne(
            { email: email },
            { $set: { isVerified: true, verificationToken: null } }
        );

        if (result.matchedCount > 0) {
            console.log(`✅ User ${email} verified.`);
        } else {
            console.error(`❌ User ${email} not found.`);
            process.exit(1);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyUser();
