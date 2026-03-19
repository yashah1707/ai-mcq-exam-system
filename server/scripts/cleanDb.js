const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Question = require('../src/models/question.model');

async function clean() {
    try {
        console.log('Connecting to', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('Deleting all questions...');
        await Question.deleteMany({});
        
        console.log('Deleting all exams to clear cached questions...');
        await mongoose.connection.collection('exams').deleteMany({});
        
        console.log('Clean complete.');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
clean();
