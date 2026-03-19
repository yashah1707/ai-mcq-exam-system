import React, { useEffect, useRef, useState } from 'react';
import { createQuestion, fetchQuestions, updateQuestion, deleteQuestion, bulkCreateQuestions, uploadQuestionImage, deleteQuestionImage } from '../services/questionService';
import LoadingSpinner from '../components/LoadingSpinner';
import SymbolPicker from '../components/SymbolPicker';

const MIN_OPTIONS = 2;

const createEmptyForm = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  category: 'Aptitude',
  difficulty: 'Easy',
  marks: 1,
  negativeMarks: 0,
  questionImageUrl: '',
  questionImagePublicId: '',
  explanation: ''
});

const getOptionLabel = (index) => {
  let label = '';
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
};

const parseCorrectAnswerValue = (value, optionsLength) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const rawValue = String(value).trim();
  if (/^[A-Z]$/i.test(rawValue)) {
    return rawValue.toUpperCase().charCodeAt(0) - 65;
  }

  const numericValue = Number(rawValue);
  return Number.isInteger(numericValue) ? numericValue : 0;
};

const getOptionOrder = (key) => {
  const trimmedKey = key.trim();
  const optionNumberMatch = trimmedKey.match(/^option(\d+)$/i);
  if (optionNumberMatch) {
    return Number(optionNumberMatch[1]) - 1;
  }

  const optionLetterMatch = trimmedKey.match(/^option([a-z])$/i);
  if (optionLetterMatch) {
    return optionLetterMatch[1].toUpperCase().charCodeAt(0) - 65;
  }

  if (/^[a-z]$/i.test(trimmedKey)) {
    return trimmedKey.toUpperCase().charCodeAt(0) - 65;
  }

  return null;
};

const extractOptionsFromRow = (row) => {
  const optionEntries = Object.entries(row)
    .map(([key, value]) => ({
      order: getOptionOrder(key),
      value: typeof value === 'string' ? value.trim() : String(value ?? '').trim()
    }))
    .filter((entry) => entry.order !== null && entry.value);

  const optionsByOrder = new Map();
  optionEntries.forEach((entry) => {
    if (!optionsByOrder.has(entry.order)) {
      optionsByOrder.set(entry.order, entry.value);
    }
  });

  return [...optionsByOrder.entries()]
    .sort((first, second) => first[0] - second[0])
    .map(([, value]) => value);
};

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const initialImagePublicIdRef = useRef('');
  const questionTextRef = useRef(null);
  const explanationRef = useRef(null);
  const optionRefs = useRef([]);

  const [form, setForm] = useState(createEmptyForm());

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

          const options = extractOptionsFromRow(row);

          if (options.length < MIN_OPTIONS) {
            throw new Error(`Row ${index + 2}: At least ${MIN_OPTIONS} options are required`);
          }

          const correctAnswer = parseCorrectAnswerValue(row.correctAnswer ?? row.correctIndex, options.length);
          if (correctAnswer < 0 || correctAnswer >= options.length) {
            throw new Error(`Row ${index + 2}: Correct answer must be between 0 and ${options.length - 1}`);
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
    if (!form.options || form.options.length < MIN_OPTIONS || form.options.some(o => !o || !o.trim())) return setError(`Provide at least ${MIN_OPTIONS} non-empty options`);
    if (form.correctAnswer < 0 || form.correctAnswer >= form.options.length) return setError('Select a valid correct answer');
    if (!form.marks || form.marks < 1) return setError('Marks must be at least 1');
    if (imageUploading) return setError('Wait for the question image upload to finish.');
    setSubmitting(true);
    try {
      if (editId) {
        await updateQuestion(editId, form);
      } else {
        await createQuestion(form);
      }
      initialImagePublicIdRef.current = '';
      setForm(createEmptyForm());
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
    initialImagePublicIdRef.current = q.questionImagePublicId || '';
    setForm({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks || 0,
      questionImageUrl: q.questionImageUrl || '',
      questionImagePublicId: q.questionImagePublicId || '',
      explanation: q.explanation
    });
    setEditId(q._id);
    setShowForm(true);
  };

  const cleanupTemporaryImage = async (publicId, { silent = false } = {}) => {
    if (!publicId || publicId === initialImagePublicIdRef.current) {
      return true;
    }

    try {
      await deleteQuestionImage(publicId);
      return true;
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || err.message);
      }
      return false;
    }
  };

  const resetForm = async () => {
    const cleanupOk = await cleanupTemporaryImage(form.questionImagePublicId);
    if (!cleanupOk) {
      return;
    }

    setImageUploading(false);
    setShowForm(false);
    setEditId(null);
    initialImagePublicIdRef.current = '';
    setForm(createEmptyForm());
  };

  const handleImageUpload = async (file) => {
    if (!file) {
      return;
    }

    setError(null);
    setImageUploading(true);
    const previousPublicId = form.questionImagePublicId;

    try {
      const uploadedImage = await uploadQuestionImage(file);
      const cleanedPreviousImage = await cleanupTemporaryImage(previousPublicId, { silent: true });
      if (!cleanedPreviousImage && previousPublicId && previousPublicId !== initialImagePublicIdRef.current) {
        setError('The new image was uploaded, but the previous temporary image could not be deleted.');
      }

      setForm((prev) => ({
        ...prev,
        questionImageUrl: uploadedImage.imageUrl,
        questionImagePublicId: uploadedImage.publicId || ''
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const removeImage = async () => {
    const cleanupOk = await cleanupTemporaryImage(form.questionImagePublicId);
    if (!cleanupOk) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      questionImageUrl: '',
      questionImagePublicId: ''
    }));
  };

  const updateOption = (index, value) => {
    const nextOptions = [...form.options];
    nextOptions[index] = value;
    setForm({ ...form, options: nextOptions });
  };

  const insertSymbolIntoField = ({ field, symbol, input, optionIndex }) => {
    let nextCursorPosition = null;

    setForm((prev) => {
      const currentValue = field === 'options'
        ? prev.options[optionIndex] || ''
        : prev[field] || '';
      const selectionStart = input?.selectionStart ?? currentValue.length;
      const selectionEnd = input?.selectionEnd ?? currentValue.length;
      const nextValue = `${currentValue.slice(0, selectionStart)}${symbol}${currentValue.slice(selectionEnd)}`;

      nextCursorPosition = selectionStart + symbol.length;

      if (field === 'options') {
        const nextOptions = [...prev.options];
        nextOptions[optionIndex] = nextValue;

        return {
          ...prev,
          options: nextOptions
        };
      }

      return {
        ...prev,
        [field]: nextValue
      };
    });

    setError(null);

    window.requestAnimationFrame(() => {
      if (!input || nextCursorPosition === null) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const insertSymbolIntoQuestionText = (symbol) => {
    insertSymbolIntoField({
      field: 'questionText',
      symbol,
      input: questionTextRef.current
    });
  };

  const insertSymbolIntoOption = (index, symbol) => {
    insertSymbolIntoField({
      field: 'options',
      symbol,
      input: optionRefs.current[index],
      optionIndex: index
    });
  };

  const insertSymbolIntoExplanation = (symbol) => {
    insertSymbolIntoField({
      field: 'explanation',
      symbol,
      input: explanationRef.current
    });
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, ''] });
  };

  const removeOption = (index) => {
    if (form.options.length <= MIN_OPTIONS) {
      return;
    }

    const nextOptions = form.options.filter((_, optionIndex) => optionIndex !== index);
    let nextCorrectAnswer = form.correctAnswer;

    if (index === form.correctAnswer) {
      nextCorrectAnswer = Math.max(0, Math.min(form.correctAnswer, nextOptions.length - 1));
    } else if (index < form.correctAnswer) {
      nextCorrectAnswer = form.correctAnswer - 1;
    }

    setForm({ ...form, options: nextOptions, correctAnswer: nextCorrectAnswer });
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>Manage Questions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={async () => {
            if (showForm) {
              await resetForm();
              return;
            }

            setShowForm(true);
            setEditId(null);
            initialImagePublicIdRef.current = '';
            setForm(createEmptyForm());
          }}>
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
            <div className="symbol-field symbol-field-full">
              <textarea
                ref={questionTextRef}
                className="symbol-field-control symbol-field-control-textarea"
                value={form.questionText}
                onChange={e => setForm({ ...form, questionText: e.target.value })}
                required
              ></textarea>
              <SymbolPicker inputRef={questionTextRef} onInsert={insertSymbolIntoQuestionText} />
            </div>
          </div>

          <div className="form-group">
            <label>Question Image (optional)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => handleImageUpload(e.target.files[0])} />
            <small className="text-muted">Uploads to Cloudinary. Supported formats: JPG, PNG, WEBP, GIF. Max 5 MB.</small>
            {imageUploading && <div className="text-small" style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Uploading image...</div>}
            {form.questionImageUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={form.questionImageUrl} alt="Question preview" style={{ maxWidth: '240px', width: '100%', borderRadius: '10px', border: '1px solid var(--border)' }} />
                <div style={{ marginTop: '8px' }}>
                  <button type="button" className="button-secondary button-sm" onClick={removeImage} disabled={imageUploading}>Remove Image</button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ marginBottom: 0 }}>Options</label>
              <button type="button" className="button-secondary button-sm" onClick={addOption}>Add Option</button>
            </div>
            <div className="option-editor-grid">
              {form.options.map((option, index) => (
                <div className="form-group" key={`option-${index}`}>
                  <label>Option {getOptionLabel(index)}</label>
                  <div className="option-editor-row">
                    <div className="symbol-field symbol-field-full">
                      <input
                        ref={(element) => {
                          optionRefs.current[index] = element;
                        }}
                        className="symbol-field-control symbol-field-control-input"
                        value={option}
                        onChange={e => updateOption(index, e.target.value)}
                        required
                      />
                      <SymbolPicker inputRef={{ current: optionRefs.current[index] }} onInsert={(symbol) => insertSymbolIntoOption(index, symbol)} />
                    </div>
                    <button
                      type="button"
                      className="button-secondary button-sm"
                      onClick={() => removeOption(index)}
                      disabled={form.options.length <= MIN_OPTIONS}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <small className="text-muted">Add as many options as you need. Minimum {MIN_OPTIONS} options.</small>
          </div>

          <div className="grid">
            <div className="form-group">
              <label>Correct Answer</label>
              <select value={form.correctAnswer} onChange={e => setForm({ ...form, correctAnswer: parseInt(e.target.value) })}>
                {form.options.map((_, index) => (
                  <option key={`correct-${index}`} value={index}>Option {getOptionLabel(index)}</option>
                ))}
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
            <div className="symbol-field symbol-field-full">
              <textarea
                ref={explanationRef}
                className="symbol-field-control symbol-field-control-textarea"
                value={form.explanation}
                onChange={e => setForm({ ...form, explanation: e.target.value })}
              ></textarea>
              <SymbolPicker inputRef={explanationRef} onInsert={insertSymbolIntoExplanation} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="button-success" disabled={submitting || imageUploading}>{submitting ? (editId ? 'Updating…' : 'Creating…') : (editId ? 'Update' : 'Create') + ' Question'}</button>
            <button type="button" className="button-secondary" onClick={resetForm} disabled={imageUploading}>Cancel</button>
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
                    {q.questionImageUrl && <div className="text-small" style={{ marginTop: '4px', color: 'var(--primary)' }}>Image attached</div>}
                    {q.explanation && <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>Explanation: {q.explanation.substring(0, 40)}...</div>}
                    <div className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{q.options.length} options</div>
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
