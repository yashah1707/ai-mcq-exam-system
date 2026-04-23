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
                if (import.meta.env.DEV) {
                    console.debug('[ExamsPage] fetched exams', res.exams || []);
                }
                const now = new Date();
                const available = (res.exams || []).filter(e => {
                    const creatorRole = e?.createdBy?.role;
                    const isStandardAssignedExam = e?.examType !== 'adaptive' && (creatorRole === 'admin' || creatorRole === 'teacher');
                    const isActive = e.isActive;
                    const startDate = new Date(e.startDate);
                    const endDate = new Date(e.endDate);
                    const withinWindow = !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate <= now && endDate >= now;
                    return isStandardAssignedExam && isActive && withinWindow;
                }).sort((left, right) => {
                    const leftCreatedAt = new Date(left?.createdAt || left?.startDate || 0).getTime();
                    const rightCreatedAt = new Date(right?.createdAt || right?.startDate || 0).getTime();
                    return rightCreatedAt - leftCreatedAt;
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
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A1A2E' }}>
                    AVAILABLE EXAMS
                </h1>
                {/* Rainbow accent bar */}
                <div style={{ height: '3px', width: '80px', background: 'linear-gradient(90deg, #9B30E0 0%, #C0359E 25%, #E8631A 55%, #F5AB00 100%)', borderRadius: '2px', marginTop: '8px', marginBottom: '8px' }} />
                <p style={{ margin: '6px 0 0 0', color: '#5A5A7A', fontSize: '0.92rem', fontFamily: "'Outfit', sans-serif" }}>
                    Active exams assigned by your admin or teacher. Click "Start Exam" to begin.
                </p>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#5A5A7A' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                    <p style={{ fontFamily: "'Outfit', sans-serif" }}>Loading exams...</p>
                </div>
            )}

            {error && (
                <div style={{ padding: '16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', color: '#E8361A', fontFamily: "'Outfit', sans-serif" }}>
                    {error}
                </div>
            )}

            {!loading && !error && exams.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#5A5A7A', background: '#F0EDF8', borderRadius: '16px', border: '1px dashed #E2D8F0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>No exams available right now.</p>
                    <p style={{ fontSize: '0.9rem', fontFamily: "'Outfit', sans-serif" }}>Check back later or try the Adaptive Practice Mode.</p>
                </div>
            )}

            {!loading && exams.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {exams.map(ex => (
                        <div key={ex._id} className="card" style={{ padding: '20px 24px', borderLeft: '4px solid #6A0DAD', transition: 'box-shadow 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: '#1A1A2E' }}>{ex.title}</h3>
                                    {ex.description && (
                                        <p style={{ margin: '0 0 10px 0', color: '#6A0DAD', fontSize: '0.88rem', fontFamily: "'Outfit', sans-serif" }}>{ex.description}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: '#5A5A7A', fontFamily: "'Outfit', sans-serif" }}>
                                        <span>⏱ {ex.duration} mins</span>
                                        <span>❓ {ex.questions.length} questions</span>
                                        <span>🏆 {ex.totalMarks} marks</span>
                                        <span>✅ Pass: {ex.passingMarks}</span>
                                        {ex.enableNegativeMarking && <span style={{ color: '#E8361A' }}>⚠️ Negative marking</span>}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#5A5A7A' }}>
                                        Ends: {new Date(ex.endDate).toLocaleDateString()} at {new Date(ex.endDate).toLocaleTimeString()}
                                    </div>
                                </div>
                                <button
                                    className="button"
                                    onClick={() => handleStartExam(ex._id)}
                                    style={{ whiteSpace: 'nowrap', alignSelf: 'center', background: 'linear-gradient(90deg, #D9601A 0%, #E88A10 100%)', fontFamily: "'Outfit', sans-serif" }}
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
