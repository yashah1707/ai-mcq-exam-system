const mongoose = require('mongoose');
const ExamAttempt = require('../models/examAttempt.model');
const Question = require('../models/question.model'); // Added this import as it's used in submitAdaptiveAnswer
const adaptiveTestService = require('../services/adaptiveTest.service');
const performanceAnalysisService = require('../services/performanceAnalysis.service');

exports.startAdaptiveTest = async (req, res) => {
    try {
        const { subject } = req.body;
        const userId = req.user._id;

        console.log(`[Adaptive] Start Test Request. User: ${userId}, Subject: ${subject}`);

        if (!subject) {
            return res.status(400).json({ success: false, message: 'Subject is required.' });
        }

        // Generate a new adaptive test
        const exam = await adaptiveTestService.generateNextTest(userId, subject);

        // Create an attempt for this new exam
        const attempt = new ExamAttempt({
            user: userId,
            exam: exam._id,
            mode: 'adaptive',
            startTime: new Date(),
            status: 'in-progress',
            answers: []
        });

        // Initialize with the first question if available
        if (exam.questions && exam.questions.length > 0) {
            // We need to fetch the question details to get subject/topic if not in exam object (exam.questions is likely ID array)
            // But verify what generateNextTest returns. 
            // It returns `new Exam(...)`. The `questions` field in Exam model is ref Question.
            // But `generateNextTest` in service creates array of IDs.
            // So exam.questions is [ID, ID...].
            // We need to fetch the actual question to get subject/topic for the attempt schema?
            // Let's check attempt schema. usually answer has { questionId, subject, topic ... }
            // Detailed fetch might be needed.
            // OR we can just rely on `populate` later? 
            // Let's check `submitAdaptiveAnswer` logic which pushes NEXT question:
            // attempt.answers.push({ questionId: nextQuestion._id, subject: nextQuestion.subject, topic: nextQuestion.topic });
            // So we need subject/topic.
            // We can get subject from request or exam.

            // For now, let's fetch the first question.
            const firstQuestion = await Question.findById(exam.questions[0]);
            if (firstQuestion) {
                attempt.answers.push({
                    questionId: firstQuestion._id,
                    subject: firstQuestion.subject,
                    topic: firstQuestion.topic
                });
            }
        }

        await attempt.save();

        let firstQuestionData = null;
        if (attempt.answers.length > 0) {
            // We pushed the first question ID/details earlier. 
            // We need to return the full question object (text, options) to the frontend.
            // My previous fix pushed { questionId, subject, topic } to answers.
            // We need to fetch the full question again or keep the reference.

            // Re-fetch to be safe and get options
            const q = await Question.findById(attempt.answers[0].questionId);
            if (q) {
                firstQuestionData = {
                    _id: q._id,
                    questionText: q.questionText,
                    options: q.options,
                    marks: q.marks,
                    difficulty: q.difficulty
                };
            }
        }

        res.status(201).json({
            success: true,
            data: {
                examId: exam._id,
                attemptId: attempt._id,
                message: 'Adaptive test generated successfully',
                question: firstQuestionData,
                currentQuestionNumber: 1,
                totalQuestions: 10
            }
        });

    } catch (error) {
        console.error('Error starting adaptive test:', error);
        res.status(500).json({ message: 'Failed to start adaptive test', error: error.message });
    }
};

exports.submitAdaptiveTest = async (req, res) => {
    try {
        const { attemptId, answers } = req.body;

        const attempt = await ExamAttempt.findById(attemptId);
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        attempt.answers = answers;
        attempt.endTime = new Date();
        attempt.status = 'completed';

        // Calculate Score (Simple summation for now)
        const score = answers.reduce((acc, curr) => acc + (curr.isCorrect ? 1 : 0), 0);
        attempt.score = score;

        await attempt.save();

        // Trigger Performance Analysis (Async but awaited for now for simplicity)
        const analysisMeta = await performanceAnalysisService.analyzeAttempt(attemptId);

        res.status(200).json({
            success: true,
            message: 'Test submitted and analyzed',
            score,
            analysis: analysisMeta
        });

    } catch (error) {
        console.error('Error submitting adaptive test:', error);
        res.status(500).json({ message: 'Failed to submit test', error: error.message });
    }
};

// Submit answer and get next question
exports.submitAdaptiveAnswer = async (req, res) => {
    try {
        const userId = req.user.id;
        const { attemptId, questionId, selectedOption, timeSpent } = req.body;

        const attempt = await ExamAttempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        // Find the answer entry in the attempt
        const answerIndex = attempt.answers.findIndex(a => a.questionId.toString() === questionId);
        if (answerIndex === -1) {
            return res.status(400).json({ success: false, message: 'Question not found in this attempt' });
        }

        const currentQuestion = await Question.findById(questionId);
        if (!currentQuestion) {
            return res.status(404).json({ success: false, message: 'Question details not found' });
        }

        // 1. Grade the answer
        const isCorrect = (parseInt(selectedOption) === currentQuestion.correctAnswer);

        attempt.answers[answerIndex].selectedOption = selectedOption;
        attempt.answers[answerIndex].isCorrect = isCorrect;
        attempt.answers[answerIndex].marksAwarded = isCorrect ? 1 : 0;
        attempt.answers[answerIndex].timeSpentSeconds = timeSpent || 0;

        // Update score
        if (isCorrect) attempt.score += 1;

        // 2. Determine Next Difficulty
        let currentDifficulty = currentQuestion.difficulty;
        let nextDifficulty = currentDifficulty;

        if (isCorrect) {
            if (currentDifficulty === 'Easy') nextDifficulty = 'Medium';
            else if (currentDifficulty === 'Medium') nextDifficulty = 'Hard';
            else nextDifficulty = 'Hard';
        } else {
            if (currentDifficulty === 'Hard') nextDifficulty = 'Medium';
            else if (currentDifficulty === 'Medium') nextDifficulty = 'Easy';
            else nextDifficulty = 'Easy';
        }

        // 3. Select Next Question
        // Must exclude already attempted questions
        const attemptedIds = attempt.answers.map(a => a.questionId);

        const nextQuestions = await Question.aggregate([
            {
                $match: {
                    subject: currentQuestion.subject,
                    difficulty: nextDifficulty,
                    _id: { $nin: attemptedIds }
                }
            },
            { $sample: { size: 1 } }
        ]);

        let nextQuestion = null;
        if (nextQuestions.length > 0) {
            nextQuestion = nextQuestions[0];
        } else {
            // Fallback: If no question of target difficulty, try ANY difficulty not attempted
            const fallbackQuestions = await Question.aggregate([
                {
                    $match: {
                        subject: currentQuestion.subject,
                        _id: { $nin: attemptedIds }
                    }
                },
                { $sample: { size: 1 } }
            ]);
            if (fallbackQuestions.length > 0) {
                nextQuestion = fallbackQuestions[0];
            }
        }

        if (nextQuestion && attempt.answers.length < 10) {
            // Add next question to attempt
            attempt.answers.push({
                questionId: nextQuestion._id,
                subject: nextQuestion.subject,
                topic: nextQuestion.topic
            });
            await attempt.save();

            // Return result and next question
            res.json({
                success: true,
                data: {
                    isCorrect,
                    correctAnswer: currentQuestion.correctAnswer, // Feedback
                    explanation: currentQuestion.explanation,
                    currentQuestionNumber: attempt.answers.length,
                    totalQuestions: 10,
                    nextQuestion: {
                        _id: nextQuestion._id,
                        questionText: nextQuestion.questionText,
                        options: nextQuestion.options,
                        marks: nextQuestion.marks,
                        difficulty: nextQuestion.difficulty
                    }
                }
            });
        } else {
            // No more questions -> Finish Exam
            attempt.status = 'completed';
            attempt.endTime = new Date();
            await attempt.save();

            // Trigger analytics update
            await performanceAnalysisService.analyzeAttempt(attempt._id);

            res.json({
                success: true,
                data: {
                    isCorrect,
                    correctAnswer: currentQuestion.correctAnswer,
                    explanation: currentQuestion.explanation,
                    isExamFinished: true,
                    finalScore: attempt.score
                }
            });
        }

    } catch (error) {
        console.error('Error in adaptive submission:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Force end an adaptive test
exports.endAdaptiveTest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { attemptId } = req.body;

        const attempt = await ExamAttempt.findById(attemptId);
        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        if (attempt.status === 'completed') {
            return res.json({ success: true, message: 'Already completed', data: { finalScore: attempt.score } });
        }

        // Check if the last question was unanswered
        // If the last answer in array has no selectedOption, we can remove it or keep it as skipped.
        // Usually, we want to count it as skipped (unattempted).
        // My updatePerformanceMetrics logic handles unattempted if selectedOption is undefined.

        attempt.status = 'completed';
        attempt.endTime = new Date();
        await attempt.save();

        // Trigger analytics
        await performanceAnalysisService.analyzeAttempt(attemptId);

        res.json({
            success: true,
            data: {
                isExamFinished: true,
                finalScore: attempt.score
            }
        });

    } catch (error) {
        console.error('Error ending adaptive test:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAttemptAnalysis = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await ExamAttempt.findById(attemptId).populate('answers.questionId');

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        // Ensure user owns this attempt
        if (attempt.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const analysis = {
            subject: attempt.subject,
            score: attempt.score,
            totalQuestions: attempt.answers.length,
            startTime: attempt.startTime,
            endTime: attempt.endTime,
            questions: attempt.answers.map(ans => ({
                questionText: ans.questionId.questionText,
                options: ans.questionId.options,
                correctAnswer: ans.questionId.correctAnswer,
                selectedOption: ans.selectedOption,
                isCorrect: ans.isCorrect,
                explanation: ans.questionId.explanation,
                difficulty: ans.questionId.difficulty
            }))
        };

        res.json({ success: true, data: analysis });
    } catch (error) {
        console.error('Error fetching analysis:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
