const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Question = require('../src/models/question.model');

async function run() {
    try {
        console.log('Connecting to', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        const count = await Question.countDocuments({ questionText: /Question regarding/ });
        console.log('Dummy Count in DB:', count);
        
        const exams = await mongoose.connection.collection('exams').find({}).toArray();
        console.log('Total Exams:', exams.length);
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
