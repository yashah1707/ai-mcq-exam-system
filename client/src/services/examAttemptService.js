import api from './api';

export const startExam = (examId) => api.post('/attempts/start', { examId }).then(r => r.data);
export const saveAnswer = (attemptId, questionId, selectedOption) =>
  api.put(`/attempts/${attemptId}/answer`, { questionId, selectedOption }).then(r => r.data);
export const submitExam = (attemptId) => api.post(`/attempts/${attemptId}/submit`).then(r => r.data);
export const getAttempt = (attemptId) => api.get(`/attempts/${attemptId}`).then(r => r.data);
export const getAttemptHistory = () => api.get('/attempts/history/list').then(r => r.data);

// Resilient save with retry/backoff. Returns the same shape as `saveAnswer`.
export const saveAnswerWithRetry = async (attemptId, questionId, selectedOption, opts = {}) => {
  const { retries = 3, baseDelay = 500 } = opts;
  let attempt = 0;
  const key = attemptId;

  while (true) {
    try {
      const res = await saveAnswer(attemptId, questionId, selectedOption);
      return res;
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};
