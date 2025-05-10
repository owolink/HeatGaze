import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SessionRecording from './components/SessionRecording';
import HeatmapViewer from './components/HeatmapViewer';
import Recordings from './components/Recordings';
import RecordingPlayer from './components/RecordingPlayer';
import DataAnalysis from './components/DataAnalysis';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <NavigationProvider>
        <Router>
          <div className="App">
            <Navbar />
            <div className="content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/record" 
                  element={
                    <ProtectedRoute>
                      <SessionRecording />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/heatmap/:id" 
                  element={
                    <ProtectedRoute>
                      <HeatmapViewer />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/recordings" 
                  element={
                    <ProtectedRoute>
                      <Recordings />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/recordings/:id" 
                  element={
                    <ProtectedRoute>
                      <RecordingPlayer />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/recordings/:id/heatmap" 
                  element={
                    <ProtectedRoute>
                      <HeatmapViewer />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/analysis" 
                  element={
                    <ProtectedRoute>
                      <DataAnalysis />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </Router>
      </NavigationProvider>
    </AuthProvider>
  );
}

export default App;
