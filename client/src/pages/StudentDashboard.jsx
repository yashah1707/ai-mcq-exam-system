import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AnalyticsService from '../services/analyticsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [subjectData, setSubjectData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [readinessData, aiData, subjectStats] = await Promise.all([
        AnalyticsService.getPlacementReadiness(user._id),
        AnalyticsService.getAIInsights(user._id),
        AnalyticsService.getStudentAnalytics(user._id)
      ]);
      setReadiness(readinessData.data);
      setAiInsights(aiData.data);
      setSubjectData(subjectStats.data.map(s => ({
        name: s._id,
        Accuracy: Math.round(s.avgAccuracy),
        Attempts: s.totalAttempts
      })));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const weakAreas = Array.isArray(aiInsights?.weak_areas) ? aiInsights.weak_areas : [];

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '0 24px', paddingBottom: '50px' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(120deg, var(--primary) 0%, #4f46e5 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>Hello, {user?.name || 'Student'}! 👋</h1>
        </div>
      </div>

      {/* Adaptive Practice Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>🚀 Adaptive Practice Mode</h2>
            <p style={{ opacity: 0.9, margin: 0 }}>AI-powered tests that adjust difficulty based on your performance.</p>
          </div>
          <button
            onClick={() => navigate('/adaptive-test')}
            style={{ padding: '0.8rem 1.5rem', backgroundColor: 'white', color: '#764ba2', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}
          >
            Start Practice
          </button>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>

        {/* AI Profile Card */}
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <h3 style={{ marginTop: 0 }}>🤖 AI Profile Analysis</h3>
          {loading ? <p>Loading AI insights...</p> : (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {aiInsights?.profile?.cluster || 'Unclassified'}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>{aiInsights?.profile?.reason}</p>

              <div style={{ marginTop: '12px', padding: '10px', background: '#f5f3ff', borderRadius: '8px' }}>
                <strong>Recommendation:</strong><br />
                {aiInsights?.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* Readiness Score Card */}
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <h3 style={{ marginTop: 0 }}>🎯 Placement Readiness</h3>
          {loading ? <p>Calculating...</p> : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: '800', color: '#10b981' }}>
                {readiness?.score || 0}%
              </div>
              <p>{readiness?.level}</p>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#666' }}>
                <span>Accuracy: {readiness?.breakdown?.accuracy}%</span>
                <span>Consistency: {readiness?.breakdown?.consistency}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Subject Performance Chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginTop: 0 }}>📊 Subject Proficiency</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Accuracy" fill="#4f46e5" name="Accuracy (%)" />
                <Bar dataKey="Attempts" fill="#8b5cf6" name="Tests Taken" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak Areas */}
        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Focus Areas</h3>
          {loading ? <p>Analyzing...</p> : (
            weakAreas.length > 0 ? (
              <ul style={{ paddingLeft: '20px' }}>
                {weakAreas.map((topic, i) => {
                  const label = typeof topic === 'string'
                    ? topic
                    : `${topic.topic}${typeof topic.accuracy === 'number' ? ` (${topic.accuracy}% accuracy)` : ''}`;

                  return (
                    <li key={i} style={{ marginBottom: '4px', color: '#ef4444', fontWeight: '500' }}>
                      {label}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-muted">No specific weak areas detected yet! Keep it up!</p>
          )}
        </div>

        {/* Trend Analysis */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>📈 Improvement Trend</h3>
          {loading ? <p>Loading...</p> : (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{aiInsights?.trend?.trend}</div>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>{aiInsights?.trend?.reason}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
