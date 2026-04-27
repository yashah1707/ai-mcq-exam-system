const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const EmailJob = require('../src/models/emailJob.model');
const EmailService = require('../src/services/email.service');

async function connectDb() {
  await connectDB(process.env.MONGO_URI);
}

async function processOne(job) {
  try {
    // Process the job using EmailService
    await EmailService.processEmailJob(job);
    
    await EmailJob.findByIdAndUpdate(job._id, { status: 'done' });
    console.log(`[${new Date().toISOString()}] Sent email to ${job.recipient} (Type: ${job.type})`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Email job failed for ${job.recipient}:`, err.message);
    await EmailJob.findByIdAndUpdate(job._id, { status: 'failed', lastError: err.message });
  }
}

async function workerLoop() {
  while (true) {
    try {
      const job = await EmailJob.findOneAndUpdate(
        { status: 'pending' },
        { status: 'processing' },
        { sort: { createdAt: 1 }, new: true }
      );
      
      if (job) {
        await processOne(job);
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s if no jobs
      }
    } catch (err) {
      console.error('Email Worker error:', err);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

async function main() {
  console.log('--- Email Job Worker Starting ---');
  await connectDb();
  console.log('Connected to Database. Waiting for jobs...');
  await workerLoop();
}

main().catch(err => {
  console.error('Email Worker fatal error:', err);
  process.exit(1);
});
