import React, { useEffect, useState } from 'react';
import {
    getBatchOverview,
    getSubjectPerformance,
    getWeaknessHeatmap,
    getReadinessDistribution
} from '../../services/batchService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#e03131', '#f08c00', '#2b8a3e', '#1098ad'];

export default function BatchAnalytics() {
    const [overview, setOverview] = useState(null);
    const [subjectData, setSubjectData] = useState([]);
    const [heatmapData, setHeatmapData] = useState([]);
    const [readinessData, setReadinessData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState('');

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        fetchHeatmap();
    }, [selectedSubject]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [resOverview, resSubject, resReadiness] = await Promise.all([
                getBatchOverview(),
                getSubjectPerformance(),
                getReadinessDistribution()
            ]);

            if (resOverview.success) setOverview(resOverview.data);
            if (resSubject.success) setSubjectData(resSubject.data);
            if (resReadiness.success) setReadinessData(resReadiness.data);

            await fetchHeatmap();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHeatmap = async () => {
        try {
            const res = await getWeaknessHeatmap(selectedSubject);
            if (res.success) setHeatmapData(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    if (loading && !overview) return <div style={{ padding: '2rem' }}>Loading Batch Analytics...</div>;

    return (
        <div style={{ padding: '0 0.5rem' }}>
            <h1 style={{ marginBottom: '1.5rem', color: '#1f2937' }}>Batch Performance Analytics</h1>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card title="Total Students" value={overview?.totalStudents} color="#4f46e5" />
                <Card title="Active Learners" value={overview?.activeStudents} color="#10b981" />
                <Card title="Avg Batch Score" value={`${overview?.batchAverage}%`} color="#f59e0b" />
                <Card title="Total Exams Taken" value={overview?.totalExams} color="#ef4444" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Subject Performance */}
                <div className="card">
                    <h3>📚 Subject-wise Proficiency</h3>
                    <p className="small" style={{ marginBottom: '1rem' }}>Comparison of average accuracy across subjects</p>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} />
                                <YAxis dataKey="_id" type="category" width={80} />
                                <Tooltip />
                                <Bar dataKey="avgScore" fill="#6366f1" name="Avg Accuracy %" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Readiness Distribution */}
                <div className="card">
                    <h3>🎯 Placement Readiness</h3>
                    <p className="small" style={{ marginBottom: '1rem' }}>Distribution of students by readiness level</p>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={readinessData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {readinessData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Heatmap / Weak Topics */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h3>🔥 Weak Areas Heatmap</h3>
                        <p className="small">Topics where the batch struggles the most (Low Accuracy)</p>
                    </div>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value="">All Subjects</option>
                        <option value="DBMS">DBMS</option>
                        <option value="OS">Operating Systems</option>
                        <option value="CN">Networks</option>
                        <option value="DSA">DSA</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {heatmapData.map((topic, idx) => (
                        <div key={idx} style={{
                            padding: '1rem',
                            border: '1px solid #fee2e2',
                            backgroundColor: '#fef2f2',
                            borderRadius: '6px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ color: '#991b1b', display: 'block' }}>{topic._id}</strong>
                                <span className="small" style={{ color: '#7f1d1d' }}>{topic.subject}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626' }}>
                                    {Math.round(topic.avgAccuracy)}%
                                </div>
                                <span className="small">Accuracy</span>
                            </div>
                        </div>
                    ))}
                    {heatmapData.length === 0 && <div className="small">No weak topics found.</div>}
                </div>
            </div>
        </div>
    );
}

const Card = ({ title, value, color }) => (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
        <h4 style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{title}</h4>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937' }}>{value}</div>
    </div>
);
