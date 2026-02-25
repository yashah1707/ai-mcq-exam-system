import React, { useState, useEffect } from 'react';
import { getStudentPerformance, getExamStatistics } from '../services/reportService';
import { fetchExams } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminReports() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [performance, setPerformance] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchExams();
        setExams(res.exams || []);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      }
    };
    load();
  }, []);

  const loadPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const perfRes = await getStudentPerformance(selectedExamId);
      setPerformance(perfRes.performance || []);

      const statsRes = await getExamStatistics(selectedExamId);
      setStats(statsRes);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="nav"><h2>Performance Reports</h2></div>

      <div className="card">
        <h3>Select Exam</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select
            value={selectedExamId}
            onChange={e => setSelectedExamId(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">All Exams</option>
            {exams.map(ex => (
              <option key={ex._id} value={ex._id}>{ex.title}</option>
            ))}
          </select>
          <button onClick={loadPerformance} disabled={loading}>
            {loading ? 'Loading...' : 'Load Report'}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: 'red' }}>{error}</div>}

      {stats && (
        <div className="card">
          <h3>Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 6 }}>
              <div className="small">Total Attempts</div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
            </div>
            <div style={{ padding: 12, background: '#dbeafe', borderRadius: 6 }}>
              <div className="small">Passed</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>
                {stats.passed} ({stats.passPercentage}%)
              </div>
            </div>
            <div style={{ padding: 12, background: '#fee2e2', borderRadius: 6 }}>
              <div className="small">Failed</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>{stats.failed}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div style={{ padding: 12, background: '#fef3c7', borderRadius: 6 }}>
              <div className="small">Average Score</div>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.avgScore} / Next exam total</div>
            </div>
            <div style={{ padding: 12, background: '#f3e8ff', borderRadius: 6 }}>
              <div className="small">Average Percentage</div>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.avgPercentage}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{marginTop:0}}>Student Performance</h3>
        {loading && <LoadingSpinner />}
        {!loading && !performance.length && <p className="text-muted text-center">No attempts found.</p>}
        {!loading && performance.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Exam</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => (
                <tr key={p._id}>
                  <td><strong>{p.studentName}</strong></td>
                  <td className="text-small">{p.studentEmail}</td>
                  <td className="text-small">{p.examTitle}</td>
                  <td><strong>{p.score} / {p.totalMarks}</strong></td>
                  <td><strong>{p.percentage}%</strong></td>
                  <td>
                    <span className={`badge ${p.passed ? 'badge-success' : 'badge-danger'}`}>
                      {p.passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </td>
                  <td className="text-small">
                    {new Date(p.completedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
