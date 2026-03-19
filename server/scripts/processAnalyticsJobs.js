const mongoose = require('mongoose');
const path = require('path');

// Load app config to connect DB (server/src/config/db.js)
const dbConfig = require('../src/config/db');
const AnalyticsJob = require('../src/models/analyticsJob.model');
const PerformanceAnalyticsController = require('../src/controllers/performanceAnalytics.controller');

async function connectDb() {
  await dbConfig.connect();
}

async function processOne(job) {
  try {
    await AnalyticsJob.findByIdAndUpdate(job._id, { status: 'processing' });
    await PerformanceAnalyticsController.updatePerformanceMetrics(job.userId, job.attemptId);
    await AnalyticsJob.findByIdAndUpdate(job._id, { status: 'done' });
    console.log('Processed analytics job', job._id.toString());
  } catch (err) {
    console.error('Job failed', job._id.toString(), err.message);
    await AnalyticsJob.findByIdAndUpdate(job._id, { status: 'failed', error: err.message });
  }
}

async function workerLoop() {
  while (true) {
    try {
      const job = await AnalyticsJob.findOneAndUpdate({ status: 'pending' }, { status: 'processing' }, { sort: { createdAt: 1 }, new: true });
      if (job) {
        await processOne(job);
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error('Worker error', err);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  console.log('Starting analytics job worker...');
  await connectDb();
  const AnalyticsJobModel = require('../src/models/analyticsJob.model');
  global.AnalyticsJob = AnalyticsJobModel;
  await workerLoop();
}

main().catch(err => { console.error('Worker fatal', err); process.exit(1); });
