import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startExam, saveAnswerWithRetry, submitExam, cancelAttempt, getAttempt } from '../services/examAttemptService';
import { getExamById } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import SaveIndicator from '../components/SaveIndicator';
import useExamIntegrityGuard from '../hooks/useExamIntegrityGuard';
import { showToast } from '../utils/appEvents';

export default function ExamPage({ examId, onComplete }) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionStatus, setQuestionStatus] = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tabWarningCount, setTabWarningCount] = useState(0);
  const integrityTriggeredRef = useRef(false);

  // Start exam
  useEffect(() => {
    const init = async () => {
      try {
        // Try to restore an existing attempt from localStorage
        const storageKey = `attempt_${examId}`;
        let attemptId = localStorage.getItem(storageKey);
        let res;
        if (attemptId) {
          res = await getAttempt(attemptId);
        } else {
          res = await startExam(examId);
          attemptId = res.attempt._id || res.attempt.id;
          if (attemptId) localStorage.setItem(storageKey, attemptId);
        }

        const attemptObj = res.attempt;
        setAttempt(attemptObj);

        // Fetch exam data separately (attempt.exam is just an ID, not populated)
        const examRes = await getExamById(attemptObj.exam?._id || attemptObj.exam);
        const examObj = examRes.exam;
        setExam(examObj);

        // compute timeLeft from startTime and duration to survive reloads
        const durationSeconds = (examObj.duration || 0) * 60;
        const startTime = new Date(attemptObj.startTime).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsed);
        setTimeLeft(remaining);

        // Extract questions directly from attempt.answers (already populated by server)
        const qList = attemptObj.answers
          .map(a => a.questionId)
          .filter(q => q && typeof q === 'object' && q._id);

        if (qList.length > 0) {
          setQuestions(qList);
        } else {
          // Fallback: use the already-populated exam payload for older attempts.
          const fetched = (examObj.questions || []).filter((question) => question && typeof question === 'object' && question._id);
          setQuestions(fetched);
        }

        // restore current question index if present
        try {
          const idx = parseInt(localStorage.getItem(`attempt_${examId}_idx`));
          if (!Number.isNaN(idx) && idx >= 0) setCurrentQIdx(idx);
        } catch (e) { }

        // Initialize question status and answers
        const initialStatus = {};
        const initialAnswers = {};
        for (let i = 0; i < qList.length; i++) {
          initialStatus[i] = 'notVisited';
          if (attemptObj.answers[i]?.selectedOption !== null && attemptObj.answers[i]?.selectedOption !== undefined) {
            initialAnswers[i] = attemptObj.answers[i].selectedOption;
            initialStatus[i] = 'answered';
          }
        }
        // Mark first question as visited when loading
        initialStatus[0] = 'visited';
        setQuestionStatus(initialStatus);
        setAnswers(initialAnswers);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [examId]);

  // Timer — only starts after questions are loaded to prevent instant auto-submit
  useEffect(() => {
    if (!attempt || attempt.status === 'completed' || questions.length === 0 || timeLeft === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, questions.length]);

  const changeQuestion = (idx) => {
    // Mark current question as visited if not answered
    if (questionStatus[idx] === 'notVisited') {
      setQuestionStatus(prev => ({ ...prev, [idx]: 'visited' }));
    }
    setCurrentQIdx(idx);
    try { localStorage.setItem(`attempt_${examId}_idx`, String(idx)); } catch (e) { }
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!attempt || attempt.status === 'completed') return;
    const autoSave = setInterval(async () => {
      try {
        const q = questions[currentQIdx];
        const ans = attempt.answers[currentQIdx];
        if (q && ans?.selectedOption !== null) {
          setSaveStatus('saving');
          await saveAnswerWithRetry(attempt._id || attempt.id, q._id, ans.selectedOption, { retries: 3 });
          setSaveStatus('saved');
          setLastSavedAt(Date.now());
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('error');
      }
    }, 30000);
    return () => clearInterval(autoSave);
  }, [attempt, currentQIdx, questions]);

  const handleSelectOption = async (optionIdx) => {
    // Update answers and status immediately
    setAnswers(prev => ({ ...prev, [currentQIdx]: optionIdx }));
    setQuestionStatus(prev => ({ ...prev, [currentQIdx]: 'answered' }));
    
    const newAttempt = { ...attempt };
    newAttempt.answers[currentQIdx].selectedOption = optionIdx;
    setAttempt(newAttempt);

    try {
      const q = questions[currentQIdx];
      setSaveStatus('saving');
      await saveAnswerWithRetry(attempt._id || attempt.id, q._id, optionIdx, { retries: 2 });
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error('Failed to save answer:', err.message);
      setSaveStatus('error');
    }
  };

  const handleMarkForReview = () => {
    const newSet = new Set(markedForReview);
    if (newSet.has(currentQIdx)) {
      newSet.delete(currentQIdx);
    } else {
      newSet.add(currentQIdx);
    }
    setMarkedForReview(newSet);
  };

  const handlePreviousQuestion = () => {
    if (currentQIdx > 0) {
      changeQuestion(currentQIdx - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQIdx < questions.length - 1) {
      const nextIdx = currentQIdx + 1;
      // Mark as visited if not already answered
      if (questionStatus[nextIdx] === 'notVisited') {
        setQuestionStatus(prev => ({ ...prev, [nextIdx]: 'visited' }));
      }
      changeQuestion(nextIdx);
    }
  };

  const handleOpenSubmitModal = () => {
    setShowSubmitModal(true);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
  };

  const handleConfirmSubmit = async () => {
    handleCloseSubmitModal();
    setSubmitting(true);
    try {
      const attemptId = attempt._id || attempt.id;
      const res = await submitExam(attemptId);
      try { localStorage.removeItem(`attempt_${examId}`); localStorage.removeItem(`attempt_${examId}_idx`); } catch (e) { }
      onComplete(res);
    } catch (err) {
      showToast(`Failed to submit: ${err.message}`, { type: 'error' });
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) {
      return;
    }
    await handleConfirmSubmit();
  };

  const handleCancelAttempt = async () => {
    if (!attempt) {
      return;
    }

    if (!window.confirm('Cancel this in-progress attempt? Your saved answers will be discarded and you can restart the exam later.')) {
      return;
    }

    try {
      const attemptId = attempt._id || attempt.id;
      await cancelAttempt(attemptId);
      try {
        localStorage.removeItem(`attempt_${examId}`);
        localStorage.removeItem(`attempt_${examId}_idx`);
      } catch (storageError) {
        // Ignore local storage cleanup failures.
      }
      showToast('Attempt cancelled. You can restart the exam any time before it closes.', { type: 'info' });
      navigate('/exams');
    } catch (err) {
      showToast(err?.response?.data?.message || err.message, { type: 'error' });
    }
  };

  const handleIntegrityViolation = async () => {
    if (!attempt || submitting || integrityTriggeredRef.current) {
      return;
    }

    integrityTriggeredRef.current = true;
    setShowSubmitModal(false);
    setSubmitting(true);

    try {
      const attemptId = attempt._id || attempt.id;
      const res = await submitExam(attemptId);
      try {
        localStorage.removeItem(`attempt_${examId}`);
        localStorage.removeItem(`attempt_${examId}_idx`);
      } catch (storageError) {
        // Ignore local storage cleanup failures.
      }
      onComplete(res);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Exam was ended because the exam tab lost focus.');
      setSubmitting(false);
      integrityTriggeredRef.current = false;
    }
  };

  const handleIntegrityWarning = async (count) => {
    setTabWarningCount(count);
    showToast('Warning: do not switch tabs during the exam. One more tab switch will submit your exam automatically.', { type: 'warning', duration: 5000 });
  };

  useExamIntegrityGuard({
    enabled: Boolean(attempt && attempt.status !== 'completed' && questions.length > 0 && !loading && !submitting),
    onWarning: handleIntegrityWarning,
    onViolation: handleIntegrityViolation,
    beforeUnloadMessage: 'Leaving or switching tabs will automatically submit your exam.',
    maxWarnings: 1,
  });

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="container alert alert-danger">{error}</div>;
  if (!attempt || !questions.length) return <div className="container">No exam data</div>;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const q = questions[currentQIdx];
  const ans = attempt.answers[currentQIdx];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 67px)', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: tabWarningCount > 0 ? '#fef2f2' : '#fff7ed', border: `1.5px solid ${tabWarningCount > 0 ? '#fca5a5' : '#fdba74'}`, color: tabWarningCount > 0 ? '#991b1b' : '#9a3412', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              {tabWarningCount > 0
                ? '⚠️ Warning issued: do not switch tabs again. Next switch will auto-submit your exam.'
                : '🔒 Exam integrity enforced — do not switch tabs while attempting this exam.'}
            </div>
            <div className="flex-between">
              <span style={{ fontWeight: 800, fontSize: '1.05rem', fontFamily: "'Outfit', sans-serif", color: '#1A1A2E' }}>{exam.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                <span style={{ color: timeLeft < 60 ? '#E8361A' : '#1A1A2E', fontWeight: 800, fontSize: '1rem', fontFamily: "'Outfit', sans-serif", background: timeLeft < 60 ? '#fee2e2' : '#F0EDF8', padding: '4px 12px', borderRadius: '20px' }}>
                  ⏱ {mins}:{secs < 10 ? '0' : ''}{secs}
                </span>
              </div>
            </div>
          </div>

          <div className="card-body">
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ background: 'linear-gradient(90deg,#6A0DAD,#9B30E0)', color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.8rem', padding: '4px 12px', borderRadius: '20px', letterSpacing: '0.06em' }}>Q {currentQIdx + 1} / {questions.length}</span>
                <h3 style={{ margin: 0, fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1rem', color: '#1A1A2E' }}>Question {currentQIdx + 1}</h3>
              </div>
              {q.questionImageUrl && (
                <img
                  src={q.questionImageUrl}
                  alt="Question"
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '320px', marginBottom: 16, borderRadius: '12px', border: '1px solid #E2D8F0' }}
                />
              )}
              <p style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#1A1A2E', fontFamily: "'Outfit',sans-serif", fontWeight: 400 }}>{q.questionText}</p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                {q.options.map((opt, idx) => (
                  <label key={idx} style={{
                    padding: '13px 16px',
                    border: answers[currentQIdx] === idx ? '2px solid #6A0DAD' : '1.5px solid #E2D8F0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    backgroundColor: answers[currentQIdx] === idx ? '#F0EDF8' : '#FAFAFE',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: answers[currentQIdx] === idx ? '0 2px 10px rgba(106,13,173,0.1)' : 'none',
                  }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: answers[currentQIdx] === idx ? '#6A0DAD' : '#E2D8F0', color: answers[currentQIdx] === idx ? '#fff' : '#5A5A7A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{String.fromCharCode(65 + idx)}</span>
                    <input type="radio" name="answer" checked={answers[currentQIdx] === idx} onChange={() => handleSelectOption(idx)} style={{ display: 'none' }} />
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: '0.95rem', color: '#1A1A2E' }}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card-footer" style={{ marginTop: 24, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                style={{ background: markedForReview.has(currentQIdx) ? 'linear-gradient(90deg,#F5AB00,#E8631A)' : 'rgba(90,90,122,0.8)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', letterSpacing: '0.04em' }}
                onClick={handleMarkForReview}
              >
                {markedForReview.has(currentQIdx) ? '⭐ Marked' : '☆ Mark Review'}
              </button>
              <button disabled={currentQIdx === 0} style={{ background: '#E2D8F0', color: '#4B0082', border: 'none', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }} onClick={handlePreviousQuestion}>← Prev</button>
              <button disabled={currentQIdx === questions.length - 1} style={{ background: 'linear-gradient(90deg,#6A0DAD,#9B30E0)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }} onClick={handleNextQuestion}>Next →</button>
              <button onClick={handleCancelAttempt} style={{ background: 'transparent', color: '#5A5A7A', border: '1.5px solid #E2D8F0', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', marginLeft: 'auto' }}>Cancel</button>
              <button onClick={handleOpenSubmitModal} style={{ background: 'linear-gradient(90deg,#D9601A,#E88A10)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>End Exam</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ background: 'linear-gradient(90deg,#28A745,#1e9640)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', letterSpacing: '0.04em' }}>
                {submitting ? 'Submitting...' : '✓ Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 290, padding: '20px 16px', background: '#fff', borderLeft: '1px solid #E2D8F0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 3px', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1A1A2E' }}>📋 Navigator</h3>
          <div style={{ height: '3px', width: '48px', background: 'linear-gradient(90deg,#9B30E0,#E8631A,#F5AB00)', borderRadius: '2px', marginBottom: '14px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
            {questions.map((_, idx) => {
              let bg, textColor, ring;
              if (idx === currentQIdx) {
                bg = 'linear-gradient(135deg,#6A0DAD,#9B30E0)';
                textColor = '#fff';
                ring = '0 0 0 2px rgba(106,13,173,0.4)';
              } else if (markedForReview.has(idx)) {
                bg = 'linear-gradient(135deg,#F5AB00,#E8631A)';
                textColor = '#fff';
                ring = 'none';
              } else if (answers[idx] !== undefined && answers[idx] !== null) {
                bg = '#28A745';
                textColor = '#fff';
                ring = 'none';
              } else {
                bg = '#F0EDF8';
                textColor = '#5A5A7A';
                ring = 'none';
              }
              return (
                <button
                  key={idx}
                  onClick={() => changeQuestion(idx)}
                  title={`Question ${idx + 1}`}
                  style={{ padding: '8px 4px', background: bg, color: textColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Outfit',sans-serif", fontWeight: 700, transition: 'transform 0.15s', boxShadow: ring }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ background: '#F8F6FF', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[['#6A0DAD','Current'],['#28A745','Answered'],['#F5AB00','For Review'],['#F0EDF8','Not Visited']].map(([c, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: c, border: c === '#F0EDF8' ? '1px solid #E2D8F0' : 'none', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: '0.78rem', fontWeight: 600, color: '#5A5A7A' }}>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleOpenSubmitModal}
          style={{ width: '100%', padding: '11px', background: 'linear-gradient(90deg,#D9601A,#E88A10)', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.04em' }}
        >
          End Exam Early
        </button>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={handleCloseSubmitModal}>
          <div style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', minWidth: '400px', maxWidth: '90vw', boxShadow: '0 24px 60px rgba(75,0,130,0.22)', zIndex: 1001 }} onClick={(e) => e.stopPropagation()}>
            {/* modal header */}
            <div style={{ background: 'linear-gradient(90deg,#4B0082,#6A0DAD,#9B30E0)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>📝</span>
              <h3 style={{ margin: 0, fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '1rem', color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Confirm Submission</h3>
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg,#9B30E0,#C0359E,#E8631A,#F5AB00)' }} />
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '8px', fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: '0.95rem', color: '#1A1A2E' }}>
                You have <strong style={{ color: '#E8361A' }}>{questions.length - Object.keys(answers).length}</strong> unanswered question(s).
              </p>
              <p style={{ marginBottom: '20px', fontFamily: "'Outfit',sans-serif", color: '#5A5A7A', fontSize: '0.88rem' }}>
                Are you sure you want to submit the exam now? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={handleCloseSubmitModal} style={{ padding: '9px 20px', background: 'transparent', color: '#5A5A7A', border: '1.5px solid #E2D8F0', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleConfirmSubmit} disabled={submitting} style={{ padding: '9px 22px', background: 'linear-gradient(90deg,#28A745,#1e9640)', color: '#fff', border: 'none', borderRadius: '20px', fontFamily: "'Outfit',sans-serif", fontWeight: 800, cursor: 'pointer', letterSpacing: '0.04em' }}>
                  {submitting ? 'Submitting...' : '✓ Submit Exam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
