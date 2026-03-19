import React, { useEffect, useMemo, useState } from 'react';
import {
  getStudentOverallReport,
  getStudentSubjectHistoryReport,
  getSubjectStudentsReport,
} from '../services/reportService';
import {
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
} from 'recharts';
import { fetchUsers } from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import { downloadCsv } from '../utils/csvExport';
import { downloadTablePdf } from '../utils/pdfExport';

const SUBJECT_OPTIONS = ['DBMS', 'OS', 'CN', 'DSA', 'Aptitude', 'Logical', 'Verbal'];
const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0f766e'];

export default function AdminReports() {
  const [reportType, setReportType] = useState('subject-students');
  const [users, setUsers] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('DBMS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filters = useMemo(() => ({ startDate, endDate }), [startDate, endDate]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchUsers();
        const studentUsers = (res.users || []).filter(user => user.role !== 'admin');
        setUsers(studentUsers);
        if (studentUsers.length > 0) {
          setSelectedStudentId(studentUsers[0]._id);
        }
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
      }
    };
    load();
  }, []);

  const selectedStudent = useMemo(
    () => users.find(user => user._id === selectedStudentId) || null,
    [selectedStudentId, users]
  );

  const handleReportTypeChange = (nextReportType) => {
    setReportData(null);
    setError(null);
    setReportType(nextReportType);
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      if (reportType === 'subject-students') {
        const res = await getSubjectStudentsReport(selectedSubject, filters);
        setReportData(res.data);
      } else if (reportType === 'student-subject') {
        const res = await getStudentSubjectHistoryReport(selectedStudentId, selectedSubject, filters);
        setReportData(res.data);
      } else if (reportType === 'student-overall') {
        const res = await getStudentOverallReport(selectedStudentId, filters);
        setReportData(res.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedStudentId && reportType !== 'subject-students') {
      return;
    }

    loadReport();
  }, [reportType, selectedStudentId, selectedSubject, startDate, endDate]);

  const handleExportCsv = () => {
    if (!reportData) {
      return;
    }

    if (reportType === 'subject-students') {
      downloadCsv(
        `${reportData.subject.toLowerCase()}-students-report.csv`,
        [
          { key: 'name', label: 'Student' },
          { key: 'email', label: 'Email' },
          { key: 'testsTaken', label: 'Tests Taken' },
          { key: 'accuracy', label: 'Accuracy %' },
          { key: 'avgPercentage', label: 'Average %' },
          { key: 'avgTimeSeconds', label: 'Average Time (s)' },
          { key: 'trend', label: 'Trend' },
          { key: 'weakTopics', label: 'Weak Topics' },
        ],
        reportData.students.map((student) => ({
          ...student,
          trend: student.trend.label,
          weakTopics: student.weakTopics.map((topic) => topic.topic).join(' | '),
        }))
      );
      return;
    }

    if (reportType === 'student-subject') {
      downloadCsv(
        `${reportData.student.name.toLowerCase().replace(/\s+/g, '-')}-${reportData.subject.toLowerCase()}-history.csv`,
        [
          { key: 'completedAt', label: 'Completed At' },
          { key: 'examTitle', label: 'Exam' },
          { key: 'mode', label: 'Mode' },
          { key: 'score', label: 'Score' },
          { key: 'maxScore', label: 'Max Score' },
          { key: 'percentage', label: 'Percentage' },
          { key: 'totalQuestions', label: 'Questions' },
          { key: 'avgTimeSeconds', label: 'Average Time (s)' },
        ],
        reportData.timeline.map((row) => ({
          ...row,
          completedAt: new Date(row.completedAt).toLocaleString(),
        }))
      );
      return;
    }

    downloadCsv(
      `${reportData.student.name.toLowerCase().replace(/\s+/g, '-')}-overall-report.csv`,
      [
        { key: 'subject', label: 'Subject' },
        { key: 'testsTaken', label: 'Tests Taken' },
        { key: 'accuracy', label: 'Accuracy %' },
        { key: 'avgPercentage', label: 'Average %' },
        { key: 'avgTimeSeconds', label: 'Average Time (s)' },
        { key: 'trend', label: 'Trend' },
        { key: 'weakTopics', label: 'Weak Topics' },
      ],
      reportData.subjects.map((subject) => ({
        ...subject,
        trend: subject.trend.label,
        weakTopics: subject.weakTopics.map((topic) => topic.topic).join(' | '),
      }))
    );
  };

  const handleExportPdf = async () => {
    if (!reportData) {
      return;
    }

    if (reportType === 'subject-students') {
      await downloadTablePdf({
        filename: `${reportData.subject.toLowerCase()}-students-report.pdf`,
        title: `Subject-wise Student Report: ${reportData.subject}`,
        subtitle: buildFilterSubtitle(filters),
        columns: [
          { key: 'name', label: 'Student' },
          { key: 'email', label: 'Email' },
          { key: 'testsTaken', label: 'Tests Taken' },
          { key: 'accuracy', label: 'Accuracy %' },
          { key: 'avgPercentage', label: 'Average %' },
          { key: 'avgTimeSeconds', label: 'Avg Time (s)' },
          { key: 'trend', label: 'Trend' },
          { key: 'weakTopics', label: 'Weak Topics' },
        ],
        rows: reportData.students.map((student) => ({
          ...student,
          trend: student.trend.label,
          weakTopics: student.weakTopics.map((topic) => topic.topic).join(' | '),
        })),
      });
      return;
    }

    if (reportType === 'student-subject') {
      await downloadTablePdf({
        filename: `${reportData.student.name.toLowerCase().replace(/\s+/g, '-')}-${reportData.subject.toLowerCase()}-history.pdf`,
        title: `${reportData.student.name} - ${reportData.subject} History`,
        subtitle: buildFilterSubtitle(filters),
        columns: [
          { key: 'completedAt', label: 'Completed At' },
          { key: 'examTitle', label: 'Exam' },
          { key: 'mode', label: 'Mode' },
          { key: 'score', label: 'Score' },
          { key: 'maxScore', label: 'Max Score' },
          { key: 'percentage', label: 'Percentage' },
          { key: 'totalQuestions', label: 'Questions' },
          { key: 'avgTimeSeconds', label: 'Avg Time (s)' },
        ],
        rows: reportData.timeline.map((row) => ({
          ...row,
          completedAt: new Date(row.completedAt).toLocaleString(),
        })),
      });
      return;
    }

    await downloadTablePdf({
      filename: `${reportData.student.name.toLowerCase().replace(/\s+/g, '-')}-overall-report.pdf`,
      title: `${reportData.student.name} - Overall Report`,
      subtitle: buildFilterSubtitle(filters),
      columns: [
        { key: 'subject', label: 'Subject' },
        { key: 'testsTaken', label: 'Tests Taken' },
        { key: 'accuracy', label: 'Accuracy %' },
        { key: 'avgPercentage', label: 'Average %' },
        { key: 'avgTimeSeconds', label: 'Avg Time (s)' },
        { key: 'trend', label: 'Trend' },
        { key: 'weakTopics', label: 'Weak Topics' },
      ],
      rows: reportData.subjects.map((subject) => ({
        ...subject,
        trend: subject.trend.label,
        weakTopics: subject.weakTopics.map((topic) => topic.topic).join(' | '),
      })),
    });
  };

  const renderSubjectStudents = () => {
    if (!reportData || !reportData.summary || !Array.isArray(reportData.students)) return null;

    return (
      <>
        <div className="card">
          <h3>Subject Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <MetricCard label="Students" value={reportData.summary.studentCount} />
            <MetricCard label="Average Accuracy" value={`${reportData.summary.avgAccuracy}%`} />
            <MetricCard label="Average Tests" value={reportData.summary.avgTestsTaken} />
            <MetricCard label="Average Percentage" value={`${reportData.summary.avgPercentage}%`} />
          </div>
        </div>

        {reportData.students.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Visual Summary</h3>
            <div className="report-chart-grid">
              <div className="report-chart-panel" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.students.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgPercentage" name="Average %" fill="#2563eb" />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="report-chart-panel" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={buildTrendChartData(reportData.students)}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {buildTrendChartData(reportData.students).map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Students in {reportData.subject}</h3>
          {!reportData.students.length ? (
            <p className="text-muted">No completed attempts found for this subject.</p>
          ) : (
            <div className="report-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Tests</th>
                    <th>Accuracy</th>
                    <th>Avg %</th>
                    <th>Avg Time</th>
                    <th>Trend</th>
                    <th>Weak Topics</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.students.map(student => (
                    <tr key={student.userId}>
                      <td>
                        <strong>{student.name}</strong>
                        <div className="text-small">{student.email}</div>
                      </td>
                      <td>{student.testsTaken}</td>
                      <td>{student.accuracy}%</td>
                      <td>{student.avgPercentage}%</td>
                      <td>{student.avgTimeSeconds}s</td>
                      <td>{student.trend.label}</td>
                      <td className="text-small">{student.weakTopics.map(topic => topic.topic).join(', ') || 'None yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderStudentSubject = () => {
    if (!reportData || !reportData.student || !reportData.overview || !Array.isArray(reportData.timeline)) return null;

    return (
      <>
        <div className="card">
          <h3>{reportData.student.name} • {reportData.subject}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <MetricCard label="Tests Taken" value={reportData.overview.testsTaken} />
            <MetricCard label="Accuracy" value={`${reportData.overview.accuracy}%`} />
            <MetricCard label="Average %" value={`${reportData.overview.avgPercentage}%`} />
            <MetricCard label="Best %" value={`${reportData.overview.bestPercentage}%`} />
            <MetricCard label="Latest %" value={`${reportData.overview.latestPercentage}%`} />
            <MetricCard label="Trend" value={reportData.overview.trend.label} />
          </div>
        </div>

        {reportData.timeline.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Performance Trend</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData.timeline.map((item, index) => ({ ...item, name: `Test ${index + 1}` }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="percentage" name="Percentage" stroke="#2563eb" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attempt Timeline</h3>
          {!reportData.timeline.length ? (
            <p className="text-muted">No completed attempts found for this student in the selected subject.</p>
          ) : (
            <div className="report-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exam</th>
                    <th>Mode</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Questions</th>
                    <th>Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.timeline.map(item => (
                    <tr key={item.attemptId}>
                      <td>{new Date(item.completedAt).toLocaleDateString()}</td>
                      <td>{item.examTitle}</td>
                      <td>{item.mode}</td>
                      <td>{item.score} / {item.maxScore}</td>
                      <td>{item.percentage}%</td>
                      <td>{item.correctAnswers} / {item.totalQuestions}</td>
                      <td>{item.avgTimeSeconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <TopicSection title="Weak Topics" topics={reportData.weakTopics} accent="#dc2626" />
        <TopicSection title="Strong Topics" topics={reportData.strongTopics} accent="#16a34a" />
      </>
    );
  };

  const renderStudentOverall = () => {
    if (!reportData || !reportData.student || !reportData.overview || !Array.isArray(reportData.subjects) || !Array.isArray(reportData.recentAttempts)) return null;

    return (
      <>
        <div className="card">
          <h3>{reportData.student.name} • All Subjects</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <MetricCard label="Total Tests" value={reportData.overview.totalTests} />
            <MetricCard label="Accuracy" value={`${reportData.overview.accuracy}%`} />
            <MetricCard label="Average %" value={`${reportData.overview.averagePercentage}%`} />
            <MetricCard label="Strongest Subject" value={reportData.overview.strongestSubject || 'N/A'} />
            <MetricCard label="Weakest Subject" value={reportData.overview.weakestSubject || 'N/A'} />
            <MetricCard label="Avg Time" value={`${reportData.overview.avgTimeSeconds}s`} />
          </div>
        </div>

        {reportData.subjects.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Subject Performance Chart</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.subjects}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgPercentage" name="Average %" fill="#2563eb" />
                  <Bar dataKey="accuracy" name="Accuracy %" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Subject Breakdown</h3>
          {!reportData.subjects.length ? (
            <p className="text-muted">No subject data available yet.</p>
          ) : (
            <div className="report-table">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Tests</th>
                    <th>Accuracy</th>
                    <th>Avg %</th>
                    <th>Trend</th>
                    <th>Weak Topics</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.subjects.map(subject => (
                    <tr key={subject.subject}>
                      <td><strong>{subject.subject}</strong></td>
                      <td>{subject.testsTaken}</td>
                      <td>{subject.accuracy}%</td>
                      <td>{subject.avgPercentage}%</td>
                      <td>{subject.trend.label}</td>
                      <td className="text-small">{subject.weakTopics.map(topic => topic.topic).join(', ') || 'None yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent Attempts</h3>
          {!reportData.recentAttempts.length ? (
            <p className="text-muted">No attempts found yet.</p>
          ) : (
            <div className="report-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Exam</th>
                    <th>Subject</th>
                    <th>Mode</th>
                    <th>Score</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.recentAttempts.map(attempt => (
                    <tr key={attempt.attemptId}>
                      <td>{new Date(attempt.completedAt).toLocaleDateString()}</td>
                      <td>{attempt.examTitle}</td>
                      <td>{attempt.subject}</td>
                      <td>{attempt.mode}</td>
                      <td>{attempt.score} / {attempt.maxScore}</td>
                      <td>{attempt.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="container">
      <div className="nav"><h2>Performance Reports</h2></div>

      <div className="card">
        <h3>Report Filters</h3>
        <div className="report-filters-grid">
          <div className="report-filter-field">
            <label className="small">Report Type</label>
            <select value={reportType} onChange={e => handleReportTypeChange(e.target.value)}>
              <option value="subject-students">Subject-wise Report: All Students</option>
              <option value="student-subject">One Student: One Subject History</option>
              <option value="student-overall">One Student: All Subjects</option>
            </select>
          </div>

          {reportType !== 'student-overall' && (
            <div className="report-filter-field">
              <label className="small">Subject</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                {SUBJECT_OPTIONS.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          )}

          {reportType !== 'subject-students' && (
            <div className="report-filter-field">
              <label className="small">Student</label>
              <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}>
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                ))}
              </select>
            </div>
          )}

          <div className="report-filter-field">
            <label className="small">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div className="report-filter-field">
            <label className="small">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="report-filter-actions">
          <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }} className="button-secondary">
            Clear Dates
          </button>
          <button type="button" onClick={handleExportCsv} disabled={!reportData || loading} className="button-secondary">
            Export CSV
          </button>
          <button type="button" onClick={handleExportPdf} disabled={!reportData || loading} className="button-secondary">
            Export PDF
          </button>
          <button onClick={loadReport} disabled={loading || (!selectedStudentId && reportType !== 'subject-students')}>
            {loading ? 'Loading...' : 'Load Report'}
          </button>
        </div>
        {selectedStudent && reportType !== 'subject-students' && (
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Current student: <strong>{selectedStudent.name}</strong>
          </p>
        )}
      </div>

      {error && <div className="card" style={{ color: 'red' }}>{error}</div>}

      {loading && <LoadingSpinner />}
      {!loading && reportType === 'subject-students' && renderSubjectStudents()}
      {!loading && reportType === 'student-subject' && renderStudentSubject()}
      {!loading && reportType === 'student-overall' && renderStudentOverall()}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6 }}>
      <div className="small">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function TopicSection({ title, topics, accent }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {!topics.length ? (
        <p className="text-muted">No topic data available yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {topics.map(topic => (
            <div key={`${title}-${topic.topic}`} style={{ borderLeft: `4px solid ${accent}`, background: '#fff', padding: 12, borderRadius: 8, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontWeight: 700 }}>{topic.topic}</div>
              <div className="text-small">Accuracy: {topic.accuracy}%</div>
              <div className="text-small">Attempts: {topic.attempts}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildTrendChartData(students) {
  const buckets = { Improving: 0, Stable: 0, Declining: 0, 'Not enough data': 0 };
  students.forEach((student) => {
    const key = student.trend?.label || 'Not enough data';
    buckets[key] = (buckets[key] || 0) + 1;
  });

  return Object.entries(buckets).map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
}

function buildFilterSubtitle(filters) {
  if (!filters.startDate && !filters.endDate) {
    return 'Date range: all time';
  }

  return `Date range: ${filters.startDate || 'start'} to ${filters.endDate || 'today'}`;
}
