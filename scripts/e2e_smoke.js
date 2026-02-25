const fetch = global.fetch || require('node-fetch');
const API = process.env.API_BASE || 'http://localhost:5000/api';

const adminCreds = { email: 'admin@example.com', password: 'ChangeMe123!' };
const studentCreds = { name: 'Smoke Student', email: `smoke+${Date.now()}@example.com`, password: 'password123' };

async function req(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: res.status, body };
}

(async () => {
  try {
    console.log('1) Admin login');
    let r = await req('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(adminCreds) });
    if (r.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(r));
    const adminToken = r.body.token;
    console.log('-> admin token ok');

    console.log('2) Create question');
    const qPayload = {
      questionText: 'What is 2 + 2?',
      options: ['3','4','5','6'],
      correctAnswer: 1,
      category: 'Aptitude',
      difficulty: 'Easy',
      marks: 1,
      explanation: '2 + 2 = 4'
    };
    r = await req('/questions', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${adminToken}`}, body: JSON.stringify(qPayload) });
    if (r.status !== 201) throw new Error('Create question failed: ' + JSON.stringify(r));
    const q = r.body.question;
    console.log('-> question created', q._id);

    console.log('3) Create exam');
    const now = new Date();
    const start = new Date(now.getTime() - 60*1000).toISOString();
    const end = new Date(now.getTime() + 10*60*1000).toISOString();
    const examPayload = {
      title: 'Smoke Test Exam',
      description: 'Auto-generated exam for smoke test',
      duration: 5,
      totalMarks: 1,
      passingMarks: 1,
      questions: [q._id],
      startDate: start,
      endDate: end
    };
    r = await req('/exams', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${adminToken}`}, body: JSON.stringify(examPayload) });
    if (r.status !== 201) throw new Error('Create exam failed: ' + JSON.stringify(r));
    const exam = r.body.exam;
    console.log('-> exam created', exam._id);

    console.log('4) Register student');
    r = await req('/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(studentCreds) });
    if (r.status !== 201) {
      // maybe auto-registered disabled; attempt login
      console.log('Register returned', r.status, r.body);
      const loginR = await req('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: studentCreds.email, password: studentCreds.password }) });
      if (loginR.status !== 200) throw new Error('Student register/login failed: ' + JSON.stringify(loginR));
      r = loginR;
    }
    const studentToken = r.body.token;
    console.log('-> student token ok');

    console.log('5) Start exam as student');
    r = await req('/attempts/start', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${studentToken}`}, body: JSON.stringify({ examId: exam._id }) });
    if (r.status !== 201 && r.status !== 200) throw new Error('Start exam failed: ' + JSON.stringify(r));
    const attempt = r.body.attempt;
    console.log('-> attempt started', attempt._id);

    const answer = { questionId: attempt.answers[0].questionId || attempt.answers[0].question, selectedOption: 1 };
    console.log('6) Save answer', answer);
    r = await req(`/attempts/${attempt._id}/answer`, { method: 'PUT', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${studentToken}`}, body: JSON.stringify(answer) });
    if (r.status !== 200) throw new Error('Save answer failed: ' + JSON.stringify(r));
    console.log('-> answer saved');

    console.log('7) Submit exam');
    r = await req(`/attempts/${attempt._id}/submit`, { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${studentToken}`} });
    if (r.status !== 200) throw new Error('Submit failed: ' + JSON.stringify(r));
    console.log('-> submitted, result:');
    console.log(JSON.stringify(r.body.result, null, 2));

    console.log('\nSMOKE E2E completed successfully');
  } catch (err) {
    console.error('E2E failed:', err);
    process.exit(1);
  }
})();
