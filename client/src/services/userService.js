import api from './api';

export const fetchUsers = () => api.get('/users').then(r => r.data);
export const updateRole = (id, role) => api.put(`/users/${id}/role`, { role }).then(r => r.data);
export const toggleStatus = (id) => api.put(`/users/${id}/status`).then(r => r.data);
