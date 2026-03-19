import React from 'react';

export default function ExamResult({ result, exam, onClose, title = 'Exam Result' }) {
  if (!result) return null;

  const { score, totalMarks, percentage, passed, evaluated } = result;
  const getOptionLabel = (index) => String.fromCharCode(65 + index);
  const showPassStatus = typeof passed === 'boolean';
  const showPassingMarks = typeof exam?.passingMarks === 'number';

  return (
    <div className="container">
      <div className="nav">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {showPassStatus && (
            <h3 style={{ fontSize: 32, color: passed ? '#10b981' : '#dc2626' }}>
              {passed ? 'PASSED ✓' : 'FAILED ✗'}
            </h3>
          )}
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            Score: {score} / {totalMarks}
          </div>
          <div style={{ fontSize: 18, color: '#666', marginTop: 4 }}>
            {percentage}%
          </div>
          {showPassingMarks && (
            <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>
              Passing Marks: {exam.passingMarks}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Detailed Review</h3>
        {evaluated && evaluated.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Q{idx + 1}: {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </div>
            {item.questionText && (
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>
                {item.questionText}
              </div>
            )}
            {item.questionImageUrl && (
              <img
                src={item.questionImageUrl}
                alt="Question"
                style={{ display: 'block', maxWidth: '100%', maxHeight: 280, marginBottom: 12, borderRadius: 10, border: '1px solid #dbe3ee' }}
              />
            )}
            {Array.isArray(item.options) && item.options.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {item.options.map((option, optionIndex) => {
                  const isCorrectOption = optionIndex === item.correctAnswer;
                  const isSelectedOption = optionIndex === item.selectedOption;

                  let background = '#fff';
                  let border = '#e5e7eb';
                  let color = '#334155';

                  if (isCorrectOption) {
                    background = '#f0fdf4';
                    border = '#86efac';
                    color = '#166534';
                  } else if (isSelectedOption) {
                    background = '#fef2f2';
                    border = '#fca5a5';
                    color = '#991b1b';
                  }

                  return (
                    <div
                      key={`${idx}-${optionIndex}`}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${border}`,
                        background,
                        color,
                        fontWeight: isCorrectOption || isSelectedOption ? 600 : 400,
                      }}
                    >
                      {getOptionLabel(optionIndex)}. {option}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="small" style={{ marginBottom: 8 }}>
              Your Answer: {item.selectedOption !== null ? `Option ${getOptionLabel(item.selectedOption)}` : 'Not Answered'}
            </div>
            <div className="small" style={{ marginBottom: 8, color: '#10b981' }}>
              Correct Answer: Option {getOptionLabel(item.correctAnswer)}
            </div>
            {item.explanation && (
              <div className="small" style={{ marginTop: 8, padding: 8, background: '#f0fdf4', borderRadius: 4 }}>
                <strong>Explanation:</strong> {item.explanation}
              </div>
            )}
            <div className="small" style={{ marginTop: 8, color: item.marksAwarded < 0 ? '#dc2626' : '#666' }}>
              Marks Awarded: {item.marksAwarded} / {item.marks}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
