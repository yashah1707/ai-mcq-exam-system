const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Question = require('../src/models/question.model');

const questions = [
    // DBMS - SQL - Easy
    { questionText: 'What does SQL stand for?', options: ['Structured Query Language', 'Simple Question Language', 'Strong Query Language', 'Structured Question Language'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Easy', topic: 'SQL', marks: 1, createdBy: new mongoose.Types.ObjectId() },
    { questionText: 'Which command is used to select data?', options: ['SELECT', 'GET', 'OPEN', 'FETCH'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Easy', topic: 'SQL', marks: 1, createdBy: new mongoose.Types.ObjectId() },

    // DBMS - SQL - Medium
    { questionText: 'Which keyword is used to sort results?', options: ['ORDER BY', 'SORT BY', 'GROUP BY', 'ALIGN BY'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Medium', topic: 'SQL', marks: 2, createdBy: new mongoose.Types.ObjectId() },
    { questionText: 'Which join returns all rows from both tables?', options: ['FULL OUTER JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Medium', topic: 'SQL', marks: 2, createdBy: new mongoose.Types.ObjectId() },

    // DBMS - Normalization - Hard
    { questionText: '3NF requires that a relation is in 2NF and has no...', options: ['Transitive Dependencies', 'Partial Dependencies', 'Multi-valued Dependencies', 'Repeating Groups'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Hard', topic: 'Normalization', marks: 3, createdBy: new mongoose.Types.ObjectId() },
    { questionText: 'BCNF is a stricter form of...', options: ['3NF', '2NF', '1NF', '4NF'], correctAnswer: 0, category: 'Technical', subject: 'DBMS', difficulty: 'Hard', topic: 'Normalization', marks: 3, createdBy: new mongoose.Types.ObjectId() },

    // Aptitude - Logical - Easy
    { questionText: 'What comes next: 2, 4, 6, ...?', options: ['8', '9', '10', '7'], correctAnswer: 0, category: 'Aptitude', subject: 'Aptitude', difficulty: 'Easy', topic: 'Series', marks: 1, createdBy: new mongoose.Types.ObjectId() },
    { questionText: 'If A=1, B=2, C=3, what is D?', options: ['4', '5', '3', '6'], correctAnswer: 0, category: 'Aptitude', subject: 'Aptitude', difficulty: 'Easy', topic: 'Series', marks: 1, createdBy: new mongoose.Types.ObjectId() }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        await Question.deleteMany({}); // Clear existing to avoid dupes/mess
        console.log('Cleared Questions');

        await Question.insertMany(questions);
        console.log(`Seeded ${questions.length} questions`);

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

seed();
