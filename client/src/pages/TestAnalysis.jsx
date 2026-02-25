import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttemptAnalysis } from '../services/examService';

export default function TestAnalysis() {
    const { attemptId } = useParams();
    const navigate = useNavigate();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                const res = await getAttemptAnalysis(attemptId);
                if (res.success) {
                    setAnalysis(res.data);
                }
            } catch (error) {
                console.error("Error fetching analysis:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [attemptId]);

    if (loading) return (
        <div className="container flex-center" style={{ minHeight: '80vh' }}>
            <div className="text-muted">Loading Analysis...</div>
        </div>
    );

    if (!analysis) return (
        <div className="container flex-center" style={{ minHeight: '80vh' }}>
            <div className="card text-center p-5">
                <h3>Analysis Not Found</h3>
                <button onClick={() => navigate('/dashboard')} className="button button-primary mt-3">Back to Dashboard</button>
            </div>
        </div>
    );

    return (
        <div className="container" style={{ paddingTop: '2rem', maxWidth: '900px', paddingBottom: '4rem' }}>

            {/* Header Card */}
            <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, white 0%, #f8fafc 100%)', border: 'none', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>📊 Performance Analysis</h1>
                        <p className="text-muted">{analysis.subject} • {new Date(analysis.startTime).toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="button"
                        style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                        Esc to Dashboard
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', position: 'relative' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', opacity: 0.8 }}>Final Score</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                            {analysis.score} <span style={{ fontSize: '1rem', fontWeight: '600', opacity: 0.8 }}>/ {analysis.totalQuestions}</span>
                        </div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '12px', background: '#f1f5f9' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', opacity: 0.6 }}>Total Questions</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>{analysis.totalQuestions}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attempted</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '12px', background: '#f1f5f9' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', opacity: 0.6 }}>Accuracy</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                            {Math.round((analysis.questions.filter(q => q.isCorrect).length / analysis.totalQuestions) * 100)}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {analysis.questions.filter(q => q.isCorrect).length} correct
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {analysis.questions.map((q, idx) => (
                    <div key={idx} className="card" style={{
                        borderLeft: q.isCorrect ? '6px solid #22c55e' : '6px solid #ef4444',
                        padding: '0', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '16px 24px',
                            background: '#f8fafc',
                            borderBottom: '1px solid var(--border-light)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Question {idx + 1}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {q.isCorrect ? (
                                    <span style={{ color: '#15803d', fontWeight: 'bold', fontSize: '0.9rem', marginRight: '8px' }}>+1 PT</span>
                                ) : (
                                    <span style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: '0.9rem', marginRight: '8px' }}>0 PT</span>
                                )}
                                <span style={{
                                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                                    backgroundColor: q.difficulty === 'Hard' ? '#fee2e2' : q.difficulty === 'Medium' ? '#fef3c7' : '#dcfce7',
                                    color: q.difficulty === 'Hard' ? '#991b1b' : q.difficulty === 'Medium' ? '#92400e' : '#166534'
                                }}>
                                    {q.difficulty}
                                </span>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>{q.questionText}</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {q.options.map((opt, optIdx) => {
                                    const isCorrect = optIdx === q.correctAnswer;
                                    const isSelected = optIdx === q.selectedOption;

                                    // Logic for colors
                                    let bgColor = 'white';
                                    let borderColor = 'var(--border-light)';
                                    let icon = null;

                                    if (isCorrect) {
                                        bgColor = '#f0fdf4';
                                        borderColor = '#22c55e';
                                        icon = '✅';
                                    } else if (isSelected && !isCorrect) {
                                        bgColor = '#fef2f2';
                                        borderColor = '#ef4444';
                                        icon = '❌';
                                    }

                                    const style = {
                                        padding: '12px 16px',
                                        border: '1px solid',
                                        borderColor: borderColor,
                                        backgroundColor: bgColor,
                                        borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        color: isCorrect ? '#15803d' : (isSelected ? '#b91c1c' : 'inherit'),
                                        fontWeight: (isCorrect || isSelected) ? '500' : '400'
                                    };

                                    return (
                                        <div key={optIdx} style={style}>
                                            <div style={{ width: '24px' }}>{icon}</div>
                                            <span>{opt}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                                <strong style={{ color: '#1e40af', display: 'block', marginBottom: '4px' }}>Explanation:</strong>
                                <span style={{ color: '#334155' }}>{q.explanation || 'No explanation provided.'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
