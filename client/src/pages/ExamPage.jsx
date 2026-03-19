import React, { useState, useEffect } from 'react';
import { startExam, saveAnswerWithRetry, submitExam, getAttempt } from '../services/examAttemptService';
import { getExamById } from '../services/examService';
import { getQuestionById } from '../services/questionService';
import LoadingSpinner from '../components/LoadingSpinner';
import SaveIndicator from '../components/SaveIndicator';

export default function ExamPage({ examId, onComplete }) {
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
          // Fallback: re-fetch questions from exam (older attempts without populated questions)
          const fetched = [];
          for (const qId of (examObj.questions || [])) {
            const id = typeof qId === 'string' ? qId : qId._id;
            try {
              const q = await getQuestionById(id);
              if (q.question) fetched.push(q.question);
            } catch (e) { console.warn('Failed to fetch question', id, e.message); }
          }
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
      alert('Failed to submit: ' + err.message);
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) {
      return;
    }
    await handleConfirmSubmit();
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <div className="container alert alert-danger">{error}</div>;
  if (!attempt || !questions.length) return <div className="container">No exam data</div>;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const q = questions[currentQIdx];
  const ans = attempt.answers[currentQIdx];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: 'var(--bg)' }}>
      <div style={{ flex: 1, padding: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ marginBottom: 24 }}>
            <div className="flex-between">
              <span>{exam.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                <span style={{ color: timeLeft < 60 ? 'var(--danger)' : 'inherit', fontWeight: '600' }}>
                  ⏱ {mins}:{secs < 10 ? '0' : ''}{secs}
                </span>
              </div>
            </div>
          </div>

          <div className="card-body">
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px 0' }}>Question {currentQIdx + 1} of {questions.length}</h3>
              {q.questionImageUrl && (
                <img
                  src={q.questionImageUrl}
                  alt="Question"
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '320px', marginBottom: 16, borderRadius: '12px', border: '1px solid var(--border)' }}
                />
              )}
              <p style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>{q.questionText}</p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                {q.options.map((opt, idx) => (
                  <label key={idx} style={{
                    padding: '12px',
                    border: '2px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    backgroundColor: answers[currentQIdx] === idx ? 'var(--primary-light)' : '#fff',
                    borderColor: answers[currentQIdx] === idx ? 'var(--primary)' : 'var(--border)',
                  }}>
                    <input
                      type="radio"
                      name="answer"
                      checked={answers[currentQIdx] === idx}
                      onChange={() => handleSelectOption(idx)}
                      style={{ marginRight: 12 }}
                    />
                    <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card-footer" style={{ marginTop: 24, display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className={`button-${markedForReview.has(currentQIdx) ? 'warning' : 'secondary'}`}
                onClick={handleMarkForReview}
              >
                {markedForReview.has(currentQIdx) ? '⭐ Marked for Review' : '☆ Mark for Review'}
              </button>
              <button disabled={currentQIdx === 0} className="btn btn-secondary" onClick={handlePreviousQuestion}>← Previous Question</button>
              <button disabled={currentQIdx === questions.length - 1} className="btn btn-secondary" onClick={handleNextQuestion}>Next Question →</button>
              <button onClick={handleOpenSubmitModal} className="btn btn-warning" style={{ marginLeft: 'auto' }}>End Exam</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
                {submitting ? 'Submitting...' : '✓ Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 320, padding: 24, background: '#fff', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>📋 Navigator</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
          {questions.map((_, idx) => {
            let bg = '#e5e7eb'; // Default gray for visited/not visited
            let borderColor = '#d1d5db';
            let label = '○';
            
            if (idx === currentQIdx) {
              bg = '#2563eb'; // Blue for current
              borderColor = '#1d4ed8';
              label = '◐';
            } else if (markedForReview.has(idx)) {
              bg = '#f59e0b'; // Amber for marked
              borderColor = '#d97706';
              label = '★';
            } else if (answers[idx] !== undefined && answers[idx] !== null) {
              bg = '#22c55e'; // Green for answered
              borderColor = '#16a34a';
              label = '✓';
            }
            
            return (
              <button
                key={idx}
                onClick={() => changeQuestion(idx)}
                title={`Question ${idx + 1}`}
                style={{
                  padding: '8px',
                  background: bg,
                  color: idx === currentQIdx || markedForReview.has(idx) ? '#fff' : '#000',
                  border: `2px solid ${borderColor}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: idx === currentQIdx ? '0 0 0 3px rgba(37, 99, 235, 0.3)' : 'none'
                }}
              >
                {idx + 1}
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
          onClick={handleOpenSubmitModal}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '12px',
            backgroundColor: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#d97706'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#f59e0b'}
        >
          End Early
        </button>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={handleCloseSubmitModal}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '32px',
            minWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1001
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Confirm Submission</h3>
            <p style={{ marginBottom: '8px' }}>
              You have <strong>{questions.length - Object.keys(answers).length}</strong> unanswered question(s).
            </p>
            <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>
              Are you sure you want to submit the exam now?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleCloseSubmitModal} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmSubmit} disabled={submitting} className="btn btn-primary">
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
