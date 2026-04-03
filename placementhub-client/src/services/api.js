// src/services/api.js
import axios from 'axios';

const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const formattedBaseURL = base.endsWith('/') ? `${base}api` : `${base}/api`;

const api = axios.create({
    baseURL: formattedBaseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach the token to every request
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

// Response Interceptor: Handle 401 Unauthorized (Blacklisted or Kicked out)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token is dead. Wipe memory and force a redirect to login.
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Only redirect if we aren't already on the login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'; 
            }
        }
        return Promise.reject(error);
    }
);

export default api;