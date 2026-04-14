import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endAdaptiveTest, startAdaptiveTest, submitAdaptiveAnswer } from '../services/examService';
import useExamIntegrityGuard from '../hooks/useExamIntegrityGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../utils/appEvents';
import { fetchStudentSubjectScope } from '../services/subjectService';

const TOTAL_QUESTIONS_FALLBACK = 10;
const DURATION_FALLBACK_MINUTES = 20;
const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25];
const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

const formatCountdown = (totalSeconds) => {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const hasAnswerSelected = (selectedOption) => selectedOption !== null && selectedOption !== undefined;

export default function AdaptiveTest() {
    const navigate = useNavigate();

    const [step, setStep] = useState('setup');
    const [subject, setSubject] = useState('');
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [subjectScopeLoading, setSubjectScopeLoading] = useState(true);
    const [selectedQuestionCount, setSelectedQuestionCount] = useState(TOTAL_QUESTIONS_FALLBACK);
    const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(DURATION_FALLBACK_MINUTES);
    const [enableNegativeMarking, setEnableNegativeMarking] = useState(false);
    const [testTitle, setTestTitle] = useState('Adaptive Practice');
    const [attemptId, setAttemptId] = useState(null);
    const [allQuestions, setAllQuestions] = useState([]);
    const [questionStates, setQuestionStates] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(TOTAL_QUESTIONS_FALLBACK);
    const [durationMinutes, setDurationMinutes] = useState(DURATION_FALLBACK_MINUTES);
    const [attemptStartedAt, setAttemptStartedAt] = useState(null);
    const [questionViewStartedAt, setQuestionViewStartedAt] = useState(null);
    const [timeLeft, setTimeLeft] = useState(DURATION_FALLBACK_MINUTES * 60);
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [finalScore, setFinalScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState(null);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [modalMode, setModalMode] = useState('submit');
    const [tabWarningCount, setTabWarningCount] = useState(0);
    const integrityTriggeredRef = useRef(false);

    const currentQuestion = allQuestions[currentQuestionIndex] || null;
    const currentQuestionState = questionStates[currentQuestionIndex] || { selectedOption: null, committed: false };

    const answeredCount = useMemo(
        () => questionStates.filter((questionState) => hasAnswerSelected(questionState?.selectedOption)).length,
        [questionStates]
    );

    const remainingCount = Math.max(totalQuestions - answeredCount, 0);

    useEffect(() => {
        const loadSubjectScope = async () => {
            try {
                setSubjectScopeLoading(true);
                const response = await fetchStudentSubjectScope();
                const nextOptions = response.subjectOptions || [];
                setSubjectOptions(nextOptions);
                setSubject((currentSubject) => {
                    if (currentSubject && (currentSubject === 'Mixed' || nextOptions.some((option) => option.code === currentSubject))) {
                        return currentSubject;
                    }

                    return nextOptions[0]?.code || '';
                });
            } catch (subjectError) {
                console.error('Failed to load subject scope:', subjectError);
                setError(subjectError?.response?.data?.message || subjectError.message);
            } finally {
                setSubjectScopeLoading(false);
            }
        };

        loadSubjectScope();
    }, []);

    useEffect(() => {
        if (step !== 'question' || !attemptStartedAt) {
            return undefined;
        }

        const updateTimeLeft = () => {
            const totalSeconds = durationMinutes * 60;
            const elapsedSeconds = Math.floor((Date.now() - attemptStartedAt) / 1000);
            setTimeLeft(Math.max(0, totalSeconds - elapsedSeconds));
        };

        updateTimeLeft();
        const intervalId = window.setInterval(updateTimeLeft, 1000);
        return () => window.clearInterval(intervalId);
    }, [attemptStartedAt, durationMinutes, step]);

    useEffect(() => {
        if (step !== 'question' || timeLeft > 0 || ending || loading || !attemptId) {
            return;
        }

        const handleTimeout = async () => {
            await finalizeAdaptiveTest('submit', { skipConfirm: true });
        };

        handleTimeout();
    }, [attemptId, ending, loading, step, timeLeft]);

    const updateQuestionState = (index, updater) => {
        setQuestionStates((prev) => {
            const next = [...prev];
            const currentState = next[index] || { selectedOption: null, committed: false };
            next[index] = typeof updater === 'function' ? updater(currentState) : { ...currentState, ...updater };
            return next;
        });
    };

    const handleStart = async () => {
        if (!subject) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await startAdaptiveTest({
                subject,
                totalQuestions: selectedQuestionCount,
                durationMinutes: selectedDurationMinutes,
                enableNegativeMarking,
            });
            if (!response.success || !response.data?.question) {
                throw new Error(response.message || 'Failed to start adaptive practice.');
            }

            const startedAt = response.data.startedAt ? new Date(response.data.startedAt).getTime() : Date.now();
            const duration = Number(response.data.duration) || DURATION_FALLBACK_MINUTES;

            setAttemptId(response.data.attemptId);
            setTestTitle(response.data.title || `${subject} Adaptive Practice`);
            setAllQuestions([response.data.question]);
            setQuestionStates([{ selectedOption: null, committed: false }]);
            setCurrentQuestionIndex(0);
            setTotalQuestions(response.data.totalQuestions || TOTAL_QUESTIONS_FALLBACK);
            setDurationMinutes(duration);
            setAttemptStartedAt(startedAt);
            setQuestionViewStartedAt(Date.now());
            setTimeLeft(duration * 60);
            setFinalScore(0);
            setMarkedForReview(new Set());
            setShowSubmitModal(false);
            setStep('question');
        } catch (startError) {
            console.error('Adaptive start failed:', startError);
            setError(startError?.response?.data?.message || startError.message);
        } finally {
            setLoading(false);
        }
    };

    const changeQuestion = (nextIndex) => {
        if (nextIndex < 0 || nextIndex >= allQuestions.length) {
            return;
        }

        setCurrentQuestionIndex(nextIndex);
        setQuestionViewStartedAt(Date.now());
    };

    const handleSelectOption = (optionIndex) => {
        if (loading || ending || currentQuestionState.committed) {
            return;
        }

        updateQuestionState(currentQuestionIndex, { selectedOption: optionIndex });
    };

    const handleMarkForReview = () => {
        setMarkedForReview((prev) => {
            const next = new Set(prev);
            if (next.has(currentQuestionIndex)) {
                next.delete(currentQuestionIndex);
            } else {
                next.add(currentQuestionIndex);
            }
            return next;
        });
    };

    const handleQuestionJump = (questionIndex) => {
        if (questionIndex >= allQuestions.length) {
            return;
        }

        changeQuestion(questionIndex);
    };

    const commitCurrentQuestion = async () => {
        if (!attemptId || !currentQuestion) {
            return { finished: false };
        }

        if (currentQuestionState.committed) {
            return { finished: false };
        }

        const timeSpent = questionViewStartedAt
            ? Math.max(0, Math.floor((Date.now() - questionViewStartedAt) / 1000))
            : 0;

        const response = await submitAdaptiveAnswer({
            attemptId,
            questionId: currentQuestion._id,
            selectedOption: currentQuestionState.selectedOption ?? null,
            timeSpent,
        });

        if (!response.success) {
            throw new Error(response.message || 'Failed to save adaptive answer.');
        }

        updateQuestionState(currentQuestionIndex, { committed: true });

        if (response.data?.isExamFinished) {
            setFinalScore(response.data.finalScore || 0);
            setStep('result');
            return { finished: true };
        }

        if (response.data?.nextQuestion) {
            setAllQuestions((prev) => [...prev, response.data.nextQuestion]);
            setQuestionStates((prev) => [...prev, { selectedOption: null, committed: false }]);
            setCurrentQuestionIndex((prev) => prev + 1);
            setQuestionViewStartedAt(Date.now());
        }

        return { finished: false };
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex === 0 || loading) {
            return;
        }

        changeQuestion(currentQuestionIndex - 1);
    };

    const handleNextQuestion = async () => {
        if (!currentQuestion || loading || ending) {
            return;
        }

        setError(null);

        if (currentQuestionIndex < allQuestions.length - 1) {
            changeQuestion(currentQuestionIndex + 1);
            return;
        }

        setLoading(true);
        try {
            await commitCurrentQuestion();
        } catch (nextError) {
            console.error('Adaptive next question failed:', nextError);
            setError(nextError?.response?.data?.message || nextError.message);
        } finally {
            setLoading(false);
        }
    };

    const openSubmitModal = (mode) => {
        setModalMode(mode);
        setShowSubmitModal(true);
    };

    const closeSubmitModal = () => {
        setShowSubmitModal(false);
    };

    const finalizeAdaptiveTest = async (mode, { skipConfirm = false } = {}) => {
        if (!attemptId || ending) {
            return;
        }

        if (!skipConfirm) {
            closeSubmitModal();
        }

        setEnding(true);
        setError(null);

        try {
            if (step === 'question' && currentQuestion && !currentQuestionState.committed) {
                const commitResult = await commitCurrentQuestion();
                if (commitResult.finished) {
                    return;
                }
            }

            const response = await endAdaptiveTest(attemptId);
            if (!response.success) {
                throw new Error(response.message || `Failed to ${mode === 'end' ? 'end' : 'submit'} adaptive practice.`);
            }

            setFinalScore(response.data?.finalScore || 0);
            setStep('result');
        } catch (finalizeError) {
            console.error('Adaptive finalization failed:', finalizeError);
            setError(finalizeError?.response?.data?.message || finalizeError.message);
        } finally {
            setEnding(false);
            setLoading(false);
        }
    };

    const handleIntegrityViolation = async () => {
        if (step !== 'question' || !attemptId || ending || loading || integrityTriggeredRef.current) {
            return;
        }

        integrityTriggeredRef.current = true;
        await finalizeAdaptiveTest('submit', { skipConfirm: true });
    };

    const handleIntegrityWarning = async (count) => {
        setTabWarningCount(count);
        showToast('Warning: do not switch tabs during the adaptive test. One more tab switch will end the attempt automatically.', { type: 'warning', duration: 5000 });
    };

    useExamIntegrityGuard({
        enabled: step === 'question' && Boolean(attemptId) && !loading && !ending,
        onWarning: handleIntegrityWarning,
        onViolation: handleIntegrityViolation,
        beforeUnloadMessage: 'Leaving or switching tabs will automatically end your adaptive test.',
        maxWarnings: 1,
    });

    if (step === 'setup') {
        return (
            <div className="container flex-center" style={{ minHeight: '80vh' }}>
                <div className="card" style={{ maxWidth: '520px', width: '100%', marginBottom: 0 }}>
                    <div className="card-header" style={{ textAlign: 'center' }}>Adaptive Practice</div>
                    <div className="card-body">
                        <p className="text-muted" style={{ marginTop: 0, marginBottom: 20, textAlign: 'center' }}>
                            Start a personalized practice session that adjusts by subject and performance. Adaptive practice is separate from assigned exams.
                        </p>

                        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

                        <div className="form-group">
                            <label>Select Subject</label>
                            <select value={subject} onChange={(event) => setSubject(event.target.value)} disabled={subjectScopeLoading || loading}>
                                <option value="">-- Choose Subject --</option>
                                {subjectOptions.map((option) => <option key={option.code} value={option.code}>{option.name || option.code}</option>)}
                                {subjectOptions.length > 1 && <option value="Mixed">Mixed (All Subjects)</option>}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Question Count</label>
                            <select value={selectedQuestionCount} onChange={(event) => setSelectedQuestionCount(Number(event.target.value))}>
                                {QUESTION_COUNT_OPTIONS.map((count) => (
                                    <option key={count} value={count}>{count} questions</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Duration</label>
                            <select value={selectedDurationMinutes} onChange={(event) => setSelectedDurationMinutes(Number(event.target.value))}>
                                {DURATION_OPTIONS.map((minutes) => (
                                    <option key={minutes} value={minutes}>{minutes} minutes</option>
                                ))}
                            </select>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                            <input type="checkbox" checked={enableNegativeMarking} onChange={(event) => setEnableNegativeMarking(event.target.checked)} />
                            <span>Enable negative marking for this practice session</span>
                        </label>

                        <button className="button button-lg" onClick={handleStart} disabled={!subject || loading || subjectScopeLoading} style={{ width: '100%' }}>
                            {loading ? 'Starting...' : 'Start Adaptive Test'}
                        </button>
                        <button className="button-secondary" onClick={() => navigate('/history')} style={{ width: '100%', marginTop: 12 }}>
                            View Test History
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'result') {
        return (
            <div className="container flex-center" style={{ minHeight: '80vh', flexDirection: 'column', textAlign: 'center' }}>
                <div className="card" style={{ maxWidth: '560px', width: '100%', marginBottom: 0 }}>
                                        <div className="card-header">Adaptive Practice Complete</div>
                    <div className="card-body">
                        <h1 style={{ margin: '0 0 8px 0' }}>{finalScore}</h1>
                        <p className="text-muted" style={{ margin: '0 0 24px 0' }}>Final score</p>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button className="button" onClick={() => navigate(`/analysis/${attemptId}`)}>View Result</button>
                                                        <button className="button-secondary" onClick={() => navigate('/history')}>View Test History</button>
                            <button className="button-secondary" onClick={() => {
                                setStep('setup');
                                setSubject('');
                                setSelectedQuestionCount(TOTAL_QUESTIONS_FALLBACK);
                                setSelectedDurationMinutes(DURATION_FALLBACK_MINUTES);
                                setEnableNegativeMarking(false);
                                setAttemptId(null);
                                setAllQuestions([]);
                                setQuestionStates([]);
                                setCurrentQuestionIndex(0);
                                setMarkedForReview(new Set());
                                setError(null);
                            }}>Start Another Practice Test</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentQuestion) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: 'var(--bg)' }}>
            <div style={{ flex: 1, padding: 24 }}>
                {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

                <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-header" style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 12, padding: '10px 12px', background: tabWarningCount > 0 ? '#fef2f2' : '#fff7ed', border: `1px solid ${tabWarningCount > 0 ? '#fca5a5' : '#fdba74'}`, color: tabWarningCount > 0 ? '#991b1b' : '#9a3412', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600 }}>
                            {tabWarningCount > 0
                                ? 'Warning issued: do not switch tabs again. The next tab switch will end this adaptive attempt automatically.'
                                : 'Adaptive test integrity is enforced. Do not switch tabs while attempting this test.'}
                        </div>
                        <div className="flex-between">
                            <span>{testTitle}</span>
                            <span style={{ color: timeLeft < 60 ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
                                ⏱ {formatCountdown(timeLeft)}
                            </span>
                        </div>
                    </div>

                    <div className="card-body">
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ margin: '0 0 16px 0' }}>Question {currentQuestionIndex + 1} of {totalQuestions}</h3>
                            {currentQuestion.questionImageUrl && (
                                <img
                                    src={currentQuestion.questionImageUrl}
                                    alt="Question"
                                    style={{ display: 'block', maxWidth: '100%', maxHeight: '320px', marginBottom: 16, borderRadius: '12px', border: '1px solid var(--border)' }}
                                />
                            )}
                            <p style={{ fontSize: '1.05rem', lineHeight: '1.6', marginBottom: 0 }}>{currentQuestion.questionText}</p>
                        </div>

                        {currentQuestionState.committed && (
                            <div className="alert" style={{ marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                                This question is locked because the adaptive engine already used it to generate later questions.
                            </div>
                        )}

                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {currentQuestion.options.map((option, optionIndex) => (
                                    <label
                                        key={optionIndex}
                                        style={{
                                            padding: '12px',
                                            border: '2px solid var(--border)',
                                            borderRadius: '6px',
                                            cursor: currentQuestionState.committed ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s',
                                            backgroundColor: currentQuestionState.selectedOption === optionIndex ? 'var(--primary-light)' : '#fff',
                                            borderColor: currentQuestionState.selectedOption === optionIndex ? 'var(--primary)' : 'var(--border)',
                                            opacity: currentQuestionState.committed ? 0.75 : 1,
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name={`adaptive-answer-${currentQuestionIndex}`}
                                            checked={currentQuestionState.selectedOption === optionIndex}
                                            onChange={() => handleSelectOption(optionIndex)}
                                            disabled={currentQuestionState.committed || loading || ending}
                                            style={{ marginRight: 12 }}
                                        />
                                        <span>{String.fromCharCode(65 + optionIndex)}. {option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="card-footer" style={{ marginTop: 24, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                className={markedForReview.has(currentQuestionIndex) ? 'button-warning' : 'button-secondary'}
                                onClick={handleMarkForReview}
                            >
                                {markedForReview.has(currentQuestionIndex) ? '⭐ Marked for Review' : '☆ Mark for Review'}
                            </button>
                            <button disabled={currentQuestionIndex === 0 || loading} className="button-secondary" onClick={handlePreviousQuestion}>← Previous Question</button>
                            <button disabled={loading || ending} className="button" onClick={handleNextQuestion}>{loading ? 'Loading...' : 'Next Question →'}</button>
                            <button onClick={() => openSubmitModal('end')} className="button-warning" style={{ marginLeft: 'auto' }} disabled={ending}>End Practice</button>
                            <button onClick={() => openSubmitModal('submit')} disabled={ending} className="button-success">
                                {ending ? 'Submitting...' : '✓ Submit Practice'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ width: 320, padding: 24, background: '#fff', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>📋 Navigator</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                    {Array.from({ length: totalQuestions }).map((_, index) => {
                        const questionState = questionStates[index];
                        const isAvailable = index < allQuestions.length;
                        const isCurrent = index === currentQuestionIndex;
                        const isAnswered = hasAnswerSelected(questionState?.selectedOption);
                        const isMarked = markedForReview.has(index);

                        let background = '#e5e7eb';
                        let borderColor = '#d1d5db';
                        let textColor = '#000';
                        let boxShadow = 'none';

                        if (isCurrent) {
                            background = '#2563eb';
                            borderColor = '#1d4ed8';
                            textColor = '#fff';
                            boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.3)';
                        } else if (isMarked) {
                            background = '#f59e0b';
                            borderColor = '#d97706';
                            textColor = '#fff';
                        } else if (isAnswered) {
                            background = '#22c55e';
                            borderColor = '#16a34a';
                            textColor = '#fff';
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleQuestionJump(index)}
                                disabled={!isAvailable}
                                title={isAvailable ? `Question ${index + 1}` : `Question ${index + 1} not available yet`}
                                style={{
                                    padding: '8px',
                                    background,
                                    color: textColor,
                                    border: `2px solid ${borderColor}`,
                                    borderRadius: 4,
                                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    boxShadow,
                                    opacity: isAvailable ? 1 : 0.55,
                                }}
                            >
                                {index + 1}
                            </button>
                        );
                    })}
                </div>

                <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <p style={{ margin: '8px 0' }}><span style={{ color: '#2563eb', fontWeight: '600' }}>●</span> Current</p>
                    <p style={{ margin: '8px 0' }}><span style={{ color: '#22c55e', fontWeight: '600' }}>●</span> Answered</p>
                    <p style={{ margin: '8px 0' }}><span style={{ color: '#e5e7eb', fontWeight: '600' }}>●</span> Not Visited</p>
                    <p style={{ margin: '8px 0' }}><span style={{ color: '#f59e0b', fontWeight: '600' }}>●</span> Review</p>
                </div>

                <button
                    onClick={() => openSubmitModal('end')}
                    className="button-warning"
                    style={{ marginTop: '24px', width: '100%' }}
                    disabled={ending}
                >
                    End Early
                </button>
            </div>

            {showSubmitModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={closeSubmitModal}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: '8px',
                            padding: '32px',
                            minWidth: '400px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            zIndex: 1001,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{modalMode === 'end' ? 'End Adaptive Practice' : 'Submit Adaptive Practice'}</h3>
                        <p style={{ marginBottom: '8px' }}>
                            You have <strong>{remainingCount}</strong> unanswered question(s).
                        </p>
                        <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>
                            {modalMode === 'end'
                                ? 'The current adaptive attempt will be closed immediately.'
                                : 'Your adaptive practice session will be submitted and no further changes will be possible.'}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={closeSubmitModal} className="button-secondary">Cancel</button>
                            <button onClick={() => finalizeAdaptiveTest(modalMode)} disabled={ending} className={modalMode === 'end' ? 'button-warning' : 'button-success'}>
                                {ending ? 'Processing...' : modalMode === 'end' ? 'End Practice' : 'Submit Practice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
