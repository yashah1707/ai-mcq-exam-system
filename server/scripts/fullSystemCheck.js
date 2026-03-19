const fetch = global.fetch; // Node 18+

const BASE_URL = 'http://localhost:5000/api';
const ADMIN = {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!'
};
const STUDENT = {
    email: process.env.STUDENT_EMAIL || 'student@example.com',
    password: process.env.STUDENT_PASSWORD || 'ChangeMe123!'
};

async function req(method, url, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${url}`, opts);
    const data = await res.json();
    return { status: res.status, data };
}

async function runTest() {
    console.log('🚀 Starting Full System Verification Check...\n');

    // 1. Admin Login
    console.log('1️⃣ Admin Login...');
    const adminLogin = await req('POST', '/auth/login', null, ADMIN);
    if (adminLogin.status !== 200) throw new Error(`Admin Login Failed: ${JSON.stringify(adminLogin.data)}`);
    const adminToken = adminLogin.data.token;
    console.log('✅ Admin Logged In');

    // 2. Admin Analytics
    console.log('2️⃣ Checking Batch Analytics...');
    const analytics = await req('GET', '/batch-analytics/overview', adminToken);
    if (analytics.status !== 200) throw new Error('Batch Analytics Failed');
    console.log(`✅ Analytics Overview: Students=${analytics.data.data.totalStudents}, Exams=${analytics.data.data.totalExams}`);

    // 3. Student Login
    console.log('3️⃣ Student Login...');
    const studentLogin = await req('POST', '/auth/login', null, STUDENT);
    if (studentLogin.status !== 200) throw new Error(`Student Login Failed: ${JSON.stringify(studentLogin.data)}`);
    const studentToken = studentLogin.data.token;
    console.log('✅ Student Logged In');

    // 4. Start Adaptive Test
    console.log('4️⃣ Starting Adaptive Test...');
    const subjectsToTry = ['DBMS', 'OS', 'Aptitude', 'Mixed'];
    let startTest = null;
    let selectedSubject = null;

    for (const subject of subjectsToTry) {
        const response = await req('POST', '/adaptive/start', studentToken, { subject });
        if ((response.status === 200 || response.status === 201) && response.data?.data?.attemptId && response.data?.data?.question) {
            startTest = response;
            selectedSubject = subject;
            break;
        }

        console.warn(`⚠️ Could not start ${subject} adaptive test: ${JSON.stringify(response.data)}`);
    }

    if (!startTest) {
        throw new Error('Adaptive test start failed for all fallback subjects');
    }

    const attemptId = startTest.data.data.attemptId;
    const question = startTest.data.data.question;
    console.log(`✅ Test Started for ${selectedSubject} (ID: ${attemptId}). Q1: ${question.questionText.substring(0, 30)}...`);

    // 5. Submit Answer
    console.log('5️⃣ Submitting Answer...');
    const submit = await req('POST', '/adaptive/submit', studentToken, {
        attemptId,
        questionId: question._id,
        selectedOption: 0,
        timeSpent: 10
    });
    if (submit.status !== 200) throw new Error(`Submit Answer Failed: ${JSON.stringify(submit.data)}`);
    console.log('✅ Answer Submitted');

    // 6. End Test
    console.log('6️⃣ Ending Test...');
    const end = await req('POST', '/adaptive/end', studentToken, { attemptId });
    if (end.status !== 200) throw new Error(`End Test Failed: ${JSON.stringify(end.data)}`);
    console.log(`✅ Test Ended. Score: ${end.data.data.finalScore}`);

    // 7. Check Analysis
    console.log('7️⃣ Verifying Analysis Endpoint...');
    const analysis = await req('GET', `/adaptive/attempt/${attemptId}`, studentToken);
    if (analysis.status !== 200) throw new Error(`Analysis Check Failed: ${JSON.stringify(analysis.data)}`);
    console.log('✅ Analysis Data Retrieved');

    console.log('\n✨ ALL SYSTEMS GO! Backend is fully operational.');
}

runTest().catch(e => {
    console.error('\n❌ SYSTEM CHECK FAILED:', e.message);
    process.exit(1);
});
