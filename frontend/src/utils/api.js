import axios from 'axios';

// Create a custom axios instance for API requests
const api = axios.create({
  baseURL: 'http://localhost:8000',  // Direct connection to the backend
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add it to the headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // For debugging auth issues, log every request
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    console.log('[API] Headers:', config.headers);
    
    return config;
  },
  (error) => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status}:`, response.config.url);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API] Error ${error.response.status}: ${error.response.config?.url}`);
      console.error('[API] Error Data:', error.response.data);
    } else if (error.request) {
      console.error('[API] No Response Received');
    } else {
      console.error('[API] Error Setting Up Request:', error.message);
    }
    return Promise.reject(error);
  }
);

// Helper method for authentication
api.auth = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    console.log('[Auth] Sending login request');
    
    return api.post('/api/token', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  me: () => api.get('/api/users/me'),
  
  register: (userData) => api.post('/api/register', userData)
};

export default api; 