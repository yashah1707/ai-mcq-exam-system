import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { fetchExams } from '../services/examService';
import { getBatchOverview } from '../services/batchService';

const formatExamDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return date.toLocaleString();
};

const T = {
  page: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '32px 32px 48px',
    fontFamily: "'Outfit', sans-serif",
  },
  hero: {
    background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 40%, #9B30E0 70%, #C0359E 100%)',
    borderRadius: 16,
    padding: '28px 36px',
    marginBottom: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    flexWrap: 'wrap',
    boxShadow: '0 4px 24px rgba(75,0,130,0.22)',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  heroTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '1.5rem',
    color: '#fff',
    margin: 0,
    letterSpacing: '0.02em',
  },
  heroSub: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.72)',
    margin: 0,
  },
  heroBadge: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 20,
    padding: '5px 14px',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    backdropFilter: 'blur(8px)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  statCard: (accent) => ({
    background: '#fff',
    borderRadius: 14,
    padding: '20px 24px',
    border: '1px solid rgba(106,13,173,0.1)',
    boxShadow: '0 2px 12px rgba(75,0,130,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  }),
  statAccent: (color) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: color,
    borderRadius: '14px 14px 0 0',
  }),
  statValue: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '2.2rem',
    color: '#1A1A2E',
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#5A5A7A',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '1rem',
    color: '#1A1A2E',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: 0,
  },
  sectionBar: {
    height: 3,
    width: 48,
    background: 'linear-gradient(90deg, #6A0DAD, #C0359E, #E8631A, #F5AB00)',
    borderRadius: 2,
    flexShrink: 0,
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  quickCard: (grad) => ({
    background: grad,
    borderRadius: 12,
    padding: '18px 20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: 'none',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    textAlign: 'left',
    width: '100%',
    color: '#fff',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '0.9rem',
    letterSpacing: '0.02em',
    boxShadow: '0 2px 12px rgba(75,0,130,0.12)',
  }),
  quickIcon: {
    fontSize: '1.4rem',
    flexShrink: 0,
  },
  tableCard: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid rgba(106,13,173,0.1)',
    boxShadow: '0 2px 12px rgba(75,0,130,0.07)',
    overflow: 'hidden',
  },
  tableHead: {
    background: '#F0EDF8',
    padding: '12px 20px',
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 12,
    borderBottom: '1px solid rgba(106,13,173,0.1)',
  },
  tableHeadCell: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '0.72rem',
    color: '#6A0DAD',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  tableRow: {
    padding: '14px 20px',
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 12,
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  tableCell: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.88rem',
    color: '#1A1A2E',
  },
  tableCellMuted: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.78rem',
    color: '#5A5A7A',
  },
  statusBadge: (bg, color) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    background: bg,
    color: color,
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }),
  emptyState: {
    padding: '40px 24px',
    textAlign: 'center',
    color: '#5A5A7A',
    fontFamily: "'Outfit', sans-serif",
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: 12,
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: '0.85rem',
    color: '#5A5A7A',
  },
};

const QUICK_ACTIONS = [
  { label: 'Manage Users', icon: '👥', route: '/admin/users', grad: 'linear-gradient(135deg, #4B0082, #6A0DAD)' },
  { label: 'Questions', icon: '❓', route: '/admin/questions', grad: 'linear-gradient(135deg, #6A0DAD, #9B30E0)' },
  { label: 'Manage Exams', icon: '📋', route: '/admin/exams', grad: 'linear-gradient(135deg, #D9601A, #E88A10)' },
  { label: 'Manage Classes', icon: '🏛️', route: '/admin/classes', grad: 'linear-gradient(135deg, #00A878, #00D4C8)' },
  { label: 'Batch Analytics', icon: '📊', route: '/admin/analytics', grad: 'linear-gradient(135deg, #C0359E, #E8631A)' },
  { label: 'View Reports', icon: '📈', route: '/admin/reports', grad: 'linear-gradient(135deg, #F5AB00, #E8631A)' },
];

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [overviewRes, examsRes] = await Promise.all([getBatchOverview(), fetchExams()]);
        if (overviewRes?.success) setOverview(overviewRes.data);
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
    const activeExams = exams.filter((e) => e.isActive).length;
    const lockedExams = exams.filter((e) => e.isLocked).length;
    const upcomingExams = exams
      .filter((e) => e.isActive && new Date(e.startDate) >= new Date())
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 8);
    return { totalExams: exams.length, activeExams, lockedExams, upcomingExams };
  }, [exams]);

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'Admin';
  const val = (v) => (loading ? '—' : v ?? 0);

  const STATS = [
    { label: 'Total Students', value: val(overview?.totalStudents), accent: 'linear-gradient(90deg, #4B0082, #6A0DAD)' },
    { label: 'Active Learners', value: val(overview?.activeStudents), accent: 'linear-gradient(90deg, #6A0DAD, #9B30E0)' },
    { label: 'Exam Catalog', value: val(dashboardStats.totalExams), accent: 'linear-gradient(90deg, #D9601A, #E88A10)' },
    { label: 'Locked Exams', value: val(dashboardStats.lockedExams), accent: 'linear-gradient(90deg, #C0359E, #E8631A)' },
  ];

  return (
    <div style={T.page}>
      {/* ── Hero Welcome Banner ── */}
      <div style={T.hero}>
        <div style={T.heroLeft}>
          <h1 style={T.heroTitle}>Welcome back, {firstName} 👋</h1>
          <p style={T.heroSub}>Monitor learner activity, manage exams, and keep the platform running smoothly.</p>
        </div>
        <span style={T.heroBadge}>Admin Panel</span>
      </div>

      {/* ── Stat Cards ── */}
      <div style={T.statsGrid}>
        {STATS.map((s) => (
          <div key={s.label} style={T.statCard()}>
            <div style={T.statAccent(s.accent)} />
            <div style={T.statValue}>{s.value}</div>
            <div style={T.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div style={T.section}>
        <div style={T.sectionHeader}>
          <div style={T.sectionBar} />
          <h2 style={T.sectionTitle}>Quick Actions</h2>
        </div>
        <div style={T.quickGrid}>
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.route}
              style={T.quickCard(q.grad)}
              onClick={() => navigate(q.route)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(75,0,130,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(75,0,130,0.12)'; }}
            >
              <span style={T.quickIcon}>{q.icon}</span>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Upcoming Active Exams ── */}
      <div style={T.section}>
        <div style={T.sectionHeader}>
          <div style={T.sectionBar} />
          <h2 style={T.sectionTitle}>Upcoming Active Exams</h2>
        </div>

        <div style={T.tableCard}>
          {!loading && dashboardStats.upcomingExams.length === 0 ? (
            <div style={T.emptyState}>
              <div style={T.emptyIcon}>📭</div>
              <div style={T.emptyTitle}>No upcoming active exams</div>
              <div style={T.emptyText}>Create and activate an exam to see it here.</div>
            </div>
          ) : (
            <>
              <div style={T.tableHead}>
                {['Exam', 'Subject', 'Duration', 'Starts', 'Progress'].map((h) => (
                  <div key={h} style={T.tableHeadCell}>{h}</div>
                ))}
              </div>
              {loading
                ? [1, 2, 3].map((i) => (
                    <div key={i} style={{ ...T.tableRow, opacity: 0.4 }}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <div key={j} style={{ height: 16, background: '#E2D8F0', borderRadius: 4 }} />
                      ))}
                    </div>
                  ))
                : dashboardStats.upcomingExams.map((exam) => (
                    <div key={exam._id} style={T.tableRow}>
                      <div>
                        <div style={{ ...T.tableCell, fontWeight: 700 }}>{exam.title}</div>
                        <div style={T.tableCellMuted}>{exam.totalMarks} marks</div>
                      </div>
                      <div style={T.tableCell}>{exam.subject || '—'}</div>
                      <div style={T.tableCell}>{exam.duration} min</div>
                      <div style={T.tableCellMuted}>{formatExamDate(exam.startDate)}</div>
                      <div>
                        <span style={T.statusBadge('#E8F5FF', '#0077CC')}>
                          {exam.attemptStats?.startedCount || 0} started
                        </span>
                      </div>
                    </div>
                  ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
