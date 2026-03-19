import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAttemptHistory } from '../services/examAttemptService';

export default function ExamHistory() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAttemptHistory();
        setAttempts(res.attempts || []);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="container">
      <div className="nav"><h2>Exam History</h2></div>

      <div className="card">
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {!loading && !attempts.length && <div className="small">No completed exams yet.</div>}
        {!loading && attempts.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead className="small" style={{ textAlign: 'left' }}>
              <tr><th>Exam</th><th>Score</th><th>Status</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {attempts.map(a => {
                const isAdaptive = a.mode === 'adaptive';
                const title = isAdaptive ? `Adaptive Practice - ${a.subject || 'General'}` : a.exam?.title || 'Unknown Exam';
                const totalMarks = isAdaptive ? 'N/A' : a.exam?.totalMarks;
                // For adaptive, passing logic might differ or not exist
                const passed = isAdaptive ? true : (a.score >= (a.exam?.passingMarks || 0));

                return (
                  <tr key={a._id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '8px 6px' }}>{title}</td>
                    <td style={{ padding: '8px 6px' }}>{a.score} {totalMarks !== 'N/A' && `/ ${totalMarks}`}</td>
                    <td style={{ padding: '8px 6px', color: passed ? '#10b981' : '#dc2626' }}>
                      {isAdaptive ? 'Completed' : (passed ? 'Passed' : 'Failed')}
                    </td>
                    <td style={{ padding: '8px 6px' }} className="small">{new Date(a.endTime).toLocaleDateString()}</td>
                    <td style={{ padding: '8px 6px' }}>
                      {isAdaptive && (
                        <button
                          onClick={() => navigate(`/analysis/${a._id}`)}
                          style={{ fontSize: '0.8rem', padding: '2px 6px', cursor: 'pointer' }}
                        >
                          Analysis
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
