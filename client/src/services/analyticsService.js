import axios from 'axios';

const API_URL = 'http://localhost:5000/api/analytics';

// Get token from local storage
const getToken = () => localStorage.getItem('token');

const AnalyticsService = {
    // Get overall student analytics
    getStudentAnalytics: async (userId) => {
        const response = await axios.get(`${API_URL}/student/${userId}`, {
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        return response.data;
    },

    // Get weak topics
    async getWeakTopics(userId) {
        try {
            const response = await axios.get(`${API_URL}/student/${userId}/weak-topics`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async getPlacementReadiness(userId) {
        try {
            const response = await axios.get(`${API_URL}/student/${userId}/readiness`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async getAIInsights(userId) {
        try {
            const response = await axios.get(`${API_URL}/student/${userId}/ai-insights`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async getSubjectProficiency(userId) {
        try {
            const response = await axios.get(`${API_URL}/student/${userId}/subject-proficiency`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async getStudentReportOverall(userId, filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            const query = params.toString();
            const response = await axios.get(`${API_URL}/student/${userId}/report/overall${query ? `?${query}` : ''}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async getStudentSubjectHistory(userId, subject, filters = {}) {
        try {
            const params = new URLSearchParams();
            if (subject) params.append('subject', subject);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            const response = await axios.get(`${API_URL}/student/${userId}/report/subject-history?${params.toString()}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};

export default AnalyticsService;
