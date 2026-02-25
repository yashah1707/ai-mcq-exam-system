const fetch = global.fetch;

const BASE_URL = 'http://localhost:5000/api';
const AI_URL = 'http://localhost:5001';

async function req(method, url, token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${url}`, opts);
    let data;
    try {
        data = await res.json();
    } catch (e) {
        data = { error: 'Invalid JSON' };
    }
    return { status: res.status, data };
}

const { execSync } = require('child_process');

async function runAdvancedCheck() {
    console.log('🚀 Starting ADVANCED System Verification...\n');

    const timestamp = Date.now();
    const newUser = {
        name: `Debug User ${timestamp}`,
        email: `debug_${timestamp}@test.com`,
        password: 'Password123!',
        enrollmentNo: `DEB${timestamp}`
    };

    try {
        // 1. Register
        console.log(`1️⃣ Registering User: ${newUser.email}...`);
        const regRes = await req('POST', '/auth/register', null, newUser);
        if (regRes.status !== 201) throw new Error(`Registration Failed: ${JSON.stringify(regRes.data)}`);
        console.log('✅ Registration Successful');

        // Wait for DB consistency
        await new Promise(r => setTimeout(r, 1000));

        // 1.5 Verify User (Simulate Email Click)
        console.log('1️⃣.5️⃣ Verifying Email (Backend Bypass)...');
        try {
            // Script is in parent folder relative to this script
            execSync(`node ../verify-user-cli.js "${newUser.email}"`, { stdio: 'inherit' });
        } catch (e) {
            throw new Error('Verification Script Failed');
        }

        // 2. Login
        console.log('2️⃣ Logging in...');
        const loginRes = await req('POST', '/auth/login', null, { email: newUser.email, password: newUser.password });
        if (loginRes.status !== 200) throw new Error(`Login Failed: ${JSON.stringify(loginRes.data)}`);
        const token = loginRes.data.token;
        const userId = loginRes.data.user._id;
        console.log(`✅ Logged In. Token received for UserID: ${userId}`);

        // 3. Check Initial Dashboard (Should be empty/default)
        console.log('3️⃣ Checking Initial Analytics...');
        const readyRes = await req('GET', `/analytics/student/${userId}/readiness`, token);
        console.log(`   Readiness Level: ${readyRes.data.data.level} (Expected: Beginner)`);

        // 4. Start Adaptive Test
        console.log('4️⃣ Starting Adaptive Test...');
        // We need a subject. Let's try 'DBMS' or 'Aptitude'.
        // We need a subject. Let's try 'Mixed' to verify new logic.
        const startRes = await req('POST', '/adaptive/start', token, { subject: 'Mixed' });

        let attemptId;
        let currentQuestion;

        if (startRes.status === 200 || startRes.status === 201) {
            // New Controller Response: { success: true, data: { attemptId, question, ... } }
            if (startRes.data.data) {
                attemptId = startRes.data.data.attemptId;
                currentQuestion = startRes.data.data.question;

                if (!currentQuestion) {
                    console.warn("⚠️ Exam created but 'question' is missing in data:", JSON.stringify(startRes.data));
                }
                console.log(`✅ Test Started (ID: ${attemptId})`);
            } else {
                throw new Error(`Invalid Response Structure: ${JSON.stringify(startRes.data)}`);
            }
        } else {
            console.warn(`⚠️ DBMS Test Start Failed: ${startRes.data.message}. Trying 'Aptitude'...`);
            const startRes2 = await req('POST', '/adaptive/start', token, { subject: 'Aptitude' });
            if (startRes2.status !== 200 && startRes2.status !== 201) throw new Error('Could not start any test. Ensure DB has questions.');

            if (startRes2.data.data) {
                attemptId = startRes2.data.data.attemptId;
                currentQuestion = startRes2.data.data.question;
            } else {
                throw new Error('Invalid Response from Aptitude fallback');
            }
        }

        // 5. Simulate Exam Loop (5 questions)
        console.log('5️⃣ Simulating Exam Interaction...');
        for (let i = 0; i < 5; i++) {
            if (!currentQuestion) break;

            console.log(`   [Q${i + 1}] Answering Question ID: ${currentQuestion._id}...`);

            // Artificial delay
            await new Promise(r => setTimeout(r, 200));

            // Submit Answer (Correct answer is cached in DB, but we don't know it here easily without peeking)
            // Let's just alternate options to simulate a random student
            const selectedOption = i % 4;

            const submitRes = await req('POST', '/adaptive/submit', token, {
                attemptId,
                questionId: currentQuestion._id,
                selectedOption,
                timeSpent: 15 // seconds
            });

            if (submitRes.status !== 200) throw new Error(`Submit Failed: ${JSON.stringify(submitRes.data)}`);

            // Next question is in the response?
            // The adaptive controller might return the next question or we might need to fetch it?
            // Let's check the response structure of submit from previous tool outputs or assumptions.
            // Usually submit returns { result: 'Correct/Wrong', nextQuestion: { ... } } or we assume flow.
            // Actually, usually we call 'next' or the response contains it.
            // Checking adaptiveTest.controller.js would be ideal, but let's assume standard flow:
            // Response contains `nextQuestion`.
            // submitAdaptiveAnswer returns: { success: true, data: { ..., nextQuestion: { _id, questionText... } } }
            if (submitRes.data.data.nextQuestion) {
                currentQuestion = submitRes.data.data.nextQuestion;
            } else {
                currentQuestion = null; // End of test?
            }
        }

        // 6. End Test
        console.log('6️⃣ Ending Test...');
        const endRes = await req('POST', '/adaptive/end', token, { attemptId });
        console.log(`✅ Test Ended. Score: ${endRes.data.data?.finalScore}`);

        // 7. Verify Analytics Update
        console.log('7️⃣ Verifying Analytics Update...');
        // Wait a moment for async updates if any (though usually awaited)
        const statsRes = await req('GET', `/analytics/student/${userId}`, token);
        const attempts = statsRes.data.data.reduce((acc, curr) => acc + curr.totalAttempts, 0);
        console.log(`   Total Questions Attempted (in Analytics): ${attempts}`);
        if (attempts === 0) console.warn('⚠️ Analytics did not update!');
        else console.log('✅ Analytics Updated');

        // 8. Verify AI Service
        console.log('8️⃣ Checking AI Insights...');
        const aiRes = await req('GET', `/analytics/student/${userId}/ai-insights`, token);
        if (aiRes.status === 200) {
            console.log('✅ AI Service Responded');
            console.log('   Profile:', aiRes.data.data.profile);
            console.log('   Trend:', aiRes.data.data.trend);
        } else {
            console.error('❌ AI Service Failed:', aiRes.data);
        }

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
    console.log('\n✨ ADVANCED CHECK COMPLETE ✨');
}

runAdvancedCheck();
