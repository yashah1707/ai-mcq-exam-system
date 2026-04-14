const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let mongod;
let app;

const User = require('../models/user.model');
const AnalyticsJob = require('../models/analyticsJob.model');
const Exam = require('../models/exam.model');
const AcademicClass = require('../models/academicClass.model');

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
  test('blocks public self-registration', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test Student', email: 'student@example.com', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/self-signup is disabled/i);
  });

  test('admin creates question & exam; student can start, answer and submit', async () => {
    // create admin directly in DB
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    const admin = await User.create({ name: 'Admin', email: 'admin@test.com', password: hashed, role: 'admin' });

    // admin login
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.headers['set-cookie']).toBeTruthy();
    const adminToken = adminLogin.body.token;

    // create question
    const qPayload = {
      questionText: '2+2? (test)',
      options: ['1','3','4','5'],
      correctAnswer: 2,
      category: 'Aptitude',
      subject: 'Aptitude',
      topic: 'Arithmetic',
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
    const examPayload = {
      title: 'Test Exam',
      subject: 'Aptitude',
      description: 'desc',
      duration: 5,
      totalMarks: 1,
      passingMarks: 1,
      questions: [qId],
      startDate: start,
      endDate: end
    };
    const exRes = await request(app).post('/api/exams').set('Authorization', `Bearer ${adminToken}`).send(examPayload);
    expect(exRes.status).toBe(201);
    const exam = exRes.body.exam;

    // admin creates student and student logs in
    const studRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Stu', email: 'stu@test.com', password: 'pw12345', enrollmentNo: 'STUTEST001', role: 'student', batch: '2026-A' });
    expect(studRes.status).toBe(201);
    const studentLogin = await request(app).post('/api/auth/login').send({ email: 'stu@test.com', password: 'pw12345' });
    expect(studentLogin.status).toBe(200);
    const studentToken = studentLogin.body.token;

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

    const analyticsJobs = await AnalyticsJob.find({ attemptId: attempt._id });
    expect(analyticsJobs).toHaveLength(1);
  });

  test('student exam listing hides adaptive practice exams and direct exam fetch rejects them', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    const studentPassword = await bcrypt.hash('studentpass', salt);

    const admin = await User.create({ name: 'Exam Admin', email: 'examadmin@test.com', password: adminPassword, role: 'admin' });
    const student = await User.create({ name: 'Adaptive Student', email: 'adaptivestudent@test.com', password: studentPassword, role: 'student', enrollmentNo: 'ADAPT001', batch: '2026-A', isVerified: true });

    const standardExam = await Exam.create({
      title: 'Standard Visible Exam',
      examType: 'standard',
      subject: 'Aptitude',
      description: 'Visible to students',
      duration: 10,
      totalMarks: 5,
      passingMarks: 2,
      questions: [],
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 600000),
      isActive: true,
      createdBy: admin._id,
    });

    const adaptiveExam = await Exam.create({
      title: 'Adaptive Test - Hidden',
      examType: 'adaptive',
      subject: 'Aptitude',
      description: 'Practice only',
      duration: 20,
      totalMarks: 10,
      passingMarks: 4,
      questions: [],
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 600000),
      isActive: true,
      createdBy: student._id,
    });

    const studentLogin = await request(app).post('/api/auth/login').send({ email: 'adaptivestudent@test.com', password: 'studentpass' });
    expect(studentLogin.status).toBe(200);

    const examsRes = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentLogin.body.token}`);

    expect(examsRes.status).toBe(200);
    expect(examsRes.body.exams.map((exam) => exam.title)).toContain('Standard Visible Exam');
    expect(examsRes.body.exams.map((exam) => exam.title)).not.toContain('Adaptive Test - Hidden');

    const adaptiveFetch = await request(app)
      .get(`/api/exams/${adaptiveExam._id}`)
      .set('Authorization', `Bearer ${studentLogin.body.token}`);

    expect(adaptiveFetch.status).toBe(404);

    const adaptiveStart = await request(app)
      .post('/api/attempts/start')
      .set('Authorization', `Bearer ${studentLogin.body.token}`)
      .send({ examId: adaptiveExam._id });

    expect(adaptiveStart.status).toBe(400);
  });

  test('admin can create theory classes, assign students, and create lab batches', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({
      name: 'Class Admin',
      email: 'classadmin@test.com',
      password: adminPassword,
      role: 'admin',
      adminId: 'ADM-CLASS',
      isVerified: true,
    });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'classadmin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const studentOne = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Theory', lastName: 'One', email: 'theory.one@test.com', enrollmentNo: 'THEORY001', password: 'StudentPass123!', role: 'student', batch: '2026-A' });
    const studentTwo = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Theory', lastName: 'Two', email: 'theory.two@test.com', enrollmentNo: 'THEORY002', password: 'StudentPass123!', role: 'student', batch: '2026-B' });

    expect(studentOne.status).toBe(201);
    expect(studentTwo.status).toBe(201);

    const createClassRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TY-AIA-9', capacity: 60, description: 'Theory class for final year students' });

    expect(createClassRes.status).toBe(201);
    expect(createClassRes.body.class.name).toBe('TY-AIA-9');

    const classId = createClassRes.body.class._id;

    const assignStudentsRes = await request(app)
      .post(`/api/classes/${classId}/assign-students`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [studentOne.body.user._id, studentTwo.body.user._id] });

    expect(assignStudentsRes.status).toBe(200);
    expect(assignStudentsRes.body.students.find((student) => student._id === studentOne.body.user._id).batch).toBe('TY-AIA-9');
    expect(assignStudentsRes.body.students.find((student) => student._id === studentTwo.body.user._id).batch).toBe('TY-AIA-9');

    const createLabBatchRes = await request(app)
      .post(`/api/classes/${classId}/lab-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch A', capacity: 20 });

    expect(createLabBatchRes.status).toBe(201);
    expect(createLabBatchRes.body.class.labBatches.map((entry) => entry.name)).toContain('Batch A');

    const assignLabBatchRes = await request(app)
      .post(`/api/classes/${classId}/assign-lab-batch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labBatchName: 'Batch A', studentIds: [studentOne.body.user._id] });

    expect(assignLabBatchRes.status).toBe(200);
    expect(assignLabBatchRes.body.students.find((student) => student._id === studentOne.body.user._id).labBatch).toBe('Batch A');
    expect(assignLabBatchRes.body.students.find((student) => student._id === studentTwo.body.user._id).labBatch).toBe('');

    const storedClass = await AcademicClass.findById(classId);
    expect(storedClass).not.toBeNull();
    expect(storedClass.labBatches).toHaveLength(1);
  });

  test('admin can bulk assign students to a class by enrollment number with row-level failures', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({
      name: 'Bulk Assign Admin',
      email: 'bulk.assign.admin@test.com',
      password: adminPassword,
      role: 'admin',
      adminId: 'ADM-BULK-CLASS',
      isVerified: true,
    });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'bulk.assign.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const studentOne = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Bulk', lastName: 'One', email: 'bulk.one@test.com', enrollmentNo: 'BULK001', password: 'StudentPass123!', role: 'student' });
    const studentTwo = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Bulk', lastName: 'Two', email: 'bulk.two@test.com', enrollmentNo: 'BULK002', password: 'StudentPass123!', role: 'student' });
    const studentThree = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Bulk', lastName: 'Three', email: 'bulk.three@test.com', enrollmentNo: 'BULK003', password: 'StudentPass123!', role: 'student' });

    expect(studentOne.status).toBe(201);
    expect(studentTwo.status).toBe(201);
    expect(studentThree.status).toBe(201);

    const createClassRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'CSV-CLASS-A', capacity: 3, description: 'CSV assignment class' });

    expect(createClassRes.status).toBe(201);
    const classId = createClassRes.body.class._id;

    const createLabBatchRes = await request(app)
      .post(`/api/classes/${classId}/lab-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch A', capacity: 1 });

    expect(createLabBatchRes.status).toBe(201);

    const bulkAssignRes = await request(app)
      .post(`/api/classes/${classId}/bulk-assign-students`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send([
        { enrollmentNo: 'BULK001', labBatch: 'Batch A' },
        { enrollmentNo: 'BULK002', labBatch: '' },
        { enrollmentNo: 'BULK001', labBatch: '' },
        { enrollmentNo: 'UNKNOWN001', labBatch: '' },
        { enrollmentNo: 'BULK003', labBatch: 'Batch A' },
      ]);

    expect(bulkAssignRes.status).toBe(200);
    expect(bulkAssignRes.body.assignedCount).toBe(2);
    expect(bulkAssignRes.body.failedCount).toBe(3);
    expect(bulkAssignRes.body.errors.map((entry) => entry.message)).toContain('Duplicate enrollment number in import file');
    expect(bulkAssignRes.body.errors.map((entry) => entry.message)).toContain('Student not found');
    expect(bulkAssignRes.body.errors.map((entry) => entry.message)).toContain('This assignment exceeds the lab batch capacity of 1');

    const refreshedStudents = await User.find({ enrollmentNo: { $in: ['BULK001', 'BULK002', 'BULK003'] } }).sort({ enrollmentNo: 1 });
    expect(refreshedStudents[0].batch).toBe('CSV-CLASS-A');
    expect(refreshedStudents[0].labBatch).toBe('Batch A');
    expect(refreshedStudents[1].batch).toBe('CSV-CLASS-A');
    expect(refreshedStudents[1].labBatch).toBe('');
    expect(refreshedStudents[2].batch).toBe('');
    expect(refreshedStudents[2].labBatch).toBe('');
  });

  test('login establishes a cookie-backed session and auth me returns the signed-in user', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('cookiepass', salt);
    await User.create({ name: 'Cookie Admin', firstName: 'Cookie', lastName: 'Admin', email: 'cookie@test.com', password: hashed, role: 'admin', isVerified: true });

    const loginRes = await request(app).post('/api/auth/login').send({ email: 'cookie@test.com', password: 'cookiepass' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['set-cookie']).toBeTruthy();

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginRes.headers['set-cookie']);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('cookie@test.com');
  });

  test('admin accounts can be created with adminId and sign in using that admin ID', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await User.create({
      name: 'Root Admin',
      firstName: 'Root',
      lastName: 'Admin',
      email: 'root.admin@test.com',
      password: hashed,
      role: 'admin',
      adminId: 'ADM-ROOT',
      isVerified: true,
    });

    const rootLogin = await request(app).post('/api/auth/login').send({ email: 'root.admin@test.com', password: 'adminpass' });
    expect(rootLogin.status).toBe(200);

    const createAdminRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${rootLogin.body.token}`)
      .send({
        firstName: 'Second',
        lastName: 'Admin',
        email: 'second.admin@test.com',
        password: 'AdminPass123!',
        role: 'admin',
        adminId: 'ADM-SECOND',
      });

    expect(createAdminRes.status).toBe(201);
    expect(createAdminRes.body.user.adminId).toBe('ADM-SECOND');

    const adminIdLogin = await request(app).post('/api/auth/login').send({ email: 'ADM-SECOND', password: 'AdminPass123!' });
    expect(adminIdLogin.status).toBe(200);
    expect(adminIdLogin.body.user.adminId).toBe('ADM-SECOND');
  });

  test('teacher accounts can be created with employeeId and sign in using that employee ID', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await AcademicClass.create({ name: 'TY-AIA-11', capacity: 60, description: 'Teacher assignment class' });
    await User.create({
      name: 'Teacher Root Admin',
      firstName: 'Teacher',
      lastName: 'Root',
      email: 'teacher.root.admin@test.com',
      password: hashed,
      role: 'admin',
      adminId: 'ADM-TEACHROOT',
      isVerified: true,
    });

    const rootLogin = await request(app).post('/api/auth/login').send({ email: 'teacher.root.admin@test.com', password: 'adminpass' });
    expect(rootLogin.status).toBe(200);

    const createTeacherRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${rootLogin.body.token}`)
      .send({
        firstName: 'Login',
        lastName: 'Teacher',
        email: 'login.teacher@test.com',
        password: 'TeacherPass123!',
        role: 'teacher',
        enrollmentNo: 'TEACHLOGIN001',
        employeeId: 'EMP-LOGIN',
        department: 'Computer Science',
        subjects: ['DBMS'],
        assignedBatches: ['TY-AIA-11'],
      });

    expect(createTeacherRes.status).toBe(201);
    expect(createTeacherRes.body.user.employeeId).toBe('EMP-LOGIN');

    const employeeIdLogin = await request(app).post('/api/auth/login').send({ email: 'EMP-LOGIN', password: 'TeacherPass123!' });
    expect(employeeIdLogin.status).toBe(200);
    expect(employeeIdLogin.body.user.employeeId).toBe('EMP-LOGIN');
  });

  test('class and lab batch edits propagate to teachers and students, and deletes clear assignments', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({
      name: 'Edit Class Admin',
      email: 'edit.class.admin@test.com',
      password: adminPassword,
      role: 'admin',
      adminId: 'ADM-EDITCLASS',
      isVerified: true,
    });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'edit.class.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const createClassRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TY-AIA-10', capacity: 60, description: 'Original theory class' });

    expect(createClassRes.status).toBe(201);
    const classId = createClassRes.body.class._id;

    const createLabBatchRes = await request(app)
      .post(`/api/classes/${classId}/lab-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch A', capacity: 20 });

    expect(createLabBatchRes.status).toBe(201);
    const labBatchId = createLabBatchRes.body.class.labBatches[0]._id;

    const createTeacherRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Assigned',
        lastName: 'Teacher',
        email: 'assigned.teacher@test.com',
        password: 'TeacherPass123!',
        role: 'teacher',
        enrollmentNo: 'TEACHASSIGN001',
        employeeId: 'EMP-ASSIGN',
        department: 'Computer Science',
        subjects: ['DBMS'],
        assignedBatches: ['TY-AIA-10'],
        assignedLabBatches: [{ className: 'TY-AIA-10', labBatchName: 'Batch A' }],
      });

    expect(createTeacherRes.status).toBe(201);

    const createStudentRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Assigned',
        lastName: 'Student',
        email: 'assigned.student@test.com',
        enrollmentNo: 'STUASSIGN001',
        password: 'StudentPass123!',
        role: 'student',
        batch: 'TEMP-CLASS',
      });

    expect(createStudentRes.status).toBe(201);

    const assignStudentRes = await request(app)
      .post(`/api/classes/${classId}/assign-students`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [createStudentRes.body.user._id] });

    expect(assignStudentRes.status).toBe(200);

    const assignLabBatchRes = await request(app)
      .post(`/api/classes/${classId}/assign-lab-batch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labBatchName: 'Batch A', studentIds: [createStudentRes.body.user._id] });

    expect(assignLabBatchRes.status).toBe(200);

    const updateClassRes = await request(app)
      .put(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TY-AIA-10-RENAMED', capacity: 65, description: 'Renamed theory class' });

    expect(updateClassRes.status).toBe(200);
    expect(updateClassRes.body.class.name).toBe('TY-AIA-10-RENAMED');

    const teacherAfterRename = await User.findOne({ email: 'assigned.teacher@test.com' });
    const studentAfterRename = await User.findOne({ email: 'assigned.student@test.com' });
    expect(teacherAfterRename.assignedBatches).toContain('TY-AIA-10-RENAMED');
    expect(teacherAfterRename.assignedLabBatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ className: 'TY-AIA-10-RENAMED', labBatchName: 'Batch A' }),
    ]));
    expect(studentAfterRename.batch).toBe('TY-AIA-10-RENAMED');

    const updateLabBatchRes = await request(app)
      .put(`/api/classes/${classId}/lab-batches/${labBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch Alpha', capacity: 25 });

    expect(updateLabBatchRes.status).toBe(200);
    expect(updateLabBatchRes.body.class.labBatches[0].name).toBe('Batch Alpha');

    const studentAfterLabRename = await User.findOne({ email: 'assigned.student@test.com' });
    const teacherAfterLabRename = await User.findOne({ email: 'assigned.teacher@test.com' });
    expect(studentAfterLabRename.labBatch).toBe('Batch Alpha');
    expect(teacherAfterLabRename.assignedLabBatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ className: 'TY-AIA-10-RENAMED', labBatchName: 'Batch Alpha' }),
    ]));

    const deleteLabBatchRes = await request(app)
      .delete(`/api/classes/${classId}/lab-batches/${labBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteLabBatchRes.status).toBe(200);

    const studentAfterLabDelete = await User.findOne({ email: 'assigned.student@test.com' });
  const teacherAfterLabDelete = await User.findOne({ email: 'assigned.teacher@test.com' });
    expect(studentAfterLabDelete.labBatch).toBe('');
  expect(teacherAfterLabDelete.assignedLabBatches).toEqual([]);

    const deleteClassRes = await request(app)
      .delete(`/api/classes/${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteClassRes.status).toBe(200);

    const teacherAfterDelete = await User.findOne({ email: 'assigned.teacher@test.com' });
    const studentAfterDelete = await User.findOne({ email: 'assigned.student@test.com' });
    expect(teacherAfterDelete.assignedBatches).not.toContain('TY-AIA-10-RENAMED');
    expect(studentAfterDelete.batch).toBe('');
    expect(studentAfterDelete.labBatch).toBe('');
  });

  test('deactivated users are blocked at login and on authenticated requests', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('activepass', salt);
    const user = await User.create({
      name: 'Active Student',
      firstName: 'Active',
      lastName: 'Student',
      email: 'deactivate@test.com',
      password: hashed,
      role: 'student',
      enrollmentNo: 'DEACT001',
      isVerified: true,
      isActive: true,
    });

    const activeLogin = await request(app).post('/api/auth/login').send({ email: 'deactivate@test.com', password: 'activepass' });
    expect(activeLogin.status).toBe(200);

    user.isActive = false;
    await user.save();

    const blockedLogin = await request(app).post('/api/auth/login').send({ email: 'deactivate@test.com', password: 'activepass' });
    expect(blockedLogin.status).toBe(403);

    const profileRes = await request(app)
      .get('/api/profile')
      .set('Cookie', activeLogin.headers['set-cookie']);

    expect(profileRes.status).toBe(403);
    expect(profileRes.body.message).toMatch(/deactivated/i);
  });

  test('admin can invite a user to set their password and the invited user can log in after setup', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Admin Two', firstName: 'Admin', lastName: 'Two', email: 'admin2@test.com', password: hashed, role: 'admin' });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin2@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const inviteRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ firstName: 'Invite', lastName: 'Student', email: 'invited@test.com', enrollmentNo: 'INVITE001', role: 'student', batch: '2026-A', sendInvite: true });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.message).toMatch(/setup email sent/i);
    expect(inviteRes.body.inviteToken).toBeTruthy();

    const resetRes = await request(app)
      .post('/api/verification/reset-password')
      .send({ token: inviteRes.body.inviteToken, newPassword: 'InvitePass123!' });

    expect(resetRes.status).toBe(200);

    const invitedLogin = await request(app).post('/api/auth/login').send({ email: 'invited@test.com', password: 'InvitePass123!' });
    expect(invitedLogin.status).toBe(200);
    expect(invitedLogin.body.user.firstName).toBe('Invite');
  });

  test('admin can create a user with a temporary password and also send a setup email', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Admin Invite', firstName: 'Admin', lastName: 'Invite', email: 'admininvite@test.com', password: hashed, role: 'admin' });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admininvite@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        firstName: 'Temp',
        lastName: 'Invite',
        email: 'temp.invite@test.com',
        enrollmentNo: 'TEMPINV001',
        role: 'student',
        batch: '2026-A',
        password: 'TempPass123!',
        sendInvite: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.message).toMatch(/temporary password set, and invite email sent/i);
    expect(createRes.body.inviteToken).toBeTruthy();

    const tempLogin = await request(app).post('/api/auth/login').send({ email: 'temp.invite@test.com', password: 'TempPass123!' });
    expect(tempLogin.status).toBe(200);

    const resetRes = await request(app)
      .post('/api/verification/reset-password')
      .send({ token: createRes.body.inviteToken, newPassword: 'TempInviteFresh123!' });
    expect(resetRes.status).toBe(200);

    const updatedLogin = await request(app).post('/api/auth/login').send({ email: 'temp.invite@test.com', password: 'TempInviteFresh123!' });
    expect(updatedLogin.status).toBe(200);
  });

  test('admin can bulk create users with a temporary password and invite links', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Admin Bulk', firstName: 'Admin', lastName: 'Bulk', email: 'adminbulk@test.com', password: hashed, role: 'admin' });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'adminbulk@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const bulkRes = await request(app)
      .post('/api/users/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        temporaryPassword: 'TempPass123!',
        sendInvite: true,
        users: [
          { firstName: 'Bulk', lastName: 'One', email: 'bulk.one@test.com', enrollmentNo: 'BULK001', role: 'student', batch: '2026-A' },
          { firstName: 'Bulk', lastName: 'Two', email: 'bulk.two@test.com', enrollmentNo: 'BULK002', role: 'student', batch: '2026-B' },
        ],
      });

    expect(bulkRes.status).toBe(201);
    expect(bulkRes.body.createdCount).toBe(2);
    expect(bulkRes.body.failedCount).toBe(0);
    expect(bulkRes.body.createdUsers[0].passwordLinkToken).toBeTruthy();

    const tempLogin = await request(app).post('/api/auth/login').send({ email: 'bulk.one@test.com', password: 'TempPass123!' });
    expect(tempLogin.status).toBe(200);

    const resetRes = await request(app)
      .post('/api/verification/reset-password')
      .send({ token: bulkRes.body.createdUsers[0].passwordLinkToken, newPassword: 'BulkFresh123!' });
    expect(resetRes.status).toBe(200);

    const updatedLogin = await request(app).post('/api/auth/login').send({ email: 'bulk.one@test.com', password: 'BulkFresh123!' });
    expect(updatedLogin.status).toBe(200);
  });

  test('bulk user import rejects files larger than 500 users', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Admin Limit', firstName: 'Admin', lastName: 'Limit', email: 'adminlimit@test.com', password: hashed, role: 'admin' });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'adminlimit@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const users = Array.from({ length: 501 }, (_, index) => ({
      firstName: `User${index}`,
      lastName: 'Bulk',
      email: `bulk.limit.${index}@test.com`,
      enrollmentNo: `LIMIT${String(index).padStart(3, '0')}`,
      role: 'student',
      batch: '2026-A',
    }));

    const bulkRes = await request(app)
      .post('/api/users/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        temporaryPassword: 'TempPass123!',
        sendInvite: false,
        users,
      });

    expect(bulkRes.status).toBe(400);
    expect(bulkRes.body.message).toMatch(/between 1 and 500 records|up to 500 users/i);
  });

  test('admin can update existing teacher assignments and teacher reports stay batch scoped', async () => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('adminpass', salt);
    await AcademicClass.create({ name: '2026-A', capacity: 60, description: 'Teacher report class A' });
    await AcademicClass.create({ name: '2026-B', capacity: 60, description: 'Teacher report class B' });
    await User.create({ name: 'Admin Teacher', firstName: 'Admin', lastName: 'Teacher', email: 'adminteacher@test.com', password: hashed, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'adminteacher@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const teacherCreate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Teach',
        lastName: 'One',
        email: 'teacher.one@test.com',
        enrollmentNo: 'TEACH001',
        password: 'TeachPass123!',
        role: 'teacher',
        employeeId: 'EMP001',
        department: 'Computer Science',
        subjects: ['DBMS'],
        assignedBatches: ['2026-A'],
      });

    expect(teacherCreate.status).toBe(201);
    const teacherId = teacherCreate.body.user._id;

    const updateTeacher = await request(app)
      .put(`/api/users/${teacherId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Teach',
        lastName: 'One',
        email: 'teacher.one@test.com',
        enrollmentNo: 'TEACH001',
        role: 'teacher',
        employeeId: 'EMP001',
        department: 'Computer Science',
        subjects: ['DBMS', 'DSA'],
        assignedBatches: ['2026-A', '2026-B'],
      });

    expect(updateTeacher.status).toBe(200);
    expect(updateTeacher.body.user.subjects).toEqual(expect.arrayContaining(['DBMS', 'DSA']));
    expect(updateTeacher.body.user.assignedBatches).toEqual(expect.arrayContaining(['2026-A', '2026-B']));

    const teacherLogin = await request(app).post('/api/auth/login').send({ email: 'teacher.one@test.com', password: 'TeachPass123!' });
    expect(teacherLogin.status).toBe(200);
    const teacherToken = teacherLogin.body.token;

    const teacherQuestion = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        questionText: 'Teacher DBMS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
        category: 'Technical',
        subject: 'DBMS',
        topic: 'SQL',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(teacherQuestion.status).toBe(201);

    const adminQuestion = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'Admin DBMS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 2,
        category: 'Technical',
        subject: 'DBMS',
        topic: 'Normalization',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(adminQuestion.status).toBe(201);

    const adminOsQuestion = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionText: 'Admin OS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        category: 'Technical',
        subject: 'OS',
        topic: 'Scheduling',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(adminOsQuestion.status).toBe(201);

    const teacherAssignedQuestions = await request(app)
      .get('/api/questions?scope=assigned')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(teacherAssignedQuestions.status).toBe(200);
    expect(teacherAssignedQuestions.body.questions.map((question) => question.questionText)).toContain('Teacher DBMS question?');
    expect(teacherAssignedQuestions.body.questions.map((question) => question.questionText)).toContain('Admin DBMS question?');
    expect(teacherAssignedQuestions.body.questions.map((question) => question.questionText)).not.toContain('Admin OS question?');

    const forbiddenEdit = await request(app)
      .put(`/api/questions/${adminQuestion.body.question._id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ questionText: 'Teacher should not edit this question' });

    expect(forbiddenEdit.status).toBe(403);

    const assignedLibraryExamAttempt = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Teacher Assigned Library Exam',
        subject: 'DBMS',
        description: 'Should succeed',
        duration: 5,
        totalMarks: 1,
        passingMarks: 1,
        questions: [adminQuestion.body.question._id],
        assignedClasses: ['2026-A'],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(assignedLibraryExamAttempt.status).toBe(201);

    const missingAudienceExamAttempt = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Teacher Missing Audience Exam',
        subject: 'DBMS',
        description: 'Should fail without audience',
        duration: 5,
        totalMarks: 1,
        passingMarks: 1,
        questions: [teacherQuestion.body.question._id],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(missingAudienceExamAttempt.status).toBe(400);

    const foreignSubjectExamAttempt = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Teacher Foreign Subject Exam',
        subject: 'DBMS',
        description: 'Should fail',
        duration: 5,
        totalMarks: 1,
        passingMarks: 1,
        questions: [adminOsQuestion.body.question._id],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(foreignSubjectExamAttempt.status).toBe(400);

    const teacherExam = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Teacher Owned Exam',
        subject: 'DBMS',
        description: 'Teacher owned exam',
        duration: 5,
        totalMarks: 1,
        passingMarks: 1,
        questions: [teacherQuestion.body.question._id],
        assignedClasses: ['2026-A'],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(teacherExam.status).toBe(201);

    const studentA = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Batch', lastName: 'Alpha', email: 'batch.a@test.com', enrollmentNo: 'BATCHA1', password: 'StudentPass123!', role: 'student', batch: '2026-A' });
    expect(studentA.status).toBe(201);

    const studentB = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Batch', lastName: 'Beta', email: 'batch.b@test.com', enrollmentNo: 'BATCHB1', password: 'StudentPass123!', role: 'student', batch: '2026-C' });
    expect(studentB.status).toBe(201);

    const studentALogin = await request(app).post('/api/auth/login').send({ email: 'batch.a@test.com', password: 'StudentPass123!' });
    const studentBLogin = await request(app).post('/api/auth/login').send({ email: 'batch.b@test.com', password: 'StudentPass123!' });
    expect(studentALogin.status).toBe(200);
    expect(studentBLogin.status).toBe(200);

    const examId = teacherExam.body.exam._id;
    const questionId = teacherExam.body.exam.questions[0]._id;

    const studentAExams = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentALogin.body.token}`);
    const studentBExams = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentBLogin.body.token}`);

    expect(studentAExams.status).toBe(200);
    expect(studentBExams.status).toBe(200);
    expect(studentAExams.body.exams.map((exam) => exam.title)).toContain('Teacher Owned Exam');
    expect(studentBExams.body.exams.map((exam) => exam.title)).not.toContain('Teacher Owned Exam');

    const studentAAttempt = await request(app).post('/api/attempts/start').set('Authorization', `Bearer ${studentALogin.body.token}`).send({ examId });
    const studentBAttempt = await request(app).post('/api/attempts/start').set('Authorization', `Bearer ${studentBLogin.body.token}`).send({ examId });
    expect(studentAAttempt.status).toBe(201);
    expect(studentBAttempt.status).toBe(404);

    await request(app).put(`/api/attempts/${studentAAttempt.body.attempt._id}/answer`).set('Authorization', `Bearer ${studentALogin.body.token}`).send({ questionId, selectedOption: 1 });
    await request(app).post(`/api/attempts/${studentAAttempt.body.attempt._id}/submit`).set('Authorization', `Bearer ${studentALogin.body.token}`).send();

    const teacherStudents = await request(app)
      .get('/api/reports/students')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(teacherStudents.status).toBe(200);
    expect(teacherStudents.body.students.map((student) => student.email)).toContain('batch.a@test.com');
    expect(teacherStudents.body.students.map((student) => student.email)).not.toContain('batch.b@test.com');
  });

  test('teacher reports can be scoped by assigned lab batch without full class assignment', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Lab Scope Admin', firstName: 'Lab', lastName: 'Scope', email: 'labscope.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'labscope.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const createClassRes = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '2026-LAB', capacity: 60, description: 'Lab scoped class' });

    expect(createClassRes.status).toBe(201);
    const classId = createClassRes.body.class._id;

    await request(app)
      .post(`/api/classes/${classId}/lab-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch A', capacity: 20 });
    await request(app)
      .post(`/api/classes/${classId}/lab-batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Batch B', capacity: 20 });

    const teacherCreate = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Lab',
        lastName: 'Teacher',
        email: 'lab.teacher@test.com',
        enrollmentNo: 'LABT001',
        password: 'TeachPass123!',
        role: 'teacher',
        employeeId: 'EMPLAB01',
        department: 'Computer Science',
        subjects: ['DBMS'],
        assignedLabBatches: [{ className: '2026-LAB', labBatchName: 'Batch A' }],
      });

    expect(teacherCreate.status).toBe(201);

    const studentA = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Lab', lastName: 'Alpha', email: 'lab.alpha@test.com', enrollmentNo: 'LABA001', password: 'StudentPass123!', role: 'student' });
    const studentB = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Lab', lastName: 'Beta', email: 'lab.beta@test.com', enrollmentNo: 'LABB001', password: 'StudentPass123!', role: 'student' });

    expect(studentA.status).toBe(201);
    expect(studentB.status).toBe(201);

    await request(app)
      .post(`/api/classes/${classId}/assign-students`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [studentA.body.user._id, studentB.body.user._id] });

    await request(app)
      .post(`/api/classes/${classId}/assign-lab-batch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labBatchName: 'Batch A', studentIds: [studentA.body.user._id] });
    await request(app)
      .post(`/api/classes/${classId}/assign-lab-batch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ labBatchName: 'Batch B', studentIds: [studentB.body.user._id] });

    const teacherLogin = await request(app).post('/api/auth/login').send({ email: 'lab.teacher@test.com', password: 'TeachPass123!' });
    const studentALogin = await request(app).post('/api/auth/login').send({ email: 'lab.alpha@test.com', password: 'StudentPass123!' });
    const studentBLogin = await request(app).post('/api/auth/login').send({ email: 'lab.beta@test.com', password: 'StudentPass123!' });
    expect(teacherLogin.status).toBe(200);
    expect(studentALogin.status).toBe(200);
    expect(studentBLogin.status).toBe(200);

    const teacherQuestion = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${teacherLogin.body.token}`)
      .send({
        questionText: 'Lab scoped DBMS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
        category: 'Technical',
        subject: 'DBMS',
        topic: 'SQL',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(teacherQuestion.status).toBe(201);

    const teacherExam = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherLogin.body.token}`)
      .send({
        title: 'Teacher Lab Scope Exam',
        subject: 'DBMS',
        description: 'Teacher owned lab batch scope exam',
        duration: 5,
        totalMarks: 1,
        passingMarks: 1,
        questions: [teacherQuestion.body.question._id],
        assignedLabBatches: [{ className: '2026-LAB', labBatchName: 'Batch A' }],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(teacherExam.status).toBe(201);

    const examId = teacherExam.body.exam._id;
    const questionId = teacherExam.body.exam.questions[0]._id;

    const studentAExams = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentALogin.body.token}`);
    const studentBExams = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentBLogin.body.token}`);

    expect(studentAExams.status).toBe(200);
    expect(studentBExams.status).toBe(200);
    expect(studentAExams.body.exams.map((exam) => exam.title)).toContain('Teacher Lab Scope Exam');
    expect(studentBExams.body.exams.map((exam) => exam.title)).not.toContain('Teacher Lab Scope Exam');

    const studentAAttempt = await request(app).post('/api/attempts/start').set('Authorization', `Bearer ${studentALogin.body.token}`).send({ examId });
    const studentBAttempt = await request(app).post('/api/attempts/start').set('Authorization', `Bearer ${studentBLogin.body.token}`).send({ examId });
    expect(studentAAttempt.status).toBe(201);
    expect(studentBAttempt.status).toBe(404);

    await request(app).put(`/api/attempts/${studentAAttempt.body.attempt._id}/answer`).set('Authorization', `Bearer ${studentALogin.body.token}`).send({ questionId, selectedOption: 1 });
    await request(app).post(`/api/attempts/${studentAAttempt.body.attempt._id}/submit`).set('Authorization', `Bearer ${studentALogin.body.token}`).send();

    const teacherStudents = await request(app)
      .get('/api/reports/students')
      .set('Authorization', `Bearer ${teacherLogin.body.token}`);

    expect(teacherStudents.status).toBe(200);
    expect(teacherStudents.body.students.map((student) => student.email)).toContain('lab.alpha@test.com');
    expect(teacherStudents.body.students.map((student) => student.email)).not.toContain('lab.beta@test.com');
  });

  test('admin can bulk promote selected classes until final year', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Promotion Admin', email: 'promotion.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'promotion.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const firstClass = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ name: 'PROMOTE-A', year: 1, course: 'GENERAL', capacity: 60, description: 'Promote me' });
    const secondClass = await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ name: 'PROMOTE-B', year: 3, course: 'GENERAL', capacity: 60, description: 'Promote me too' });

    expect(firstClass.status).toBe(201);
    expect(secondClass.status).toBe(201);

    const promoteResponse = await request(app)
      .post('/api/classes/promote')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ classIds: [firstClass.body.class._id, secondClass.body.class._id] });

    expect(promoteResponse.status).toBe(200);
    expect(promoteResponse.body.promotedCount).toBe(2);

    const refreshedClasses = await AcademicClass.find({ name: { $in: ['PROMOTE-A', 'PROMOTE-B'] } }).sort({ name: 1 });
    expect(refreshedClasses[0].year).toBe(2);
    expect(refreshedClasses[1].year).toBe(4);
  });

  test('admin can bulk create classes with row-level failures', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Bulk Class Admin', email: 'bulk.class.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'bulk.class.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    await AcademicClass.create({ name: 'EXISTING-CLASS', year: 1, course: 'GENERAL', capacity: 60, description: 'Already exists' });

    const bulkResponse = await request(app)
      .post('/api/classes/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send([
        { name: 'FY-CSE-A', year: 1, course: 'CSE', capacity: 60, description: 'New first year CSE class' },
        { name: 'EXISTING-CLASS', year: 2, course: 'GENERAL', capacity: 60, description: 'Duplicate in database' },
        { name: 'SY-IT-A', year: 2, course: 'IT' },
        { name: 'FY-CSE-A', year: 1, course: 'CSE', capacity: 60, description: 'Duplicate in file' },
      ]);

    expect(bulkResponse.status).toBe(201);
    expect(bulkResponse.body.createdCount).toBe(2);
    expect(bulkResponse.body.failedCount).toBe(2);
    expect(bulkResponse.body.errors).toHaveLength(2);
    expect(bulkResponse.body.errors.map((entry) => entry.message)).toContain('A class with this name already exists');
    expect(bulkResponse.body.errors.map((entry) => entry.message)).toContain('Duplicate class name in import file');

    const createdClasses = await AcademicClass.find({ name: { $in: ['FY-CSE-A', 'SY-IT-A'] } }).sort({ name: 1 });
    expect(createdClasses).toHaveLength(2);
    expect(createdClasses[0].course).toBe('CSE');
    expect(createdClasses[0].capacity).toBe(60);
    expect(createdClasses[1].course).toBe('IT');
    expect(createdClasses[1].capacity).toBe(60);
  });

  test('question creation rejects subject codes outside the catalog scope', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Question Scope Admin', email: 'question.scope.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'question.scope.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const questionResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        questionText: 'Invalid scoped DBMS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        category: 'Technical',
        subject: 'DBMS',
        topic: 'Transactions',
        year: 2,
        course: 'CSE',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(questionResponse.status).toBe(400);
    expect(questionResponse.body.message).toMatch(/not available/i);
  });

  test('subject creation rejects non-alphanumeric subject codes', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Subject Format Admin', email: 'subject.format.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'subject.format.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    const subjectResponse = await request(app)
      .post('/api/subjects')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        code: 'DBMS-101',
        name: 'Database Systems 101',
        year: 1,
        course: 'GENERAL',
        description: 'Invalid code format test',
      });

    expect(subjectResponse.status).toBe(400);
    expect(subjectResponse.body.message).toMatch(/alphanumeric only/i);
  });

  test('exam creation rejects subjects not available for the selected class scope', async () => {
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('adminpass', salt);
    await User.create({ name: 'Exam Scope Admin', email: 'exam.scope.admin@test.com', password: adminPassword, role: 'admin', isVerified: true });

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'exam.scope.admin@test.com', password: 'adminpass' });
    expect(adminLogin.status).toBe(200);

    await request(app)
      .post('/api/classes')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ name: '2027-CSE-A', year: 2, course: 'CSE', capacity: 60, description: 'Catalog-scoped class' });

    const questionResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        questionText: 'General DBMS question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 1,
        category: 'Technical',
        subject: 'DBMS',
        topic: 'Normalization',
        difficulty: 'Easy',
        marks: 1,
      });

    expect(questionResponse.status).toBe(201);

    const examResponse = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        title: 'Invalid CSE DBMS Exam',
        subject: 'DBMS',
        description: 'Should fail because CSE year 2 has no DBMS catalog entry yet',
        duration: 15,
        totalMarks: 1,
        passingMarks: 1,
        questions: [questionResponse.body.question._id],
        assignedClasses: ['2027-CSE-A'],
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 600000).toISOString(),
      });

    expect(examResponse.status).toBe(400);
    expect(examResponse.body.message).toMatch(/not available for class/i);
  });
});
