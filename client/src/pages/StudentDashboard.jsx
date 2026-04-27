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
        background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 40%, #9B30E0 70%, #D4267A 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        marginBottom: '32px',
        boxShadow: '0 8px 24px rgba(75, 0, 130, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Diagonal stripe pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 16px)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Hello, {user?.firstName || user?.name || 'Student'}! 👋</h1>
        </div>
      </div>

      {/* Adaptive Practice Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #C0359E 0%, #E85A28 55%, #F5AB00 100%)', color: 'white', marginBottom: '2rem', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🚀 Adaptive Practice Mode</h2>
            <p style={{ opacity: 0.9, margin: 0, fontFamily: "'Outfit', sans-serif" }}>AI-powered tests that adjust difficulty based on your performance.</p>
          </div>
          <button
            onClick={() => navigate('/adaptive-test')}
            style={{ padding: '0.8rem 1.5rem', backgroundColor: '#1A1A2E', color: 'white', border: 'none', borderRadius: '24px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
          >
            Start Practice
          </button>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>

        {/* AI Profile Card */}
        <div className="card" style={{ borderLeft: '4px solid #6A0DAD' }}>
          <h3 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.95rem' }}>🤖 AI PROFILE ANALYSIS</h3>
          {loading ? <p>Loading AI insights...</p> : (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#6A0DAD', fontFamily: "'Outfit', sans-serif" }}>
                {aiInsights?.profile?.cluster || 'Unclassified'}
              </div>
              <p style={{ fontSize: '0.9rem', color: '#5A5A7A' }}>{aiInsights?.profile?.reason}</p>

              <div style={{ marginTop: '12px', padding: '10px', background: '#F0EDF8', borderRadius: '8px', border: '1px solid #E2D8F0' }}>
                <strong>Recommendation:</strong><br />
                {aiInsights?.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* Readiness Score Card */}
        <div className="card" style={{ borderLeft: '4px solid #28A745' }}>
          <h3 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.95rem' }}>🎯 PLACEMENT READINESS</h3>
          {loading ? <p>Calculating...</p> : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#28A745', fontFamily: "'Outfit', sans-serif" }}>
                {readiness?.score || 0}%
              </div>
              <p>{readiness?.level}</p>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#5A5A7A' }}>
                <span>Accuracy: {readiness?.breakdown?.accuracy}%</span>
                <span>Consistency: {readiness?.breakdown?.consistency}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Subject Performance Chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.95rem' }}>📊 SUBJECT PROFICIENCY</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2D8F0" />
                <XAxis dataKey="name" tick={{ fontFamily: "'Outfit', sans-serif", fontSize: 12 }} />
                <YAxis tick={{ fontFamily: "'Outfit', sans-serif", fontSize: 12 }} />
                <Tooltip contentStyle={{ fontFamily: "'Outfit', sans-serif", borderRadius: '8px', border: '1px solid #E2D8F0' }} />
                <Legend wrapperStyle={{ fontFamily: "'Outfit', sans-serif" }} />
                <Bar dataKey="Accuracy" fill="#6A0DAD" name="Accuracy (%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Attempts" fill="#9B30E0" name="Tests Taken" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak Areas */}
        <div className="card" style={{ borderLeft: '4px solid #E8361A' }}>
          <h3 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.95rem' }}>⚠️ FOCUS AREAS</h3>
          {loading ? <p>Analyzing...</p> : (
            weakAreas.length > 0 ? (
              <ul style={{ paddingLeft: '20px' }}>
                {weakAreas.map((topic, i) => {
                  const label = typeof topic === 'string'
                    ? topic
                    : `${topic.topic}${typeof topic.accuracy === 'number' ? ` (${topic.accuracy}% accuracy)` : ''}`;

                  return (
                    <li key={i} style={{ marginBottom: '4px', color: '#E8361A', fontWeight: '600' }}>
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
          <h3 style={{ marginTop: 0, fontFamily: "'Outfit', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.95rem' }}>📈 IMPROVEMENT TREND</h3>
          {loading ? <p>Loading...</p> : (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: '#6A0DAD' }}>{aiInsights?.trend?.trend}</div>
              <p style={{ fontSize: '0.9rem', color: '#5A5A7A' }}>{aiInsights?.trend?.reason}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
