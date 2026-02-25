import React, { useState, useEffect } from 'react';
import { createQuestion, fetchQuestions, updateQuestion, deleteQuestion, bulkCreateQuestions } from '../services/questionService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    category: 'Aptitude',
    difficulty: 'Easy',
    marks: 1,
    negativeMarks: 0,
    explanation: ''
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchQuestions();
      setQuestions(res.questions || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const downloadSampleCSV = () => {
    const sampleData = [
      ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'category', 'difficulty', 'marks', 'negativeMarks', 'explanation'],
      ['What is 2+2?', '2', '3', '4', '5', '2', 'Aptitude', 'Easy', '1', '0.25', 'Basic arithmetic'],
      ['What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', '2', 'Logical', 'Easy', '2', '0.5', 'Paris is the capital of France'],
      ['Which data structure uses LIFO?', 'Queue', 'Stack', 'Array', 'Tree', '1', 'Technical', 'Medium', '3', '1', 'Stack follows Last In First Out principle']
    ];

    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_questions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (file) => {
    setBulkResult(null);
    if (!file) return;
    setBulkUploading(true);
    try {
      const text = await file.text();
      let data;

      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
        // Use papaparse for better CSV parsing
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim()
        });

        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors.map(e => e.message).join(', ')}`);
        }

        data = parsed.data.map((row, index) => {
          // Validate required fields
          if (!row.questionText || row.questionText.trim().length < 10) {
            throw new Error(`Row ${index + 2}: Question text is required (min 10 chars)`);
          }

          const options = [
            row.optionA || row.A || row.option1 || '',
            row.optionB || row.B || row.option2 || '',
            row.optionC || row.C || row.option3 || '',
            row.optionD || row.D || row.option4 || ''
          ];

          if (options.some(opt => !opt || opt.trim().length === 0)) {
            throw new Error(`Row ${index + 2}: All 4 options are required`);
          }

          const correctAnswer = Number(row.correctAnswer || row.correctIndex || 0);
          if (correctAnswer < 0 || correctAnswer > 3) {
            throw new Error(`Row ${index + 2}: Correct answer must be 0-3`);
          }

          return {
            questionText: row.questionText.trim(),
            options: options.map(opt => opt.trim()),
            correctAnswer,
            category: row.category || 'Aptitude',
            difficulty: row.difficulty || 'Easy',
            marks: Number(row.marks || 1),
            negativeMarks: Number(row.negativeMarks || 0),
            explanation: row.explanation || ''
          };
        });
      }

      // Validate data is array
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No valid questions found in file');
      }

      const res = await bulkCreateQuestions(data);
      setBulkResult(res);
      await load();
    } catch (err) {
      setBulkResult({ error: err.message || String(err) });
    } finally {
      setBulkUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    // Validation
    if (!form.questionText || form.questionText.trim().length < 5) return setError('Question text is required (min 5 chars)');
    if (!form.options || form.options.length !== 4 || form.options.some(o => !o || !o.trim())) return setError('All 4 options are required');
    if (!form.marks || form.marks < 1) return setError('Marks must be at least 1');
    setSubmitting(true);
    try {
      if (editId) {
        await updateQuestion(editId, form);
      } else {
        await createQuestion(form);
      }
      setForm({ questionText: '', options: ['', '', '', ''], correctAnswer: 0, category: 'Aptitude', difficulty: 'Easy', marks: 1, negativeMarks: 0, explanation: '' });
      setEditId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this question?')) {
      try {
        await deleteQuestion(id);
        await load();
      } catch (err) {
        alert(err?.response?.data?.message || err.message);
      }
    }
  };

  const handleEdit = (q) => {
    setForm({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks || 0,
      explanation: q.explanation
    });
    setEditId(q._id);
    setShowForm(true);
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>Manage Questions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ questionText: '', options: ['', '', '', ''], correctAnswer: 0, category: 'Aptitude', difficulty: 'Easy', marks: 1, negativeMarks: 0, explanation: '' }); }}>
            {showForm ? 'Cancel' : 'Add Question'}
          </button>
          <label style={{ display: 'inline-block' }}>
            <input type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            <button className="button-secondary">📤 Bulk Upload</button>
          </label>
          <button className="button-secondary" onClick={downloadSampleCSV}>📥 Download Sample CSV</button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit' : 'Create'} Question</h3>

          <div className="form-group">
            <label>Question Text</label>
            <textarea value={form.questionText} onChange={e => setForm({ ...form, questionText: e.target.value })} required></textarea>
          </div>

          <div className="grid">
            <div className="form-group">
              <label>Option A</label>
              <input value={form.options[0]} onChange={e => { const opts = [...form.options]; opts[0] = e.target.value; setForm({ ...form, options: opts }); }} required />
            </div>
            <div className="form-group">
              <label>Option B</label>
              <input value={form.options[1]} onChange={e => { const opts = [...form.options]; opts[1] = e.target.value; setForm({ ...form, options: opts }); }} required />
            </div>
            <div className="form-group">
              <label>Option C</label>
              <input value={form.options[2]} onChange={e => { const opts = [...form.options]; opts[2] = e.target.value; setForm({ ...form, options: opts }); }} required />
            </div>
            <div className="form-group">
              <label>Option D</label>
              <input value={form.options[3]} onChange={e => { const opts = [...form.options]; opts[3] = e.target.value; setForm({ ...form, options: opts }); }} required />
            </div>
          </div>

          <div className="grid">
            <div className="form-group">
              <label>Correct Answer</label>
              <select value={form.correctAnswer} onChange={e => setForm({ ...form, correctAnswer: parseInt(e.target.value) })}>
                <option value="0">Option A</option>
                <option value="1">Option B</option>
                <option value="2">Option C</option>
                <option value="3">Option D</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option>Aptitude</option>
                <option>Logical</option>
                <option>Technical</option>
              </select>
            </div>

            <div className="form-group">
              <label>Difficulty</label>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label>Marks (Correct Answer)</label>
              <input type="number" min="1" value={form.marks} onChange={e => setForm({ ...form, marks: parseInt(e.target.value) })} required />
            </div>

            <div className="form-group">
              <label>Negative Marks (Wrong Answer)</label>
              <input type="number" min="0" step="0.25" value={form.negativeMarks} onChange={e => setForm({ ...form, negativeMarks: parseFloat(e.target.value) || 0 })} />
              <small className="text-muted">Marks deducted for wrong answer (0 = no penalty)</small>
            </div>
          </div>

          <div className="form-group">
            <label>Explanation (optional)</label>
            <textarea value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })}></textarea>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="button-success" disabled={submitting}>{submitting ? (editId ? 'Updating…' : 'Creating…') : (editId ? 'Update' : 'Create') + ' Question'}</button>
            <button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {bulkUploading && <div className="card"><p>Uploading questions…</p></div>}
      {bulkResult && (
        <div className="card" style={{ marginTop: 8 }}>
          {bulkResult.error ? (
            <div style={{ color: 'var(--danger)' }}>Bulk upload failed: {bulkResult.error}</div>
          ) : (
            <div style={{ color: 'var(--success)' }}>Bulk upload succeeded: created {bulkResult.createdCount || 0} questions.</div>
          )}
        </div>
      )}

      <div className="card">
        {loading && <LoadingSpinner />}
        {!loading && !questions.length && <p className="text-muted text-center">No questions yet. <a href="#0" onClick={() => setShowForm(true)}>Create one</a></p>}
        {!loading && questions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Difficulty</th>
                <th>Marks</th>
                <th>Correct Answer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q._id}>
                  <td>
                    <strong>{q.questionText.substring(0, 60)}...</strong>
                    {q.explanation && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>Explanation: {q.explanation.substring(0, 40)}...</div>}
                  </td>
                  <td><span className="badge badge-info">{q.category}</span></td>
                  <td>
                    <span className={`badge badge-${q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td>{q.marks}</td>
                  <td><strong style={{ color: 'var(--success)' }}>Option {String.fromCharCode(65 + q.correctAnswer)}</strong></td>
                  <td>
                    <button className="button-sm" onClick={() => handleEdit(q)}>Edit</button>
                    <button className="button-sm button-danger" onClick={() => handleDelete(q._id)} style={{ marginLeft: '4px' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
