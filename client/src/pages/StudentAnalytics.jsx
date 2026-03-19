import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AnalyticsService from '../services/analyticsService';
import PlacementReadinessCard from '../components/PlacementReadinessCard';
import { downloadCsv } from '../utils/csvExport';
import { downloadTablePdf } from '../utils/pdfExport';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

export default function StudentAnalytics() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [subjectHistoryLoading, setSubjectHistoryLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [weakTopics, setWeakTopics] = useState([]);
    const [readinessData, setReadinessData] = useState(null);
    const [subjectProficiency, setSubjectProficiency] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [overallReport, setOverallReport] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState('DBMS');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [subjectHistory, setSubjectHistory] = useState(null);
    const [overallStats, setOverallStats] = useState({
        totalExams: 0,
        avgAccuracy: 0,
        questionsAttempted: 0
    });

    const SUBJECT_OPTIONS = ['DBMS', 'OS', 'CN', 'DSA', 'Aptitude', 'Logical', 'Verbal'];

    useEffect(() => {
        fetchAnalytics();
    }, [user, startDate, endDate]);

    useEffect(() => {
        fetchSubjectHistory(selectedSubject);
    }, [user, selectedSubject, startDate, endDate]);

    const fetchAnalytics = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await AnalyticsService.getStudentAnalytics(user._id);
            const weak = await AnalyticsService.getWeakTopics(user._id);
            const readiness = await AnalyticsService.getPlacementReadiness(user._id);
            const subjProf = await AnalyticsService.getSubjectProficiency(user._id);
            const aInsights = await AnalyticsService.getAIInsights(user._id);
            const overall = await AnalyticsService.getStudentReportOverall(user._id, { startDate, endDate });

            if (data.success) {
                setAnalyticsData(data.data);

                // Calculate overall stats
                const totalAttempts = data.data.reduce((sum, item) => sum + item.totalAttempts, 0);
                const totalCorrect = data.data.reduce((sum, item) => sum + item.correctAttempts, 0);
                const avgAcc = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

                setOverallStats({
                    totalExams: data.data.length, // This is actually subjects count, ideally need exam count from another API
                    avgAccuracy: avgAcc.toFixed(1),
                    questionsAttempted: totalAttempts
                });
            }

            if (weak.success) {
                setWeakTopics(weak.data);
            }

            if (readiness.success) setReadinessData(readiness.data);
            if (subjProf && subjProf.success) setSubjectProficiency(subjProf.data);
            if (aInsights && aInsights.success) setAiInsights(aInsights.data);
            if (overall && overall.success) setOverallReport(overall.data);
        } catch (err) {
            console.error("Failed to fetch analytics", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjectHistory = async (subject) => {
        if (!user || !subject) return;
        try {
            setSubjectHistoryLoading(true);
            const response = await AnalyticsService.getStudentSubjectHistory(user._id, subject, { startDate, endDate });
            if (response.success) {
                setSubjectHistory(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch subject history', error);
        } finally {
            setSubjectHistoryLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    const exportOverallCsv = () => {
        if (!overallReport) return;
        downloadCsv(
            `my-overall-report.csv`,
            [
                { key: 'subject', label: 'Subject' },
                { key: 'testsTaken', label: 'Tests Taken' },
                { key: 'accuracy', label: 'Accuracy %' },
                { key: 'avgPercentage', label: 'Average %' },
                { key: 'avgTimeSeconds', label: 'Average Time (s)' },
                { key: 'trend', label: 'Trend' },
            ],
            overallReport.subjects.map((subject) => ({
                ...subject,
                trend: subject.trend.label,
            }))
        );
    };

    const exportOverallPdf = async () => {
        if (!overallReport) return;
        await downloadTablePdf({
            filename: 'my-overall-report.pdf',
            title: 'My Overall Report',
            subtitle: buildFilterSubtitle(startDate, endDate),
            columns: [
                { key: 'subject', label: 'Subject' },
                { key: 'testsTaken', label: 'Tests Taken' },
                { key: 'accuracy', label: 'Accuracy %' },
                { key: 'avgPercentage', label: 'Average %' },
                { key: 'avgTimeSeconds', label: 'Average Time (s)' },
                { key: 'trend', label: 'Trend' },
            ],
            rows: overallReport.subjects.map((subject) => ({ ...subject, trend: subject.trend.label })),
        });
    };

    const exportSubjectHistoryCsv = () => {
        if (!subjectHistory) return;
        downloadCsv(
            `my-${selectedSubject.toLowerCase()}-history.csv`,
            [
                { key: 'completedAt', label: 'Completed At' },
                { key: 'examTitle', label: 'Exam' },
                { key: 'mode', label: 'Mode' },
                { key: 'score', label: 'Score' },
                { key: 'maxScore', label: 'Max Score' },
                { key: 'percentage', label: 'Percentage' },
                { key: 'avgTimeSeconds', label: 'Average Time (s)' },
            ],
            subjectHistory.timeline.map((entry) => ({
                ...entry,
                completedAt: new Date(entry.completedAt).toLocaleString(),
            }))
        );
    };

    const exportSubjectHistoryPdf = async () => {
        if (!subjectHistory) return;
        await downloadTablePdf({
            filename: `my-${selectedSubject.toLowerCase()}-history.pdf`,
            title: `My ${selectedSubject} Subject History`,
            subtitle: buildFilterSubtitle(startDate, endDate),
            columns: [
                { key: 'completedAt', label: 'Completed At' },
                { key: 'examTitle', label: 'Exam' },
                { key: 'mode', label: 'Mode' },
                { key: 'score', label: 'Score' },
                { key: 'maxScore', label: 'Max Score' },
                { key: 'percentage', label: 'Percentage' },
                { key: 'avgTimeSeconds', label: 'Average Time (s)' },
            ],
            rows: subjectHistory.timeline.map((entry) => ({
                ...entry,
                completedAt: new Date(entry.completedAt).toLocaleString(),
            })),
        });
    };

    if (loading) return <div className="container" style={{ padding: '2rem' }}>Loading analytics...</div>;

    return (
        <div className="container" style={{ paddingTop: '2rem' }}>
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2>📊 My Performance Analytics</h2>
                <p>AI-powered insights into your learning progress</p>

                <div className="report-filters-grid" style={{ marginTop: '1rem' }}>
                    <div className="report-filter-field">
                        <label className="small">Start Date</label>
                        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="report-filter-field">
                        <label className="small">End Date</label>
                        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                </div>

                <div className="report-filter-actions">
                    <button className="button-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
                        Clear Dates
                    </button>
                </div>

                <div className="report-metrics-grid" style={{ marginTop: '1rem' }}>
                    <StatCard title="Overall Accuracy" value={`${overallStats.avgAccuracy}%`} color={parseFloat(overallStats.avgAccuracy) > 70 ? "green" : "orange"} />
                    <StatCard title="Questions Attempted" value={overallStats.questionsAttempted} color="blue" />
                    <StatCard title="Weak Topics identified" value={weakTopics.length} color="red" />
                </div>
            </div>

            {overallReport && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="report-header-row">
                        <h3 style={{ margin: 0 }}>My Overall Report</h3>
                        <div className="report-inline-controls">
                            <button className="button-secondary" onClick={exportOverallCsv}>Export CSV</button>
                            <button className="button-secondary" onClick={exportOverallPdf}>Export PDF</button>
                        </div>
                    </div>
                    <div className="report-metrics-grid" style={{ marginTop: '1rem' }}>
                        <StatCard title="Total Tests" value={overallReport.overview.totalTests} color="blue" />
                        <StatCard title="Average Percentage" value={`${overallReport.overview.averagePercentage}%`} color="green" />
                        <StatCard title="Strongest Subject" value={overallReport.overview.strongestSubject || 'N/A'} color="orange" />
                        <StatCard title="Weakest Subject" value={overallReport.overview.weakestSubject || 'N/A'} color="red" />
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ marginBottom: '0.75rem' }}>Recent Attempts</h4>
                        {overallReport.recentAttempts.length === 0 ? (
                            <p className="text-muted">No recent attempts found yet.</p>
                        ) : (
                            <div className="report-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Exam</th>
                                            <th>Subject</th>
                                            <th>Score</th>
                                            <th>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overallReport.recentAttempts.map((attempt) => (
                                            <tr key={attempt.attemptId}>
                                                <td>{new Date(attempt.completedAt).toLocaleDateString()}</td>
                                                <td>{attempt.examTitle}</td>
                                                <td>{attempt.subject}</td>
                                                <td>{attempt.score} / {attempt.maxScore}</td>
                                                <td>{attempt.percentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="report-header-row">
                    <div>
                        <h3 style={{ marginBottom: '0.4rem' }}>My Subject History</h3>
                        <p className="small" style={{ margin: 0 }}>Track one subject till your latest test.</p>
                    </div>
                    <div className="report-inline-controls">
                        <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
                            {SUBJECT_OPTIONS.map((subject) => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
                        <button className="button-secondary" onClick={exportSubjectHistoryCsv} disabled={!subjectHistory || !subjectHistory.timeline.length}>
                            Export CSV
                        </button>
                        <button className="button-secondary" onClick={exportSubjectHistoryPdf} disabled={!subjectHistory || !subjectHistory.timeline.length}>
                            Export PDF
                        </button>
                    </div>
                </div>

                {subjectHistoryLoading ? (
                    <div style={{ marginTop: '1rem' }}><LoadingMessage /></div>
                ) : subjectHistory ? (
                    <>
                        <div className="report-metrics-grid" style={{ marginTop: '1rem' }}>
                            <StatCard title="Tests Taken" value={subjectHistory.overview.testsTaken} color="blue" />
                            <StatCard title="Accuracy" value={`${subjectHistory.overview.accuracy}%`} color="green" />
                            <StatCard title="Best Percentage" value={`${subjectHistory.overview.bestPercentage}%`} color="orange" />
                            <StatCard title="Trend" value={subjectHistory.overview.trend.label} color="red" />
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            {!subjectHistory.timeline.length ? (
                                <p className="text-muted">No completed attempts found for this subject yet.</p>
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
                                                <th>Avg Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjectHistory.timeline.map((entry) => (
                                                <tr key={entry.attemptId}>
                                                    <td>{new Date(entry.completedAt).toLocaleDateString()}</td>
                                                    <td>{entry.examTitle}</td>
                                                    <td>{entry.mode}</td>
                                                    <td>{entry.score} / {entry.maxScore}</td>
                                                    <td>{entry.percentage}%</td>
                                                    <td>{entry.avgTimeSeconds}s</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-muted" style={{ marginTop: '1rem' }}>No subject report available yet.</p>
                )}
            </div>


            {/* Placement Readiness Score */}
            <PlacementReadinessCard data={readinessData} />

            <div className="report-insights-grid" style={{ marginTop: '2rem' }}>
                {/* Subject Performance Chart */}
                <div className="card report-insight-wide">
                    <h3>Subject-wise Performance</h3>
                    <div style={{ height: 300, width: '100%', marginTop: '1rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="_id" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="avgAccuracy" name="Accuracy %" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Subject Proficiency (by subject averages) */}
                <div className="card">
                    <h3>Subject Proficiency</h3>
                    {subjectProficiency ? (
                        <div style={{ marginTop: '1rem' }}>
                            {/* build simple list of subjects with avg accuracy */}
                            {Object.keys(subjectProficiency).map((sub) => (
                                <div key={sub} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f1f3f5' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ fontWeight: 600 }}>{sub}</div>
                                        <div style={{ color: '#495057' }}>{subjectProficiency[sub].avgAccuracy}%</div>
                                    </div>
                                    <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: '#6c757d' }}>
                                        {subjectProficiency[sub].topics.slice(0,3).map(t => `${t.topic} (${t.accuracy}%)`).join(' • ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ marginTop: '0.5rem' }}>No subject proficiency data available.</div>
                    )}
                </div>

                {/* AI Insights Panel */}
                <div className="card">
                    <h3>AI Insights</h3>
                    {aiInsights ? (
                        <div style={{ marginTop: '1rem' }}>
                            {aiInsights.profile && (
                                <div style={{ marginBottom: '0.6rem' }}>
                                    <strong>Profile:</strong> {aiInsights.profile.cluster} — {aiInsights.profile.reason}
                                </div>
                            )}
                            {aiInsights.trend && (
                                <div style={{ marginBottom: '0.6rem' }}>
                                    <strong>Trend:</strong> {aiInsights.trend.trend} — {aiInsights.trend.reason}
                                </div>
                            )}
                            {aiInsights.recommendation && (
                                <div style={{ marginBottom: '0.6rem' }}>
                                    <strong>Recommendation:</strong> {aiInsights.recommendation}
                                </div>
                            )}
                            {aiInsights.weak_areas && aiInsights.weak_areas.length > 0 && (
                                <div style={{ marginTop: '0.6rem' }}>
                                    <strong>Weak Areas:</strong>
                                    <ul>
                                        {aiInsights.weak_areas.map((w, i) => (
                                            <li key={i}>{w.topic} — {w.accuracy}% ({w.attempts} attempts)</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ marginTop: '0.5rem' }}>No AI insights available yet.</div>
                    )}
                </div>

                {/* Weak Topics Alert */}
                <div className="card" style={{ borderLeft: '5px solid #ff6b6b' }}>
                    <h3 style={{ color: '#e03131' }}>⚠️ Areas for Improvement</h3>
                    <p className="small">The AI has identified these topics as your weak areas based on your recent performance.</p>

                    <div style={{ marginTop: '1rem' }}>
                        {weakTopics.length === 0 ? (
                            <p style={{ color: 'green' }}>Great job! No weak topics identified yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {weakTopics.map((topic, index) => (
                                    <li key={index} style={{
                                        padding: '0.8rem',
                                        marginBottom: '0.5rem',
                                        backgroundColor: '#fff5f5',
                                        border: '1px solid #ffc9c9',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span><strong>{topic.topic}</strong> ({topic.subject})</span>
                                        <span style={{
                                            backgroundColor: '#ffc9c9',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            color: '#c92a2a'
                                        }}>{topic.accuracy.toFixed(0)}%</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {weakTopics.length > 0 && (
                        <button
                            onClick={() => navigate('/adaptive-test')}
                            style={{
                                width: '100%',
                                marginTop: '1rem',
                                backgroundColor: '#fa5252'
                            }}>
                            Generate Adaptive Test for Weak Topics
                        </button>
                    )}
                </div>
            </div>

            {/* Recommendations Section */}
            <div className="card" style={{ marginTop: '2rem' }}>
                <h3>🤖 AI Recommendations</h3>
                <div style={{ marginTop: '1rem' }}>
                    {overallStats.avgAccuracy < 50 ? (
                        <p>Your overall accuracy is below 50%. We recommend starting with <strong>Basic Concepts</strong> in your weak subjects before attempting advanced topics.</p>
                    ) : overallStats.avgAccuracy < 70 ? (
                        <p>You are doing well! Focus on your weak topics listed above to push your score to the next level.</p>
                    ) : (
                        <p>Excellent performance! You are ready for <strong>Advanced Mock Tests</strong>. Try limiting your time per question to improve speed.</p>
                    )}
                </div>
            </div>
        </div >
    );
}

function LoadingMessage() {
    return <div className="text-muted">Loading report...</div>;
}

function buildFilterSubtitle(startDate, endDate) {
    if (!startDate && !endDate) {
        return 'Date range: all time';
    }

    return `Date range: ${startDate || 'start'} to ${endDate || 'today'}`;
}

function StatCard({ title, value, color }) {
    const colorMap = {
        green: '#2f9e44',
        orange: '#f08c00',
        red: '#e03131',
        blue: '#1971c2'
    };

    return (
        <div style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            borderLeft: `4px solid ${colorMap[color] || '#333'}`,
            flex: 1,
            minWidth: '150px'
        }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>{title}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#333' }}>{value}</div>
        </div>
    );
}
