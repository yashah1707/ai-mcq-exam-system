import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import AnalyticsService from '../services/analyticsService';
import PlacementReadinessCard from '../components/PlacementReadinessCard';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

export default function StudentAnalytics() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [weakTopics, setWeakTopics] = useState([]);
    const [readinessData, setReadinessData] = useState(null);
    const [overallStats, setOverallStats] = useState({
        totalExams: 0,
        avgAccuracy: 0,
        questionsAttempted: 0
    });

    useEffect(() => {
        fetchAnalytics();
    }, [user]);

    const fetchAnalytics = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await AnalyticsService.getStudentAnalytics(user._id);
            const weak = await AnalyticsService.getWeakTopics(user._id);
            const readiness = await AnalyticsService.getPlacementReadiness(user._id);

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

            if (readiness.success) {
                setReadinessData(readiness.data);
            }
        } catch (err) {
            console.error("Failed to fetch analytics", err);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    if (loading) return <div className="container" style={{ padding: '2rem' }}>Loading analytics...</div>;

    return (
        <div className="container" style={{ paddingTop: '2rem' }}>
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2>📊 My Performance Analytics</h2>
                <p>AI-powered insights into your learning progress</p>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <StatCard title="Overall Accuracy" value={`${overallStats.avgAccuracy}%`} color={parseFloat(overallStats.avgAccuracy) > 70 ? "green" : "orange"} />
                    <StatCard title="Questions Attempted" value={overallStats.questionsAttempted} color="blue" />
                    <StatCard title="Weak Topics identified" value={weakTopics.length} color="red" />
                </div>
            </div>


            {/* Placement Readiness Score */}
            <PlacementReadinessCard data={readinessData} />

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '2rem' }}>
                {/* Subject Performance Chart */}
                <div className="card" style={{ flex: '2', minWidth: '400px' }}>
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

                {/* Weak Topics Alert */}
                <div className="card" style={{ flex: '1', minWidth: '300px', borderLeft: '5px solid #ff6b6b' }}>
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
                            onClick={() => window.location.href = '/adaptive-test'}
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
