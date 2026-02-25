import React, { useState, useEffect } from 'react';
import { startExam, saveAnswerWithRetry, submitExam, getAttempt } from '../services/examAttemptService';
import { getExamById } from '../services/examService';
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
          const { getQuestionById: fetchQ } = await import('../services/questionService');
          const fetched = [];
          for (const qId of (examObj.questions || [])) {
            const id = typeof qId === 'string' ? qId : qId._id;
            try {
              const q = await fetchQ(id);
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
      alert('Failed to save answer: ' + err.message);
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

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) {
      return;
    }
    setSubmitting(true);
    try {
      const attemptId = attempt._id || attempt.id;
      const res = await submitExam(attemptId);
      // clear persisted attempt and index
      try { localStorage.removeItem(`attempt_${examId}`); localStorage.removeItem(`attempt_${examId}_idx`); } catch (e) { }
      onComplete(res);
    } catch (err) {
      alert('Failed to submit: ' + err.message);
      setSubmitting(false);
    }
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
                    backgroundColor: ans?.selectedOption === idx ? 'var(--primary-light)' : '#fff',
                    borderColor: ans?.selectedOption === idx ? 'var(--primary)' : 'var(--border)',
                  }}>
                    <input
                      type="radio"
                      name="answer"
                      checked={ans?.selectedOption === idx}
                      onChange={() => handleSelectOption(idx)}
                      style={{ marginRight: 12 }}
                    />
                    <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card-footer" style={{ marginTop: 24 }}>
              <button
                className={`button-${markedForReview.has(currentQIdx) ? 'warning' : 'secondary'}`}
                onClick={handleMarkForReview}
              >
                {markedForReview.has(currentQIdx) ? '⭐ Marked for Review' : '☆ Mark for Review'}
              </button>
              <button disabled={currentQIdx === 0} className="button-secondary" onClick={() => changeQuestion(currentQIdx - 1)}>← Previous</button>
              <button disabled={currentQIdx === questions.length - 1} className="button-secondary" onClick={() => changeQuestion(currentQIdx + 1)}>Next →</button>
              <button onClick={handleSubmit} disabled={submitting} className="button-success" style={{ marginLeft: 'auto' }}>✓ Submit Exam</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: 320, padding: 24, background: '#fff', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>📋 Navigator</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
          {questions.map((_, idx) => {
            let bg = 'var(--border)';
            let label = '○';
            if (idx === currentQIdx) {
              bg = 'var(--primary)';
              label = '◐';
            } else if (markedForReview.has(idx)) {
              bg = 'var(--warning)';
              label = '★';
            } else if (attempt.answers[idx]?.selectedOption !== null) {
              bg = 'var(--success)';
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
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <p style={{ margin: '8px 0' }}><span style={{ color: 'var(--primary)', fontWeight: '600' }}>◐</span> Current</p>
          <p style={{ margin: '8px 0' }}><span style={{ color: 'var(--success)', fontWeight: '600' }}>✓</span> Answered</p>
          <p style={{ margin: '8px 0' }}><span style={{ color: 'var(--warning)', fontWeight: '600' }}>★</span> Review</p>
        </div>
      </div>
    </div>
  );
}
