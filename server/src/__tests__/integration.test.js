const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let mongod;
let app;

const User = require('../models/user.model');

beforeAll(async () => {
  // Prefer an in-memory MongoDB when available; otherwise fall back to a local test DB.
  let mongoUri = process.env.MONGO_URI || '';
  try {
    // try to load mongodb-memory-server dynamically (may not be installed in some environments)
    // eslint-disable-next-line global-require
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
  } catch (e) {
    // mongodb-memory-server not available or failed — use local MongoDB test database
    mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-mcq-test';
    console.warn('mongodb-memory-server not available; using', mongoUri);
  }

  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

  // connect mongoose using the project's connectDB
  const connectDB = require('../config/db');
  await connectDB(mongoUri);

  // require the express app after DB is ready
  app = require('../app');
});

afterAll(async () => {
  try { await mongoose.connection.dropDatabase(); } catch (e) { /* ignore */ }
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
});

describe('API integration (auth, admin -> exam flow)', () => {
  test('registers and logs in a student', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test Student', email: 'student@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');

    const login = await request(app).post('/api/auth/login').send({ email: 'student@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('student@example.com');
  });

  test('admin creates question & exam; student can start, answer and submit', async () => {
    // create admin directly in DB
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: hashed, role: 'admin' });

    // admin login
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    // create question
    const qPayload = {
      questionText: '2+2? (test)',
      options: ['1','3','4','5'],
      correctAnswer: 2,
      category: 'Aptitude',
      difficulty: 'Easy',
      marks: 1
    };
    const qRes = await request(app).post('/api/questions').set('Authorization', `Bearer ${adminToken}`).send(qPayload);
    if (qRes.status !== 201) console.error('QUESTION CREATE ERROR', qRes.status, qRes.body);
    expect(qRes.status).toBe(201);
    const qId = qRes.body.question._id;

    // create exam with the question
    const now = new Date();
    const start = new Date(now.getTime() - 60*1000).toISOString();
    const end = new Date(now.getTime() + 10*60*1000).toISOString();
    const examPayload = { title: 'Test Exam', description: 'desc', duration: 5, totalMarks: 1, passingMarks: 1, questions: [qId], startDate: start, endDate: end };
    const exRes = await request(app).post('/api/exams').set('Authorization', `Bearer ${adminToken}`).send(examPayload);
    expect(exRes.status).toBe(201);
    const exam = exRes.body.exam;

    // register student and login
    const studRes = await request(app).post('/api/auth/register').send({ name: 'Stu', email: 'stu@test.com', password: 'pw12345' });
    expect(studRes.status).toBe(201);
    const studentToken = studRes.body.token;

    // start attempt
    const startRes = await request(app).post('/api/attempts/start').set('Authorization', `Bearer ${studentToken}`).send({ examId: exam._id });
    expect([200,201]).toContain(startRes.status);
    const attempt = startRes.body.attempt;

    // save answer
    const ansRes = await request(app).put(`/api/attempts/${attempt._id}/answer`).set('Authorization', `Bearer ${studentToken}`).send({ questionId: attempt.answers[0].questionId || attempt.answers[0].question, selectedOption: 2 });
    expect(ansRes.status).toBe(200);

    // submit
    const subRes = await request(app).post(`/api/attempts/${attempt._id}/submit`).set('Authorization', `Bearer ${studentToken}`).send();
    expect(subRes.status).toBe(200);
    expect(subRes.body.result.score).toBeGreaterThanOrEqual(0);
  });
});
