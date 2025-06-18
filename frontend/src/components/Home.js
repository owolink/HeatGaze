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
        <h1>Добро пожаловать в HeatGaze</h1>
        <p>Отслеживайте движения глаз и генерируйте тепловые карты для лучшего анализа пользовательского опыта</p>
        <div className="home-buttons">
          <Link to="/login" className="home-button">
            Войти
          </Link>
          <Link to="/register" className="home-button highlight">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 