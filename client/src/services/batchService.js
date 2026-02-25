import api from './api';

export const getBatchOverview = () => api.get('/batch-analytics/overview').then(r => r.data);
export const getSubjectPerformance = () => api.get('/batch-analytics/subject-performance').then(r => r.data);
export const getWeaknessHeatmap = (subject) => api.get('/batch-analytics/weakness-heatmap', { params: { subject } }).then(r => r.data);
export const getReadinessDistribution = () => api.get('/batch-analytics/readiness-distribution').then(r => r.data);
