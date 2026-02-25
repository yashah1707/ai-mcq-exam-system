import api from './api';

export const createQuestion = (payload) => api.post('/questions', payload).then(r => r.data);
export const fetchQuestions = (category, difficulty) => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (difficulty) params.append('difficulty', difficulty);
  return api.get(`/questions?${params.toString()}`).then(r => r.data);
};
export const getQuestionById = (id) => api.get(`/questions/${id}`).then(r => r.data);
export const updateQuestion = (id, payload) => api.put(`/questions/${id}`, payload).then(r => r.data);
export const deleteQuestion = (id) => api.delete(`/questions/${id}`).then(r => r.data);
export const bulkCreateQuestions = (payload) => api.post('/questions/bulk', payload).then(r => r.data);
