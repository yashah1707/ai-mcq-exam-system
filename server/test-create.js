const fetch = require('node-fetch');

const run = async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@mit.edu', password: 'password123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    console.log('Login token:', token ? 'Success' : 'Failed', loginData);
    if (!token) return;

    // Get questions
    const qRes = await fetch('http://localhost:5000/api/questions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const qData = await qRes.json();
    const qIds = qData.questions ? qData.questions.slice(0, 1).map(q => q._id) : [];

    console.log('Got questions:', qIds);

    const payload = {
      title: 'Test Exam',
      subject: 'Mixed',
      description: 'A test exam',
      duration: 60,
      totalMarks: 10,
      passingMarks: 4,
      questions: qIds,
      assignedClasses: [],
      assignedLabBatches: [],
      startDate: '2026-04-24T05:36',
      endDate: '2026-05-01T05:36',
      isActive: true,
      enableNegativeMarking: false
    };

    const createRes = await fetch('http://localhost:5000/api/exams', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Create exam response status:', createRes.status);
    const createData = await createRes.json();
    console.log('Create exam response body:', createData);
  } catch (err) {
    console.error(err);
  }
};
run();
