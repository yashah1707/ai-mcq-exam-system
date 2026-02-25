const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Exam = require('../src/models/exam.model');
const Question = require('../src/models/question.model');
const User = require('../src/models/user.model');

async function createSampleExam() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log('No admin found. Cannot create official exam.');
            process.exit(1);
        }

        // Fetch some DBMS questions
        const questions = await Question.find({ subject: 'DBMS' }).limit(5);
        if (questions.length < 5) {
            console.log('Not enough questions to create exam.');
            process.exit(1);
        }

        const examData = {
            title: 'Mid-Term DBMS Assessment',
            subject: 'DBMS',
            description: 'Official Mid-Term Examination for DBMS Module.',
            duration: 30,
            totalMarks: 5,
            passingMarks: 2,
            questions: questions.map(q => q._id),
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
            createdBy: admin._id,
            isActive: true,
            enableNegativeMarking: true
        };

        await Exam.create(examData);
        console.log('✅ Created Sample Standard Exam: "Mid-Term DBMS Assessment"');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createSampleExam();
