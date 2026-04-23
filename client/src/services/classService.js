import api from './api';

export const fetchClasses = () => api.get('/classes').then((response) => response.data);
export const bulkCreateClasses = (payload) => api.post('/classes/bulk', payload).then((response) => response.data);
export const createClass = (payload) => api.post('/classes', payload).then((response) => response.data);
export const promoteClasses = (classIds) => api.post('/classes/promote', { classIds }).then((response) => response.data);
export const updateClass = (classId, payload) => api.put(`/classes/${classId}`, payload).then((response) => response.data);
export const deleteClass = (classId) => api.delete(`/classes/${classId}`).then((response) => response.data);
export const assignStudentsToClass = (classId, studentIds) => api.post(`/classes/${classId}/assign-students`, { studentIds }).then((response) => response.data);
export const bulkAssignStudentsToClass = (classId, payload) => api.post(`/classes/${classId}/bulk-assign-students`, payload).then((response) => response.data);
export const removeStudentsFromClass = (classId, studentIds) => api.post(`/classes/${classId}/remove-students`, { studentIds }).then((response) => response.data);
export const createLabBatch = (classId, payload) => api.post(`/classes/${classId}/lab-batches`, payload).then((response) => response.data);
export const updateLabBatch = (classId, labBatchId, payload) => api.put(`/classes/${classId}/lab-batches/${labBatchId}`, payload).then((response) => response.data);
export const deleteLabBatch = (classId, labBatchId) => api.delete(`/classes/${classId}/lab-batches/${labBatchId}`).then((response) => response.data);
export const assignLabBatch = (classId, payload) => api.post(`/classes/${classId}/assign-lab-batch`, payload).then((response) => response.data);