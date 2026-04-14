import React, { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { createSubject, deleteSubject, fetchSubjects, updateSubject } from '../services/subjectService';
import { showToast } from '../utils/appEvents';

const YEAR_OPTIONS = [1, 2, 3, 4];
const SUBJECT_CODE_PATTERN = /^[A-Z0-9]+$/;
const EMPTY_SUBJECT_FORM = {
  code: '',
  name: '',
  year: 1,
  course: 'GENERAL',
  description: '',
};

const formatYearLabel = (year) => {
  if (year === 1) return 'First Year';
  if (year === 2) return 'Second Year';
  if (year === 3) return 'Third Year';
  if (year === 4) return 'Final Year';
  return `Year ${year}`;
};

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(EMPTY_SUBJECT_FORM);
  const [editId, setEditId] = useState(null);
  const [selectedCatalogYear, setSelectedCatalogYear] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSubjects({ includeInactive: true });
      setSubjects(response.subjects || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const groupedSubjects = useMemo(() => {
    const courseMap = new Map();

    subjects.forEach((subject) => {
      const courseKey = subject.course || 'GENERAL';
      if (!courseMap.has(courseKey)) {
        courseMap.set(courseKey, new Map());
      }

      const yearMap = courseMap.get(courseKey);
      if (!yearMap.has(subject.year)) {
        yearMap.set(subject.year, []);
      }

      yearMap.get(subject.year).push(subject);
    });

    return Array.from(courseMap.entries())
      .map(([course, yearMap]) => ({
        course,
        years: YEAR_OPTIONS.map((year) => ({
          year,
          subjects: (yearMap.get(year) || []).sort((left, right) => left.code.localeCompare(right.code)),
        })),
      }))
      .sort((left, right) => left.course.localeCompare(right.course));
  }, [subjects]);

  const visibleGroupedSubjects = useMemo(
    () => groupedSubjects
      .map((group) => ({
        course: group.course,
        year: selectedCatalogYear,
        subjects: group.years.find((yearBucket) => yearBucket.year === selectedCatalogYear)?.subjects || [],
      }))
      .filter((group) => group.subjects.length > 0),
    [groupedSubjects, selectedCatalogYear]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        code: form.code,
        name: form.name,
        year: Number(form.year),
        course: form.course,
        description: form.description,
      };

      if (!SUBJECT_CODE_PATTERN.test(payload.code)) {
        throw new Error('Subject code must be alphanumeric only');
      }

      const response = editId
        ? await updateSubject(editId, payload)
        : await createSubject(payload);

      showToast(response.message || (editId ? 'Subject updated successfully.' : 'Subject created successfully.'), { type: 'success' });
      setForm(EMPTY_SUBJECT_FORM);
      setEditId(null);
      await loadSubjects();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (subject) => {
    setEditId(subject._id);
    setForm({
      code: subject.code || '',
      name: subject.name || '',
      year: Number(subject.year) || 1,
      course: subject.course || 'GENERAL',
      description: subject.description || '',
    });
  };

  const handleDelete = async (subject) => {
    if (!window.confirm(`Delete ${subject.code} from ${subject.course} ${formatYearLabel(subject.year)}?`)) {
      return;
    }

    try {
      const response = await deleteSubject(subject._id);
      showToast(response.message || 'Subject deleted successfully.', { type: 'success' });
      if (editId === subject._id) {
        setEditId(null);
        setForm(EMPTY_SUBJECT_FORM);
      }
      await loadSubjects();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    }
  };

  const handleToggleActive = async (subject) => {
    try {
      const response = await updateSubject(subject._id, { isActive: !subject.isActive });
      showToast(response.message || `Subject ${subject.isActive ? 'disabled' : 'enabled'} successfully.`, { type: 'success' });
      await loadSubjects();
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      setError(message);
      showToast(message, { type: 'error' });
    }
  };

  return (
    <div className="container">
      <div className="nav">
        <h2>Manage Subjects</h2>
        <div className="small">Create and maintain course-wise, year-wise subject catalogs. Use GENERAL for subjects shared across all courses.</div>
      </div>

      {error && <div className="card" style={{ color: '#dc2626' }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{editId ? 'Edit Subject' : 'Add Subject'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Subject Code</label>
              <input
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                placeholder="e.g., DBMS101"
                pattern="[A-Z0-9]+"
                title="Subject code must use letters and numbers only"
                required
              />
              <div className="small">Letters and numbers only. No spaces or symbols.</div>
            </div>
            <div className="form-group">
              <label>Subject Name</label>
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g., Database Management Systems" required />
            </div>
            <div className="form-group">
              <label>Year</label>
              <select value={form.year} onChange={(event) => setForm((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                {YEAR_OPTIONS.map((year) => <option key={year} value={year}>{formatYearLabel(year)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Course</label>
              <input value={form.course} onChange={(event) => setForm((prev) => ({ ...prev, course: event.target.value.toUpperCase() }))} placeholder="e.g., GENERAL or CSE" required />
              <div className="small">Use GENERAL for common subjects. Use values like CSE, IT, or ECE for branch-specific subjects.</div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional note about when this subject applies" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            {editId && <button type="button" className="button-secondary" onClick={() => { setEditId(null); setForm(EMPTY_SUBJECT_FORM); }}>Cancel Edit</button>}
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : editId ? 'Save Subject' : 'Create Subject'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        {loading && <LoadingSpinner />}
        {!loading && groupedSubjects.length === 0 && <p className="text-muted text-center">No subjects available yet.</p>}
        {!loading && groupedSubjects.length > 0 && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ display: 'block' }}>Catalog Year View</strong>
                <div className="small">Switch between 1st, 2nd, 3rd, and 4th year instead of showing every year together.</div>
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
                <label>Show Subjects For</label>
                <select value={selectedCatalogYear} onChange={(event) => setSelectedCatalogYear(Number(event.target.value))}>
                  {YEAR_OPTIONS.map((year) => <option key={year} value={year}>{formatYearLabel(year)}</option>)}
                </select>
              </div>
            </div>

            {visibleGroupedSubjects.length === 0 && (
              <div className="small" style={{ color: 'var(--text-muted)' }}>No subjects found for {formatYearLabel(selectedCatalogYear)}.</div>
            )}

            {visibleGroupedSubjects.map((group) => (
              <div key={group.course} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Course: {group.course}</h3>
                  <span className="small">{group.subjects.length} subject entries in {formatYearLabel(group.year)}</span>
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                  {group.subjects.map((subject) => (
                    <div key={subject._id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: subject.isActive ? '#ffffff' : '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <strong>{subject.code}</strong>
                          <div className="small">{subject.name}</div>
                          <div className="small" style={{ marginTop: 4, color: 'var(--text-muted)' }}>{formatYearLabel(group.year)}</div>
                          {subject.description && <div className="small" style={{ marginTop: 4 }}>{subject.description}</div>}
                        </div>
                        <span className={`badge ${subject.isActive ? 'badge-success' : 'badge-warning'}`}>{subject.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button type="button" className="button-secondary" onClick={() => handleEdit(subject)}>Edit</button>
                        <button type="button" className="button-secondary" onClick={() => handleToggleActive(subject)}>{subject.isActive ? 'Disable' : 'Enable'}</button>
                        <button type="button" className="button-secondary" onClick={() => handleDelete(subject)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}