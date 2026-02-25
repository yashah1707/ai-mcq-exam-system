import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAdaptiveTest, submitAdaptiveAnswer, endAdaptiveTest } from '../services/examService';
import Toast from '../components/Toast';

export default function AdaptiveTest() {
    const navigate = useNavigate();
    const [step, setStep] = useState('setup'); // setup, question, result
    const [ending, setEnding] = useState(false);

    // ... existing code ...

    const handleEndTest = async () => {
        if (!attemptId) return;
        if (!window.confirm("Are you sure you want to end the test early?")) return;

        try {
            setEnding(true);
            const res = await endAdaptiveTest(attemptId);
            if (res.success) {
                setFinalScore(res.data.finalScore);
                setStep('result');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setEnding(false);
        }
    };
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(false);

    // Test State
    const [attemptId, setAttemptId] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [finalScore, setFinalScore] = useState(0);
    const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [startTime, setStartTime] = useState(null);

    const handleStart = async () => {
        if (!subject) return;
        setLoading(true);
        try {
            const res = await startAdaptiveTest(subject);
            if (res.success) {
                setAttemptId(res.data.attemptId);
                setCurrentQuestion(res.data.question);
                setCurrentQuestionNumber(res.data.currentQuestionNumber);
                setTotalQuestions(res.data.totalQuestions);
                setStep('question');
                setStartTime(Date.now());
            }
        } catch (error) {
            console.error("Start Error:", error);
            window.alert("Failed to start test. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const processSubmission = async () => {
        if (selectedOption === null) return;
        setLoading(true);
        try {
            // Calculate elapsed time for this question
            const timeTaken = Math.floor((Date.now() - startTime) / 1000);
            const res = await submitAdaptiveAnswer({
                attemptId,
                questionId: currentQuestion._id,
                selectedOption,
                timeSpent: timeTaken
            });

            if (res.success) {
                if (res.data.isExamFinished) {
                    setFinalScore(res.data.finalScore);
                    setStep('result');
                } else {
                    // Update state for next question
                    setCurrentQuestion(res.data.nextQuestion);
                    setCurrentQuestionNumber(res.data.currentQuestionNumber);
                    setTotalQuestions(res.data.totalQuestions);
                    setSelectedOption(null);
                    setFeedback(null);
                    setStartTime(Date.now());
                }
            }
        } catch (error) {
            console.error("Submit Error:", error);
            window.alert("Failed to submit answer. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentQuestion) {
            // Create array with original index to preserve mapping
            const opts = currentQuestion.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
            // Fisher-Yates Shuffle
            for (let i = opts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [opts[i], opts[j]] = [opts[j], opts[i]];
            }
            setShuffledOptions(opts);
        }
    }, [currentQuestion]);

    // Timer Effect
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        let interval;
        if (step === 'question' && !loading) {
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, loading, startTime]);

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (step === 'setup') {
        return (
            <div className="container flex-center" style={{ minHeight: '80vh', background: 'transparent', boxShadow: 'none', border: 'none' }}>
                <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '40px', backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.95)' }}>
                    <div className="text-center mb-4">
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
                        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Adaptive Mode</h2>
                        <p className="text-muted">AI-powered assessment that adjusts to your skill level.</p>
                    </div>

                    <div className="form-group">
                        <label className="text-bold">Select Subject</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem' }}
                        >
                            <option value="">-- Choose Subject --</option>
                            <option value="DBMS">DBMS</option>
                            <option value="OS">Operating Systems</option>
                            <option value="CN">Computer Networks</option>
                            <option value="DSA">Data Structures</option>
                            <option value="Aptitude">Aptitude</option>
                            <option value="Verbal">Verbal Ability</option>
                            <option value="Logical">Logical Reasoning</option>
                            <option value="Mixed">Mixed (All Subjects)</option>
                        </select>
                    </div>

                    <button
                        className="button button-lg"
                        onClick={handleStart}
                        disabled={!subject || loading}
                        style={{ width: '100%', marginTop: '24px', borderRadius: '8px', fontWeight: 'bold' }}
                    >
                        {loading ? 'Initializing AI...' : 'Start Assessment →'}
                    </button>

                    <div className="text-center mt-3">
                        <small className="text-muted">10 Questions • Difficulty Varies • Instant Analysis</small>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'result') {
        return (
            <div className="container flex-center" style={{ minHeight: '80vh', flexDirection: 'column', textAlign: 'center' }}>
                <div className="card" style={{ padding: '48px', maxWidth: '600px', width: '100%', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🎉</div>
                    <h1 style={{ marginBottom: '8px' }}>Assessment Complete!</h1>
                    <p className="text-muted" style={{ fontSize: '1.2rem' }}>You've demonstrated your knowledge.</p>

                    <div style={{
                        margin: '32px auto',
                        width: '180px', height: '180px',
                        borderRadius: '50%',
                        background: 'conic-gradient(var(--primary) 0%, var(--primary) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        boxShadow: '0 10px 30px rgba(11, 95, 255, 0.3)'
                    }}>
                        <div style={{
                            width: '160px', height: '160px',
                            borderRadius: '50%', background: 'white',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <span style={{ fontSize: '3.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1 }}>{finalScore}</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Points</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                        <button
                            className="button button-lg"
                            onClick={() => navigate(`/analysis/${attemptId}`)}
                            style={{ flex: 1 }}
                        >
                            View Deep Analysis 📊
                        </button>
                    </div>
                    <button
                        onClick={() => setStep('setup')}
                        style={{ marginTop: '24px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Take Another Test
                    </button>
                </div>
            </div>
        );
    }

    // Question Step (Exam Interface)
    const progressPercent = ((currentQuestionNumber - 1) / totalQuestions) * 100;

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: 'var(--bg)', padding: '24px' }}>
            {/* Left Panel: Main Question Area */}
            <div style={{ flex: 1, minWidth: 0, marginRight: '24px' }}>
                {/* Header: Progress & Timer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{subject} Assessment</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '8px 16px', borderRadius: '20px', boxShadow: 'var(--shadow-sm)' }}>
                        <span>⏱️</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text)' }}>{formatTime(elapsed)}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '32px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                </div>

                <div className="card" style={{ padding: '0', overflow: 'hidden', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
                    {/* Question Header */}
                    <div style={{
                        padding: '24px 32px',
                        background: 'linear-gradient(to right, #f8fafc, #fff)',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <span style={{
                            background: 'var(--primary-light)', color: 'var(--primary)',
                            padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem'
                        }}>
                            Question {currentQuestionNumber} <span style={{ opacity: 0.6 }}>/ {totalQuestions}</span>
                        </span>

                        <span style={{
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase',
                            backgroundColor: currentQuestion?.difficulty === 'Hard' ? '#fee2e2' : currentQuestion?.difficulty === 'Medium' ? '#fef3c7' : '#dcfce7',
                            color: currentQuestion?.difficulty === 'Hard' ? '#991b1b' : currentQuestion?.difficulty === 'Medium' ? '#92400e' : '#166534'
                        }}>
                            {currentQuestion?.difficulty} Level
                        </span>
                    </div>

                    <div style={{ padding: '32px' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '600', lineHeight: '1.5', marginBottom: '32px', color: 'var(--text)' }}>
                            {currentQuestion?.questionText}
                        </h2>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            {shuffledOptions.map((optObj, idx) => {
                                const isSelected = selectedOption === optObj.originalIndex;
                                const isCorrect = feedback && feedback.correctAnswer === optObj.originalIndex;
                                const isWrong = feedback && isSelected && !feedback.isCorrect;

                                let cardStyle = {
                                    padding: '20px',
                                    border: '2px solid',
                                    borderColor: 'var(--border)',
                                    borderRadius: '12px',
                                    cursor: feedback ? 'default' : 'pointer',
                                    background: 'white',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex', alignItems: 'center', gap: '16px'
                                };

                                if (feedback) {
                                    if (isCorrect) {
                                        cardStyle.background = '#f0fdf4';
                                        cardStyle.borderColor = '#16a34a';
                                    } else if (isWrong) {
                                        cardStyle.background = '#fef2f2';
                                        cardStyle.borderColor = '#dc2626';
                                    } else {
                                        cardStyle.opacity = 0.6;
                                    }
                                } else if (isSelected) {
                                    cardStyle.background = 'var(--primary-light)';
                                    cardStyle.borderColor = 'var(--primary)';
                                    cardStyle.transform = 'translateY(-2px)';
                                    cardStyle.boxShadow = 'var(--shadow-md)';
                                }

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => !feedback && setSelectedOption(optObj.originalIndex)}
                                        style={cardStyle}
                                        onMouseEnter={(e) => {
                                            if (!feedback && !isSelected) {
                                                e.currentTarget.style.borderColor = 'var(--primary)';
                                                e.currentTarget.style.background = '#f8fafc';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!feedback && !isSelected) {
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                                e.currentTarget.style.background = 'white';
                                            }
                                        }}
                                    >
                                        <div style={{
                                            width: '32px', height: '32px',
                                            borderRadius: '50%',
                                            background: isSelected || (feedback && isCorrect) ? (feedback && isCorrect ? '#16a34a' : 'var(--primary)') : '#f1f5f9',
                                            color: isSelected || (feedback && isCorrect) ? 'white' : '#64748b',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0
                                        }}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span style={{ fontSize: '1.05rem', fontWeight: isSelected ? '500' : '400' }}>{optObj.text}</span>

                                        {feedback && isCorrect && <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>✅</span>}
                                        {feedback && isWrong && <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>❌</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {loading && <span className="text-muted mr-3" style={{ marginRight: '16px' }}>Processing...</span>}
                        <button
                            className="button button-lg"
                            onClick={processSubmission}
                            disabled={selectedOption === null || loading}
                            style={{ padding: '12px 32px', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}
                        >
                            {loading ? 'Wait...' : 'Next Question →'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Navigator */}
            <div style={{ flex: 1, minWidth: '250px', maxWidth: '300px' }}>
                <div className="card" style={{ padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.1rem', color: 'var(--text)' }}>Question Navigator</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '12px' }}>
                        {Array.from({ length: totalQuestions }).map((_, index) => {
                            const qNum = index + 1;
                            let bgColor = '#f1f5f9'; // Pending
                            let textColor = '#64748b';
                            let borderColor = '#e2e8f0';

                            // This adaptive mode doesn't track answered questions in the same way as a fixed exam
                            // For simplicity, we'll just highlight the current question.
                            if (qNum === currentQuestionNumber) {
                                bgColor = 'var(--primary)';
                                textColor = 'white';
                                borderColor = 'var(--primary)';
                            }

                            return (
                                <div
                                    key={index}
                                    style={{
                                        width: '40px', height: '40px',
                                        borderRadius: '8px',
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        border: `1px solid ${borderColor}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 'bold',
                                        cursor: 'default', // Adaptive mode doesn't allow jumping questions
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {qNum}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <p style={{ margin: '6px 0' }}><span style={{ color: 'var(--primary)', fontWeight: '700' }}>■</span> Current</p>
                        <p style={{ margin: '6px 0' }}><span style={{ color: '#16a34a', fontWeight: '700' }}>■</span> Answered</p>
                        <p style={{ margin: '6px 0' }}><span style={{ color: '#cbd5e1', fontWeight: '700' }}>■</span> Pending</p>
                    </div>

                    <div style={{ marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Time Elapsed</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '700', fontFamily: 'monospace' }}>{formatTime(elapsed)}</div>
                    </div>

                    <button
                        onClick={handleEndTest}
                        disabled={ending}
                        style={{ width: '100%', marginTop: 16, background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        End Early
                    </button>
                </div>
            </div>
        </div>
    );
}
