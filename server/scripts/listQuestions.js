const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Question = require('../src/models/question.model');

async function listQuestions() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-mcq-exam-system');
        console.log('Connected to DB');

        const questions = await Question.find({subject: 'DSA'}).limit(10);
        console.log('Questions:');
        questions.forEach((q, i) => {
            console.log(`${i+1}. ${q.questionText}`);
            console.log(`   Options: ${q.options.join(', ')}`);
            console.log(`   Correct: ${q.options[q.correctAnswer]}`);
            console.log(`   Subject: ${q.subject}, Topic: ${q.topic}, Difficulty: ${q.difficulty}`);
            console.log('');
        });

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

listQuestions();