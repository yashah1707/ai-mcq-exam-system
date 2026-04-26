const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const EmailJob = require('../src/models/emailJob.model');

async function listEmailJobs() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const jobs = await EmailJob.find({});
        console.log('\n--- Email Job List ---');
        console.table(jobs.map(j => ({
            recipient: j.recipient,
            type: j.type,
            status: j.status,
            createdAt: j.createdAt
        })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listEmailJobs();
