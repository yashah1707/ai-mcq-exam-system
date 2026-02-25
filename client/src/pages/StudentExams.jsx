import React, { useState, useEffect, useContext } from 'react';
import { fetchExams } from '../services/examService';
import { AuthContext } from '../context/AuthContext';

export default function StudentExams({ onStartExam }) {
  const { user } = useContext(AuthContext);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchExams();

        // Filter:
        // 1. Active exams
        // 2. Haven't ended
        // 3. Not an "Adaptive Test" (these are personal practice tests, shouldn't be publicly listed)
        const now = new Date();
        const available = (res.exams || []).filter(e => {
          const isActive = e.isActive;
          const notExpired = new Date(e.endDate) > now;
          const isAdaptive = e.title.startsWith('Adaptive Test');

          return isActive && notExpired && !isAdaptive;
        });

        setExams(available);
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  return (
    <div className="container">
      <div className="nav"><h2>Available Exams</h2></div>

      <div className="card">
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {!loading && !exams.length && <div className="small">No exams available at the moment.</div>}
        {!loading && exams.length > 0 && (
          <div>
            {exams.map(ex => (
              <div key={ex._id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div><strong>{ex.title}</strong></div>
                <div className="small" style={{ marginTop: 4 }}>{ex.description}</div>
                <div className="small" style={{ marginTop: 4, color: '#666' }}>
                  Duration: {ex.duration} mins | Questions: {ex.questions.length} | Marks: {ex.totalMarks} | Pass: {ex.passingMarks}
                </div>
                <div className="small" style={{ marginTop: 4, color: '#999' }}>
                  Ends: {new Date(ex.endDate).toLocaleDateString()} {new Date(ex.endDate).toLocaleTimeString()}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => onStartExam(ex._id)}>Start Exam</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
