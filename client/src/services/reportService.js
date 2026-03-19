import api from './api';

export const getStudentPerformance = (examId) => {
  const params = new URLSearchParams();
  if (examId) params.append('examId', examId);
  return api.get(`/reports/student-performance?${params.toString()}`).then(r => r.data);
};

export const getExamStatistics = (examId) => {
  const params = new URLSearchParams();
  if (examId) params.append('examId', examId);
  return api.get(`/reports/exam-statistics?${params.toString()}`).then(r => r.data);
};

export const getSubjectStudentsReport = (subject, filters = {}) => {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  return api.get(`/reports/subject-students?${params.toString()}`).then(r => r.data);
};

export const getStudentSubjectHistoryReport = (userId, subject, filters = {}) => {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  return api.get(`/reports/student/${userId}/subject-history?${params.toString()}`).then(r => r.data);
};

export const getStudentOverallReport = (userId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  const query = params.toString();
  return api.get(`/reports/student/${userId}/overall${query ? `?${query}` : ''}`).then(r => r.data);
};
