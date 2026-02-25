/**
 * Migration Script: Add Negative Marking Fields
 * 
 * This script adds the new negative marking fields to existing database records:
 * - questions.negativeMarks (default: 0)
 * - exams.enableNegativeMarking (default: false)
 * 
 * Run this script once after deploying the negative marking feature.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const migrateNegativeMarking = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // Update questions collection
        const questionsResult = await db.collection('questions').updateMany(
            { negativeMarks: { $exists: false } },
            { $set: { negativeMarks: 0 } }
        );
        console.log(`✅ Updated ${questionsResult.modifiedCount} questions with negativeMarks field`);

        // Update exams collection
        const examsResult = await db.collection('exams').updateMany(
            { enableNegativeMarking: { $exists: false } },
            { $set: { enableNegativeMarking: false } }
        );
        console.log(`✅ Updated ${examsResult.modifiedCount} exams with enableNegativeMarking field`);

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrateNegativeMarking();
