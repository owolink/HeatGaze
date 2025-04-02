import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api'; // Import our custom axios instance

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

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/users/me');
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
      console.log('Login attempt for:', username);
      setLoading(true);
      setError(null);

      // Use the dedicated auth helper method
      const response = await api.auth.login(username, password);
      
      console.log('Login successful!', response.data);
      
      // Extract the token
      const { access_token } = response.data;
      
      // Save token to localStorage and state
      localStorage.setItem('token', access_token);
      setToken(access_token);
      
      // Fetch user info
      console.log('Fetching user info...');
      const userResponse = await api.auth.me();
      console.log('User info retrieved!');
      setCurrentUser(userResponse.data);
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      
      // More detailed error logging
      if (err.response) {
        console.error('Error response:', err.response.data);
        console.error('Error status:', err.response.status);
        console.error('Error headers:', err.response.headers);
        
        // Extract the error message from the response if available
        const errorMessage = err.response.data?.detail || 'Login failed. Please try again.';
        setError(errorMessage);
      } else if (err.request) {
        // The request was made but no response was received
        console.error('Error request:', err.request);
        setError('No response from the server. Please try again later.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', err.message);
        setError('Failed to connect to the server. Please try again later.');
      }
      
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

      // Use the dedicated auth helper method
      await api.auth.register({ username, email, password });

      // Auto login after successful registration
      return await login(username, password);
    } catch (err) {
      console.error('Registration error:', err);
      
      if (err.response && err.response.data) {
        setError(err.response.data.detail || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
      
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