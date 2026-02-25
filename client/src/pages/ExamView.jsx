import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExamPage from './ExamPage';

export default function ExamView() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const handleComplete = (data) => {
    const attemptId = data?.attempt?._id || data?.attempt?.id || data?.attemptId;
    if (attemptId) navigate(`/result/${attemptId}`);
    else navigate('/dashboard');
  };

  return <ExamPage examId={examId} onComplete={handleComplete} />;
}
