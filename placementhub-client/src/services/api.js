// src/services/api.js
import axios from 'axios';

// Ensure we handle the URL correctly whether you added a trailing slash or not in .env
const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const api = axios.create({
    baseURL: base,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;