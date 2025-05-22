import axios from 'axios';

// Create a custom axios instance for API requests
const api = axios.create({
  baseURL: '',  // Use relative URLs instead of direct connection to backend
  timeout: 60000, // 60 seconds - increased from 30s to handle heatmap generation
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
    return response;
  }, 
  (error) => {
    if (error.response) {
      console.error(`[API] Error ${error.response.status} from ${error.config.url}:`, error.response.data);
      
      // Handle authentication errors
      if (error.response.status === 401) {
        console.error('[API] Authentication error - redirecting to login');
        // Clear token on auth error
        localStorage.removeItem('token');
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      // Handle server errors
      if (error.response.status >= 500) {
        console.error('[API] Server error:', error.response.data);
      }
    } else if (error.request) {
      console.error('[API] No response received:', error.request);
    } else {
      console.error('[API] Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper method for authentication
api.auth = {
  login: async (username, password) => {
    console.log('[Auth] Sending login request with username:', username);
    
    // OAuth2 password flow requires x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    
    return api.post('/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  },
  
  me: () => api.get('/api/users/me'),
  
  register: (userData) => api.post('/api/register', userData)
};

export default api; 