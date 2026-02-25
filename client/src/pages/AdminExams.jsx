import React, { useState, useEffect } from 'react';
import { fetchExams, createExam, updateExam, deleteExam } from '../services/examService';
import { fetchQuestions } from '../services/questionService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionFilter, setQuestionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: '',
    subject: 'Mixed',
    description: '',
    duration: 60,
    totalMarks: 100,
    passingMarks: 40,
    questions: [],
    startDate: '',
    endDate: '',
    isActive: true,
    enableNegativeMarking: false
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const exRes = await fetchExams();
      setExams(exRes.exams || []);
      const qRes = await fetchQuestions();
      setQuestions(qRes.questions || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    // Client-side validation
    if (!form.title || form.title.trim().length < 3) return setError('Title is required (min 3 chars)');
    if (!form.questions || form.questions.length === 0) return setError('Please select at least one question');
    if (!form.startDate || !form.endDate) return setError('Start and end date/time are required');
    if (new Date(form.startDate) >= new Date(form.endDate)) return setError('End date/time must be after start date/time');

    // compute total marks from selected questions and sync
    try {
      const selectedMarks = form.questions.reduce((sum, qid) => {
        const q = questions.find(x => x._id === qid);
        return sum + (q?.marks || 0);
      }, 0);
      if (selectedMarks !== form.totalMarks) {
        form.totalMarks = selectedMarks;
      }
    } catch (e) { }

    setSubmitting(true);
    try {
      if (editId) {
        await updateExam(editId, form);
      } else {
        await createExam(form);
      }
      setForm({ title: '', subject: 'Mixed', description: '', duration: 60, totalMarks: 100, passingMarks: 40, questions: [], startDate: '', endDate: '', isActive: true, enableNegativeMarking: false });
      setEditId(null);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this exam?')) {
      try {
        await deleteExam(id);
        await loadData();
      } catch (err) {
        alert(err?.response?.data?.message || err.message);
      }
    }
  };

  const handleEdit = (ex) => {
    setForm({
      title: ex.title,
      subject: ex.subject || 'Mixed',
      description: ex.description,
      duration: ex.duration,
      totalMarks: ex.totalMarks,
      passingMarks: ex.passingMarks,
      questions: ex.questions.map(q => typeof q === 'string' ? q : q._id),
      startDate: ex.startDate.split('T')[0],
      endDate: ex.endDate.split('T')[0],
      isActive: ex.isActive,
      enableNegativeMarking: ex.enableNegativeMarking || false
    });
    setEditId(ex._id);
    setShowForm(true);
  };

  const selectAllVisible = () => {
    const visible = questions.filter(q => q.questionText.toLowerCase().includes(questionFilter.toLowerCase())).map(q => q._id);
    setForm({ ...form, questions: Array.from(new Set([...(form.questions || []), ...visible])) });
  };

  const clearSelection = () => {
    setForm({ ...form, questions: [] });
  };

  const toggleQuestionSelect = (qId) => {
    setForm({
      ...form,
      questions: form.questions.includes(qId)
        ? form.questions.filter(id => id !== qId)
        : [...form.questions, qId]
    });
  };

  const computeSelectedMarks = () => {
    try {
      return form.questions.reduce((sum, qid) => {
        const q = questions.find(x => x._id === qid);
        return sum + (q?.marks || 0);
      }, 0);
    } catch (e) { return 0; }
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>Manage Exams</h2>
        <button onClick={() => {
          setShowForm(!showForm);
          setEditId(null);
          if (!showForm) {
            const now = new Date();
            const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const fmt = (d) => d.toISOString().slice(0, 16);
            setForm({ title: '', subject: 'Mixed', description: '', duration: 60, totalMarks: 100, passingMarks: 40, questions: [], startDate: fmt(now), endDate: fmt(inSevenDays), isActive: true, enableNegativeMarking: false });
          } else {
            setForm({ title: '', subject: 'Mixed', description: '', duration: 60, totalMarks: 100, passingMarks: 40, questions: [], startDate: '', endDate: '', isActive: true, enableNegativeMarking: false });
          }
        }}>
          {showForm ? 'Cancel' : 'Create Exam'}
        </button>
      </div>

      {error && <div className="card" style={{ color: 'red' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3>{editId ? 'Edit' : 'Create'} Exam</h3>
          <label>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />

          <label style={{ marginTop: 8 }}>Subject</label>
          <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <option value="Mixed">Mixed (Multiple Subjects)</option>
            <option value="DSA">DSA (Data Structures & Algorithms)</option>
            <option value="DBMS">DBMS (Database Management Systems)</option>
            <option value="OS">OS (Operating Systems)</option>
            <option value="CN">CN (Computer Networks)</option>
            <option value="Aptitude">Aptitude</option>
            <option value="Reasoning">Reasoning</option>
            <option value="English">English</option>
          </select>

          <label style={{ marginTop: 8 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: '60px' }}></textarea>

          <label style={{ marginTop: 8 }}>Duration (minutes)</label>
          <input type="number" min="1" value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} />

          <label style={{ marginTop: 8 }}>Total Marks</label>
          <input type="number" min="1" value={form.totalMarks} onChange={e => setForm({ ...form, totalMarks: parseInt(e.target.value) })} readOnly />
          <div className="small" style={{ color: '#666', marginTop: 6 }}>Computed from selected questions: <strong>{computeSelectedMarks()}</strong></div>

          <label style={{ marginTop: 8 }}>Passing Marks</label>
          <input type="number" min="0" value={form.passingMarks} onChange={e => setForm({ ...form, passingMarks: parseInt(e.target.value) })} />

          <label style={{ marginTop: 8 }}>Start Date & Time</label>
          <input type="datetime-local" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />

          <label style={{ marginTop: 8 }}>End Date & Time</label>
          <input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />

          <label style={{ marginTop: 8 }}>Questions</label>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search questions..." value={questionFilter} onChange={e => setQuestionFilter(e.target.value)} />
            <button type="button" onClick={selectAllVisible}>Select Visible</button>
            <button type="button" onClick={clearSelection}>Clear Selection</button>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
            {questions.filter(q => q.questionText.toLowerCase().includes(questionFilter.toLowerCase())).map(q => (
              <div key={q._id} style={{ marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  id={q._id}
                  checked={form.questions.includes(q._id)}
                  onChange={() => toggleQuestionSelect(q._id)}
                />
                <label htmlFor={q._id} style={{ marginLeft: '6px', cursor: 'pointer' }} className="small">
                  {q.questionText.substring(0, 60)}...
                </label>
              </div>
            ))}
          </div>

          <label style={{ marginTop: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <span style={{ marginLeft: '6px' }}>Active</span>
          </label>

          <label style={{ marginTop: 8 }}>
            <input type="checkbox" checked={form.enableNegativeMarking} onChange={e => setForm({ ...form, enableNegativeMarking: e.target.checked })} />
            <span style={{ marginLeft: '6px' }}>Enable Negative Marking</span>
          </label>
          {form.enableNegativeMarking && (
            <div className="alert" style={{ marginTop: 8, padding: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              ⚠️ <strong>Warning:</strong> Students can get negative total scores if they answer many questions incorrectly.
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={submitting}>{submitting ? (editId ? 'Updating…' : 'Creating…') : (editId ? 'Update' : 'Create') + ' Exam'}</button>
          </div>
        </form>
      )}

      <div className="card">
        {loading && <LoadingSpinner />}
        {!loading && !exams.length && <p className="text-muted text-center">No exams yet. <a href="#0" onClick={() => setShowForm(true)}>Create one</a></p>}
        {!loading && exams.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Marks</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map(ex => (
                <tr key={ex._id}>
                  <td>
                    <strong>{ex.title}</strong>
                    {ex.description && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{ex.description.substring(0, 50)}...</div>}
                  </td>
                  <td>{ex.duration} min</td>
                  <td>{ex.totalMarks} <span className="text-small" style={{ color: 'var(--text-muted)' }}>/{ex.passingMarks}</span></td>
                  <td>{ex.questions.length}</td>
                  <td>
                    <span className={`badge ${ex.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {ex.isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="button-sm" onClick={() => handleEdit(ex)}>Edit</button>
                    <button className="button-sm button-danger" onClick={() => handleDelete(ex._id)} style={{ marginLeft: '4px' }}>Delete</button>
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
