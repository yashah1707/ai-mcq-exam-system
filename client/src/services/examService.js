import api from './api';

export const createExam = (payload) => api.post('/exams', payload).then(r => r.data);
export const fetchExams = () => api.get('/exams').then(r => r.data);
export const getExamById = (id) => api.get(`/exams/${id}`).then(r => r.data);
export const updateExam = (id, payload) => api.put(`/exams/${id}`, payload).then(r => r.data);
export const deleteExam = (id) => api.delete(`/exams/${id}`).then(r => r.data);

// Adaptive Test
export const startAdaptiveTest = (subject) => api.post('/adaptive/start', { subject }).then(r => r.data);
export const submitAdaptiveAnswer = (payload) => api.post('/adaptive/submit', payload).then(r => r.data);
export const endAdaptiveTest = (attemptId) => api.post('/adaptive/end', { attemptId }).then(r => r.data);

export const getAttemptAnalysis = (attemptId) => api.get(`/adaptive/attempt/${attemptId}`).then(r => r.data);
