const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Exam = require('../src/models/exam.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_mcq_exam_system';

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        // Extend endDate for ALL exams to 30 days from now and ensure isActive = true
        const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const result = await Exam.updateMany(
            {},
            { $set: { endDate: future, isActive: true } }
        );
        console.log(`Updated ${result.modifiedCount} exams — endDate extended to ${future.toISOString()}`);

        // List all exams
        const exams = await Exam.find({}, 'title subject isActive startDate endDate questions');
        exams.forEach(e => {
            console.log(`- "${e.title}" | subject: ${e.subject} | active: ${e.isActive} | questions: ${e.questions.length} | ends: ${e.endDate}`);
        });

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
})();
