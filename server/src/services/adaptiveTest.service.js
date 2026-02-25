const Question = require('../models/question.model');
const PerformanceAnalytics = require('../models/performanceAnalytics.model');
const Exam = require('../models/exam.model');

exports.generateNextTest = async (userId, subject = 'Aptitude') => {
    console.log(`🎲 Generating Adaptive Test for User: ${userId}, Subject: ${subject}`);

    // Determine target subjects
    let targetSubjects = [subject];
    if (subject === 'Mixed') {
        targetSubjects = ['DBMS', 'OS', 'CN', 'DSA', 'Aptitude', 'Verbal', 'Logical'];
    }

    // 1. Fetch User's Weak Topics (across target subjects)
    // performanceAnalytics is typically by topic/subject. 
    // We can fetch all performance metrics for the user and filter by targetSubjects if needed, 
    // or just fetch all if Mixed.
    let query = { userId };
    if (subject !== 'Mixed') {
        query.subject = subject;
    }

    const performance = await PerformanceAnalytics.find(query);

    const weakTopics = performance.filter(p => p.strengthLevel === 'Weak').map(p => p.topic);
    const averageTopics = performance.filter(p => p.strengthLevel === 'Average').map(p => p.topic);
    const strongTopics = performance.filter(p => p.strengthLevel === 'Strong').map(p => p.topic);

    let selectedQuestions = [];
    const TOTAL_QUESTIONS = 10;

    // Distribution Strategy:
    // 60% Weak (Revision/Improvement)
    // 20% New/Unattempted (Exploration)
    // 20% Strong (Confidence Boosting)

    // Helper to fetch random questions from topics
    const fetchQuestions = async (topics, count, excludeIds) => {
        if (!topics.length) return [];
        return await Question.aggregate([
            { $match: { topic: { $in: topics }, subject: { $in: targetSubjects }, _id: { $nin: excludeIds } } },
            { $sample: { size: count } }
        ]);
    };

    // A. WEAK AREA QUESTIONS (Target: 6)
    const weakCount = 6;
    let weakQuestions = await fetchQuestions(weakTopics, weakCount, []);

    // If not enough weak questions, fill with Average
    if (weakQuestions.length < weakCount) {
        const remaining = weakCount - weakQuestions.length;
        const extraAvg = await fetchQuestions(averageTopics, remaining, weakQuestions.map(q => q._id));
        weakQuestions = [...weakQuestions, ...extraAvg];
    }

    selectedQuestions = [...weakQuestions];
    const selectedIds = selectedQuestions.map(q => q._id);

    // B. STRONG AREA QUESTIONS (Target: 2)
    const strongCount = 2;
    const strongQuestions = await fetchQuestions(strongTopics, strongCount, selectedIds);
    selectedQuestions = [...selectedQuestions, ...strongQuestions];

    // C. NEW / RANDOM EXPLORATION (Target: remaining to reach 10)
    const currentCount = selectedQuestions.length;
    const needed = TOTAL_QUESTIONS - currentCount;

    if (needed > 0) {
        const randomQuestions = await Question.aggregate([
            { $match: { _id: { $nin: selectedQuestions.map(q => q._id) }, subject: { $in: targetSubjects } } },
            { $sample: { size: needed } }
        ]);
        selectedQuestions = [...selectedQuestions, ...randomQuestions];
    }

    // 2. Create the Exam Object
    const examData = {
        title: `Adaptive Test - ${new Date().toLocaleDateString()}`,
        subject: subject, // Store the selected subject (or Mixed)
        description: `Personalized test focusing on: ${weakTopics.slice(0, 3).join(', ') || 'General Practice'}`,
        duration: 20, // 20 mins for 10 questions
        totalMarks: selectedQuestions.length, // 1 mark each
        passingMarks: Math.ceil(selectedQuestions.length * 0.4),
        questions: selectedQuestions.map(q => q._id),
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
        createdBy: userId, // Self-generated
        enableNegativeMarking: true
    };

    const newExam = await new Exam(examData).save();
    console.log(`✅ Generated Exam ${newExam._id} with ${selectedQuestions.length} questions.`);

    return newExam;
};
