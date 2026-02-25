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
