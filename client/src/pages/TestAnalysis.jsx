import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { getAttemptAnalysis } from '../services/examService';
import ExamResult from './ExamResult';

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

    if (loading) return <LoadingSpinner fullScreen />;

    if (!analysis) return (
        <div className="container flex-center" style={{ minHeight: '80vh' }}>
            <div className="card text-center p-5">
                <h3>Adaptive Result Not Found</h3>
                <button onClick={() => navigate('/dashboard')} className="button button-primary mt-3">Back to Dashboard</button>
            </div>
        </div>
    );

    const totalQuestions = Number(analysis.totalQuestions) || analysis.questions.length || 0;
    const percentage = totalQuestions > 0 ? ((analysis.score / totalQuestions) * 100).toFixed(2) : '0.00';

    const result = {
        score: analysis.score,
        totalMarks: totalQuestions,
        percentage,
        evaluated: analysis.questions.map((question) => ({
            ...question,
            selectedOption: question.selectedOption ?? null,
            marksAwarded: question.isCorrect ? 1 : 0,
            marks: 1,
        })),
    };

    return (
        <ExamResult
            title="Adaptive Test Result"
            result={result}
            exam={{}}
            onClose={() => navigate('/dashboard')}
        />
    );
}
