import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create the Authentication Context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Authentication Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get('/api/users/me');
        setCurrentUser(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to load user', err);
        setError('Session expired. Please login again.');
        logout();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  // Login function
  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post('/api/token', formData);
      
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // Fetch user info
      const userResponse = await axios.get('/api/users/me');
      setCurrentUser(userResponse.data);
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setError(null);
  };

  // Register function
  const register = async (username, email, password) => {
    try {
      setLoading(true);
      setError(null);

      await axios.post('/api/users/register', {
        username,
        email,
        password
      });

      // Auto login after successful registration
      return await login(username, password);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Context values
  const value = {
    currentUser,
    token,
    loading,
    error,
    login,
    logout,
    register,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 