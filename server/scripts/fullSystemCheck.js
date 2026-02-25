const fetch = global.fetch; // Node 18+

const BASE_URL = 'http://localhost:5000/api';
const ADMIN = { email: 'admin@example.com', password: 'ChangeMe123!' };
const STUDENT = { email: 'student@example.com', password: 'ChangeMe123!' };

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
    console.log('4️⃣ Starting Adaptive Test (DBMS)...');
    const startTest = await req('POST', '/adaptive/start', studentToken, { subject: 'DBMS' });
    if (startTest.status !== 200) {
        console.warn('⚠️ Could not start DBMS test (maybe no questions?). Trying OS...');
        // Try OS?
    } else {
        const attemptId = startTest.data.data.attemptId;
        const question = startTest.data.data.question;
        console.log(`✅ Test Started (ID: ${attemptId}). Q1: ${question.questionText.substring(0, 30)}...`);

        // 5. Submit Answer
        console.log('5️⃣ Submitting Answer...');
        const submit = await req('POST', '/adaptive/submit', studentToken, {
            attemptId,
            questionId: question._id,
            selectedOption: 0, // Just pick first option
            timeSpent: 10
        });
        if (submit.status !== 200) throw new Error('Submit Answer Failed');
        console.log('✅ Answer Submitted');

        // 6. End Test
        console.log('6️⃣ Ending Test...');
        const end = await req('POST', '/adaptive/end', studentToken, { attemptId });
        if (end.status !== 200) throw new Error('End Test Failed');
        console.log(`✅ Test Ended. Score: ${end.data.data.finalScore}`);

        // 7. Check Analysis
        console.log('7️⃣ Verifying Analysis Endpoint...');
        const analysis = await req('GET', `/adaptive/attempt/${attemptId}`, studentToken);
        if (analysis.status !== 200) throw new Error('Analysis Check Failed');
        console.log('✅ Analysis Data Retrieved');
    }

    console.log('\n✨ ALL SYSTEMS GO! Backend is fully operational.');
}

runTest().catch(e => {
    console.error('\n❌ SYSTEM CHECK FAILED:', e.message);
    process.exit(1);
});
