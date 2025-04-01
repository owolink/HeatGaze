import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NavigationProvider } from './context/NavigationContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SessionRecording from './components/SessionRecording';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NavigationProvider>
          <div className="App">
            <Navbar />
            <div className="content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/recording"
                  element={
                    <PrivateRoute>
                      <SessionRecording />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </NavigationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
