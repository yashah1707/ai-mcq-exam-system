require('dotenv').config();
const mongoose = require('mongoose');
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');
const User = require('../src/models/user.model');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

const seedAnalytics = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected...');

        const email = 'user@example.com';
        let user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found. Creating test user...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);

            user = await User.create({
                name: 'Test Student',
                email: email,
                password: hashedPassword,
                role: 'student',
                enrollmentNo: 'TEST001',
                isVerified: true
            });
            console.log('Created test user: user@example.com / password123');
        } else {
            console.log(`Using existing user: ${user.name} (${user._id})`);
        }

        // clear existing analytics for this user
        await PerformanceAnalytics.deleteMany({ userId: user._id });

        const subjects = [
            { name: 'DBMS', topics: ['Normalization', 'Transactions', 'Indexing', 'SQL'] },
            { name: 'OS', topics: ['Process Scheduling', 'Deadlocks', 'Memory Management', 'Threads'] },
            { name: 'CN', topics: ['OSI Model', 'TCP/IP', 'Routing', 'Network Security'] },
            { name: 'DSA', topics: ['Arrays', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming'] },
            { name: 'Aptitude', topics: ['Time & Work', 'Probability', 'Permutations', 'Percentages'] }
        ];

        const analyticsData = [];

        for (const sub of subjects) {
            for (const topic of sub.topics) {
                // Random performance generation
                const totalAttempts = Math.floor(Math.random() * 20) + 5;
                // Weighted random for correct attempts to create some "WEAK" areas
                let accuracyTarget = Math.random(); // 0 to 1

                // Force some weak topics
                if (Math.random() < 0.3) accuracyTarget = 0.3; // 30% chance to be weak

                const correctAttempts = Math.floor(totalAttempts * accuracyTarget);
                const wrongAttempts = totalAttempts - correctAttempts;
                const accuracy = (correctAttempts / totalAttempts) * 100;

                analyticsData.push({
                    userId: user._id,
                    subject: sub.name,
                    topic: topic,
                    totalAttempts,
                    correctAttempts,
                    wrongAttempts,
                    unattemptedCount: 0,
                    accuracy,
                    avgTimeSeconds: Math.floor(Math.random() * 60) + 10,
                    lastAttemptDate: new Date()
                });
            }
        }

        await PerformanceAnalytics.insertMany(analyticsData);
        console.log(`Seeded ${analyticsData.length} analytics records for user ${user.email}.`);
        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedAnalytics();
