import React, { useState, useEffect, useContext } from 'react';
import { fetchExams } from '../services/examService';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ExamsPage() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetchExams();
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

    const handleStartExam = (examId) => {
        navigate(`/exam/${examId}`);
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>📋 Available Exams</h1>
                <p style={{ margin: '6px 0 0 0', color: '#666', fontSize: '0.95rem' }}>
                    Active exams assigned by your admin. Click "Start Exam" to begin.
                </p>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                    <p>Loading exams...</p>
                </div>
            )}

            {error && (
                <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
                    {error}
                </div>
            )}

            {!loading && !error && exams.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#888', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No exams available right now.</p>
                    <p style={{ fontSize: '0.9rem' }}>Check back later or try the Adaptive Practice Mode.</p>
                </div>
            )}

            {!loading && exams.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {exams.map(ex => (
                        <div key={ex._id} className="card" style={{ padding: '20px 24px', borderLeft: '4px solid var(--primary)', transition: 'box-shadow 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700 }}>{ex.title}</h3>
                                    {ex.description && (
                                        <p style={{ margin: '0 0 10px 0', color: '#6366f1', fontSize: '0.88rem' }}>{ex.description}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555' }}>
                                        <span>⏱ {ex.duration} mins</span>
                                        <span>❓ {ex.questions.length} questions</span>
                                        <span>🏆 {ex.totalMarks} marks</span>
                                        <span>✅ Pass: {ex.passingMarks}</span>
                                        {ex.enableNegativeMarking && <span style={{ color: '#ef4444' }}>⚠️ Negative marking</span>}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#999' }}>
                                        Ends: {new Date(ex.endDate).toLocaleDateString()} at {new Date(ex.endDate).toLocaleTimeString()}
                                    </div>
                                </div>
                                <button
                                    className="button"
                                    onClick={() => handleStartExam(ex._id)}
                                    style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
                                >
                                    Start Exam →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
