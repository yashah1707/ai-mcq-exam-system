const fetch = global.fetch || require('node-fetch');
const API = process.env.API_BASE || 'http://localhost:5000/api';

const admin = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'ChangeMe123!'
};

async function req(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { status: res.status, body };
}

(async () => {
  try {
    console.log('Admin login');
    let r = await req('/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(admin) });
    if (r.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(r));
    const token = r.body.token;

    console.log('Uploading 3 sample questions in bulk');
    const payload = [
      { questionText: 'Bulk Q1: 1+1?', options:['1','2','3','4'], correctAnswer:1, category:'Aptitude', difficulty:'Easy', marks:1 },
      { questionText: 'Bulk Q2: 2+2?', options:['2','3','4','5'], correctAnswer:2, category:'Aptitude', difficulty:'Easy', marks:1 },
      { questionText: 'Bulk Q3: JS type of [] is?', options:['object','array','string','null'], correctAnswer:0, category:'Technical', difficulty:'Easy', marks:1 }
    ];

    r = await req('/questions/bulk', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload) });
    if (r.status !== 201) throw new Error('Bulk upload failed: ' + JSON.stringify(r));
    console.log('Bulk created count:', r.body.createdCount);
    const qIds = (r.body.created || []).map(q=>q._id);
    if (!qIds.length) throw new Error('No question ids returned');

    console.log('Create exam from bulk questions');
    const now = new Date();
    const start = new Date(now.getTime() - 60*1000).toISOString();
    const end = new Date(now.getTime() + 10*60*1000).toISOString();
    const examPayload = {
      title: 'Bulk Exam',
      subject: 'Aptitude',
      description: 'Exam from bulk upload',
      duration: 10,
      totalMarks: qIds.length,
      passingMarks: qIds.length,
      questions: qIds,
      startDate: start,
      endDate: end
    };
    r = await req('/exams', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(examPayload) });
    if (r.status !== 201) throw new Error('Create exam failed: ' + JSON.stringify(r));
    console.log('Exam created:', r.body.exam._id);

    console.log('Integration test completed successfully');
  } catch (err) {
    console.error('Integration test failed:', err);
    process.exit(1);
  }
})();
