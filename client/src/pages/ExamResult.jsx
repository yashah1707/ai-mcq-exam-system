import React from 'react';

export default function ExamResult({ result, exam, onClose }) {
  if (!result) return null;

  const { score, totalMarks, percentage, passed, evaluated } = result;

  return (
    <div className="container">
      <div className="nav">
        <h2>Exam Result</h2>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 32, color: passed ? '#10b981' : '#dc2626' }}>
            {passed ? 'PASSED ✓' : 'FAILED ✗'}
          </h3>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            Score: {score} / {totalMarks}
          </div>
          <div style={{ fontSize: 18, color: '#666', marginTop: 4 }}>
            {percentage}%
          </div>
          <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>
            Passing Marks: {exam.passingMarks}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Detailed Review</h3>
        {evaluated && evaluated.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Q{idx + 1}: {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </div>
            <div className="small" style={{ marginBottom: 8 }}>
              Your Answer: Option {item.selectedOption !== null ? String.fromCharCode(65 + item.selectedOption) : 'Not Answered'}
            </div>
            <div className="small" style={{ marginBottom: 8, color: '#10b981' }}>
              Correct Answer: {String.fromCharCode(65 + item.correctAnswer)}
            </div>
            {item.explanation && (
              <div className="small" style={{ marginTop: 8, padding: 8, background: '#f0fdf4', borderRadius: 4 }}>
                <strong>Explanation:</strong> {item.explanation}
              </div>
            )}
            <div className="small" style={{ marginTop: 8, color: '#666' }}>
              Marks: {item.isCorrect ? item.marks : 0} / {item.marks}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
