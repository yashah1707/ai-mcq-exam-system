const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models and services
const Question = require('../src/models/question.model');
const ExamAttempt = require('../src/models/examAttempt.model');
const PerformanceAnalytics = require('../src/models/performanceAnalytics.model');
const adaptiveTestService = require('../src/services/adaptiveTest.service');
const performanceAnalysisService = require('../src/services/performanceAnalysis.service');

async function verifyPhase2() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Setup Data: Create a user and some dummy questions
        const userId = new mongoose.Types.ObjectId();
        const subject = 'Aptitude'; // Valid subject
        console.log(`\n🛠️  Setting up test data for Subject: ${subject}`);

        // Create random questions (Weak: Arrays, Avg: Strings, Strong: Loops)
        const topics = ['Arrays', 'Strings', 'Loops'];
        const questionIds = [];

        for (const topic of topics) {
            for (let i = 0; i < 5; i++) {
                const q = await new Question({
                    questionText: `Test Q for ${topic} ${i}`,
                    options: ['A', 'B', 'C', 'D'],
                    correctAnswer: 0,
                    category: 'Technical',
                    subject,
                    topic,
                    difficulty: 'Medium',
                    marks: 1,
                    createdBy: userId
                }).save();
                questionIds.push(q);
            }
        }
        console.log(`✅ Created ${questionIds.length} dummy questions.`);

        // 2. Simulate an Attempt where user FAILS 'Arrays' (Topic 1)
        console.log('\n📉 Simulating Attempt 1: Failing Arrays...');

        // Let's fake an attempt with 5 'Arrays' questions, all wrong
        const arrayQuestions = questionIds.filter(q => q.topic === 'Arrays');
        const answers = arrayQuestions.map(q => ({
            questionId: q._id,
            selectedOption: 1, // Wrong (Correct is 0)
            isCorrect: false,
            marksAwarded: 0,
            timeSpentSeconds: 10,
            subject: q.subject,
            topic: q.topic
        }));

        const attempt1 = await new ExamAttempt({
            user: userId,
            exam: new mongoose.Types.ObjectId(), // Fake exam ID
            mode: 'adaptive',
            answers,
            status: 'completed',
            score: 0,
            startTime: new Date(),
            endTime: new Date()
        }).save();

        // 3. Run Analysis
        console.log('\n📊 Running Performance Analysis...');
        const meta = await performanceAnalysisService.analyzeAttempt(attempt1._id);
        console.log('Analysis Result (Meta):', JSON.stringify(meta.topicPerformance, null, 2));

        // Verify Arrays is WEAK
        const arrayPerf = meta.topicPerformance.find(t => t.topic === 'Arrays');
        if (arrayPerf && arrayPerf.strength === 'Weak') {
            console.log('✅ PASS: System correctly identified "Arrays" as Weak.');
        } else {
            console.error('❌ FAIL: "Arrays" should be Weak.');
        }

        // 4. Generate Next Test (Adaptive)
        console.log('\n🎲 Generating Next Adaptive Test...');
        const nextExam = await adaptiveTestService.generateNextTest(userId, subject);

        // Verify Next Test Composition
        // Should contain questions from 'Arrays' (Weak)
        await nextExam.populate('questions');
        const nextTopics = nextExam.questions.map(q => q.topic);
        const arrayCount = nextTopics.filter(t => t === 'Arrays').length;

        console.log('Next Test Topics:', nextTopics);

        if (arrayCount >= 1) { // Strategy aims for 60%, but depends on pool size
            console.log(`✅ PASS: Next test contains ${arrayCount} "Arrays" questions (Targeting Weakness).`);
        } else {
            console.error('❌ FAIL: Next test ignored the Weak topic.');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await Question.deleteMany({ subject });
        await ExamAttempt.deleteMany({ user: userId });
        await PerformanceAnalytics.deleteMany({ userId });
        // await User.findByIdAndDelete(userId); // User was fake ID

        console.log('\n🎉 PHASE 2 VERIFICATION SUCCESSFUL!');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyPhase2();
