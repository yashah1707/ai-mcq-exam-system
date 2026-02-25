// Quick script to manually verify user account
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/user.model');

async function verifyUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'yashah1707@gmail.com';
        const result = await User.updateOne(
            { email: email },
            {
                $set: {
                    isVerified: true,
                    verificationToken: null
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`✅ User ${email} has been verified successfully!`);
        } else {
            console.log(`⚠️ User ${email} not found or already verified.`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyUser();
