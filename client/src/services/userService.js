import api from './api';

export const createUserAccount = (payload) => api.post('/users', payload).then(r => r.data);
export const bulkCreateUsers = (payload) => api.post('/users/bulk', payload).then(r => r.data);
export const fetchUsers = () => api.get('/users').then(r => r.data);
export const sendUserPasswordLink = (id) => api.post(`/users/${id}/send-password-link`).then(r => r.data);
export const updateUserDetails = (id, payload) => api.put(`/users/${id}`, payload).then(r => r.data);
export const updateRole = (id, role) => api.put(`/users/${id}/role`, { role }).then(r => r.data);
export const toggleStatus = (id) => api.put(`/users/${id}/status`).then(r => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}`).then(r => r.data);
