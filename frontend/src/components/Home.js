import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Welcome to HeatGaze</h1>
        <p>Track eye movements and generate heatmaps for better user experience analysis</p>
        <div className="home-buttons">
          <Link to="/login" className="home-button">
            Login
          </Link>
          <Link to="/register" className="home-button highlight">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 