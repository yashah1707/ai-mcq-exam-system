import api from './api';

export const fetchSubjects = (options = {}) => {
  const params = new URLSearchParams();
  if (options.includeInactive) params.append('includeInactive', 'true');
  if (options.year) params.append('year', String(options.year));
  if (options.course) params.append('course', options.course);
  const query = params.toString();
  return api.get(`/subjects${query ? `?${query}` : ''}`).then((response) => response.data);
};

export const fetchStudentSubjectScope = () => api.get('/subjects/student-scope').then((response) => response.data);
export const createSubject = (payload) => api.post('/subjects', payload).then((response) => response.data);
export const updateSubject = (subjectId, payload) => api.put(`/subjects/${subjectId}`, payload).then((response) => response.data);
export const deleteSubject = (subjectId) => api.delete(`/subjects/${subjectId}`).then((response) => response.data);