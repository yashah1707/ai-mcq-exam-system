const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let mongod;
let app;

const User = require('../models/user.model');
const Question = require('../models/question.model');
const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const ExamAttempt = require('../models/examAttempt.model');
const AcademicClass = require('../models/academicClass.model');

beforeAll(async () => {
  let mongoUri = process.env.MONGO_URI || '';

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
  } catch (error) {
    mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai-mcq-lifecycle-test';
  }

  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

  const connectDB = require('../config/db');
  await connectDB(mongoUri);
  app = require('../app');
});

afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
  } catch (error) {
    // ignore cleanup failures
  }

  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Question.deleteMany({}),
    PerformanceAnalytics.deleteMany({}),
    AcademicClass.deleteMany({}),
  ]);
});

const createUserAndLogin = async ({
  name,
  email,
  password,
  role = 'student',
  enrollmentNo,
  isVerified = true,
  subjects = [],
  assignedBatches = [],
}) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    enrollmentNo,
    isVerified,
    subjects,
    assignedBatches,
    batch: role === 'student' ? assignedBatches[0] || '' : '',
  });

  const loginResponse = await request(app).post('/api/auth/login').send({ email, password });
  return {
    token: loginResponse.body.token,
    loginResponse,
  };
};

const createQuestionAndExam = async ({ adminToken, subject = 'DBMS' }) => {
  const questionResponse = await request(app)
    .post('/api/questions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      questionText: `${subject} lifecycle question`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      category: subject === 'Aptitude' ? 'Aptitude' : 'Technical',
      difficulty: 'Easy',
      marks: 1,
      negativeMarks: 0,
      explanation: 'Lifecycle test',
      subject,
      topic: 'Basics',
    });

  const now = Date.now();
  const examResponse = await request(app)
    .post('/api/exams')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: `${subject} Lifecycle Exam`,
      subject,
      description: 'Exam lifecycle test',
      duration: 30,
      totalMarks: 1,
      passingMarks: 1,
      questions: [questionResponse.body.question._id],
      startDate: new Date(now - 60000).toISOString(),
      endDate: new Date(now + 3600000).toISOString(),
      isActive: true,
      enableNegativeMarking: false,
    });

  return {
    questionId: questionResponse.body.question._id,
    exam: examResponse.body.exam,
  };
};

describe('Exam lifecycle regression coverage', () => {
  test('started exams are locked against destructive edits and deletes', async () => {
    const admin = await createUserAndLogin({
      name: 'Lifecycle Admin',
      email: 'lifecycle.admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      enrollmentNo: 'LIFEADMIN001',
    });
    const student = await createUserAndLogin({
      name: 'Lifecycle Student',
      email: 'lifecycle.student@test.com',
      password: 'StudentPass123!',
      role: 'student',
      enrollmentNo: 'LIFESTUDENT001',
    });

    const { exam } = await createQuestionAndExam({ adminToken: admin.token });

    const startResponse = await request(app)
      .post('/api/attempts/start')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ examId: exam._id });

    expect(startResponse.status).toBe(201);

    const updateBlocked = await request(app)
      .put(`/api/exams/${exam._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Changed After Start' });

    expect(updateBlocked.status).toBe(409);

    const deactivateAllowed = await request(app)
      .put(`/api/exams/${exam._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });

    expect(deactivateAllowed.status).toBe(200);
    expect(deactivateAllowed.body.exam.isActive).toBe(false);

    const deleteBlocked = await request(app)
      .delete(`/api/exams/${exam._id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(deleteBlocked.status).toBe(409);
  });

  test('students can cancel an in-progress attempt and restart the exam', async () => {
    const admin = await createUserAndLogin({
      name: 'Cancel Admin',
      email: 'cancel.admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      enrollmentNo: 'CANCELADMIN001',
    });
    const student = await createUserAndLogin({
      name: 'Cancel Student',
      email: 'cancel.student@test.com',
      password: 'StudentPass123!',
      role: 'student',
      enrollmentNo: 'CANCELSTUDENT001',
    });

    const { exam } = await createQuestionAndExam({ adminToken: admin.token });

    const firstStart = await request(app)
      .post('/api/attempts/start')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ examId: exam._id });

    expect(firstStart.status).toBe(201);

    const cancelResponse = await request(app)
      .post(`/api/attempts/${firstStart.body.attempt._id}/cancel`)
      .set('Authorization', `Bearer ${student.token}`);

    expect(cancelResponse.status).toBe(200);

    const restartResponse = await request(app)
      .post('/api/attempts/start')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ examId: exam._id });

    expect(restartResponse.status).toBe(201);
    expect(restartResponse.body.attempt._id).not.toBe(firstStart.body.attempt._id);
  });

  test('teachers can view drill-down analytics only for managed students and assigned subjects', async () => {
    const teacher = await createUserAndLogin({
      name: 'Analytics Teacher',
      email: 'analytics.teacher@test.com',
      password: 'TeacherPass123!',
      role: 'teacher',
      enrollmentNo: 'ANATEACH001',
      subjects: ['DBMS'],
      assignedBatches: ['2026-A'],
    });

    const studentSalt = await bcrypt.genSalt(10);
    const studentPassword = await bcrypt.hash('StudentPass123!', studentSalt);
    const student = await User.create({
      name: 'Scoped Student',
      email: 'scoped.student@test.com',
      password: studentPassword,
      role: 'student',
      enrollmentNo: 'ANASTUDENT001',
      isVerified: true,
      batch: '2026-A',
    });

    await PerformanceAnalytics.create([
      {
        userId: student._id,
        subject: 'DBMS',
        topic: 'Normalization',
        totalAttempts: 6,
        correctAttempts: 4,
        wrongAttempts: 2,
        accuracy: 66.67,
        strengthLevel: 'Average',
      },
      {
        userId: student._id,
        subject: 'OS',
        topic: 'Scheduling',
        totalAttempts: 6,
        correctAttempts: 1,
        wrongAttempts: 5,
        accuracy: 16.67,
        strengthLevel: 'Weak',
      },
    ]);

    const analyticsResponse = await request(app)
      .get(`/api/analytics/student/${student._id}`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.data).toHaveLength(1);
    expect(analyticsResponse.body.data[0]._id).toBe('DBMS');
  });

  test('teachers can list and reset active attempts for their own exam', async () => {
    const teacher = await createUserAndLogin({
      name: 'Attempt Teacher',
      email: 'attempt.teacher@test.com',
      password: 'TeacherPass123!',
      role: 'teacher',
      enrollmentNo: 'ATTEMPTTEACH001',
      subjects: ['DBMS'],
      assignedBatches: ['2026-A'],
    });
    const student = await createUserAndLogin({
      name: 'Attempt Student',
      email: 'attempt.student@test.com',
      password: 'StudentPass123!',
      role: 'student',
      enrollmentNo: 'ATTEMPTSTUDENT001',
    });

    const questionResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        questionText: 'Teacher attempt operations question',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
        category: 'Technical',
        difficulty: 'Easy',
        marks: 1,
        negativeMarks: 0,
        explanation: 'Attempt ops test',
        subject: 'DBMS',
        topic: 'Transactions',
      });

    const now = Date.now();
    await AcademicClass.create({
      name: '2026-A',
      year: 1,
      course: 'GENERAL',
      capacity: 60,
      description: 'Teacher attempt operations class',
      labBatches: [],
    });

    const examResponse = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        title: 'Teacher Attempt Ops Exam',
        subject: 'DBMS',
        description: 'Teacher-managed attempt operations exam',
        duration: 30,
        totalMarks: 1,
        passingMarks: 1,
        questions: [questionResponse.body.question._id],
        assignedClasses: ['2026-A'],
        startDate: new Date(now - 60000).toISOString(),
        endDate: new Date(now + 3600000).toISOString(),
        isActive: true,
        enableNegativeMarking: false,
      });

    expect(examResponse.status).toBe(201);

    await User.updateOne({ email: 'attempt.student@test.com' }, { $set: { batch: '2026-A' } });

    const startResponse = await request(app)
      .post('/api/attempts/start')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ examId: examResponse.body.exam._id });

    expect(startResponse.status).toBe(201);

    const activeAttemptsResponse = await request(app)
      .get(`/api/attempts/exam/${examResponse.body.exam._id}/active`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(activeAttemptsResponse.status).toBe(200);
    expect(activeAttemptsResponse.body.attempts).toHaveLength(1);
    expect(activeAttemptsResponse.body.attempts[0].user.email).toBe('attempt.student@test.com');

    const resetResponse = await request(app)
      .post(`/api/attempts/${startResponse.body.attempt._id}/reset`)
      .set('Authorization', `Bearer ${teacher.token}`);

    expect(resetResponse.status).toBe(200);
    const remainingAttempts = await ExamAttempt.countDocuments({ exam: examResponse.body.exam._id, status: 'in-progress' });
    expect(remainingAttempts).toBe(0);
  });
});