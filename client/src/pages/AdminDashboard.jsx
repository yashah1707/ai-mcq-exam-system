import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchExams } from '../services/examService';
import { getBatchOverview } from '../services/batchService';

const formatExamDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unscheduled';
  }

  return date.toLocaleString();
};

const summaryCardStyle = {
  padding: 16,
  borderRadius: 12,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
};

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [overviewRes, examsRes] = await Promise.all([
          getBatchOverview(),
          fetchExams(),
        ]);
        if (overviewRes?.success) {
          setOverview(overviewRes.data);
        }
        setExams(examsRes?.exams || []);
      } catch (error) {
        console.error('Failed to load admin dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const dashboardStats = useMemo(() => {
    const activeExams = exams.filter((exam) => exam.isActive).length;
    const lockedExams = exams.filter((exam) => exam.isLocked).length;
    const upcomingExams = exams
      .filter((exam) => exam.isActive && new Date(exam.startDate) >= new Date())
      .sort((left, right) => new Date(left.startDate) - new Date(right.startDate))
      .slice(0, 5);

    return {
      totalExams: exams.length,
      activeExams,
      lockedExams,
      upcomingExams,
    };
  }, [exams]);

  return (
    <div className="container">
      <div className="nav">
        <h2>Admin Dashboard</h2>
  
      </div>

      <div className="card">
        <h3>Welcome, {user?.firstName || user?.name || 'Admin'}</h3>
        <p className="small">Use this overview to monitor learner activity, locked exams, and the next exams going live.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          <div style={summaryCardStyle}>
            <div className="small">Total Students</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '...' : overview?.totalStudents ?? 0}</div>
          </div>
          <div style={summaryCardStyle}>
            <div className="small">Active Learners</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '...' : overview?.activeStudents ?? 0}</div>
          </div>
          <div style={summaryCardStyle}>
            <div className="small">Exam Catalog</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '...' : dashboardStats.totalExams}</div>
          </div>
          <div style={summaryCardStyle}>
            <div className="small">Locked Exams</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '...' : dashboardStats.lockedExams}</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/admin/users')}>Manage Users</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/questions')}>Manage Questions</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/exams')}>Manage Exams</button>
          <button style={{ marginLeft: 8, backgroundColor: '#6366f1' }} onClick={() => navigate('/admin/analytics')}>Batch Analytics 📊</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/reports')}>View Reports</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Upcoming Active Exams</h3>
        {!dashboardStats.upcomingExams.length ? (
          <p className="small" style={{ marginBottom: 0 }}>No upcoming active exams.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {dashboardStats.upcomingExams.map((exam) => (
              <div key={exam._id} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{exam.title}</strong>
                    <div className="small">{exam.subject} • {exam.duration} min • {exam.totalMarks} marks</div>
                  </div>
                  <div className="small" style={{ textAlign: 'right' }}>
                    <div>Starts {formatExamDate(exam.startDate)}</div>
                    <div>{exam.attemptStats?.startedCount || 0} started • {exam.attemptStats?.completedCount || 0} completed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
