const mongoose = require('mongoose');
require('dotenv').config();
const Question = require('../src/models/question.model');

const checkQuestions = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const count = await Question.countDocuments();
        console.log(`Total Questions in DB: ${count}`);

        if (count > 0) {
            const sample = await Question.findOne();
            console.log('Sample Question:', JSON.stringify(sample, null, 2));
        }

        const stats = await Question.aggregate([
            {
                $group: {
                    _id: { subject: "$subject", difficulty: "$difficulty" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.subject": 1, "_id.difficulty": 1 } }
        ]);

        console.log('Question Distribution:');
        stats.forEach(s => {
            console.log(`${s._id.subject} - ${s._id.difficulty}: ${s.count}`);
        });

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkQuestions();
