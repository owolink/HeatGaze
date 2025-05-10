import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { isNavVisible } = useNavigation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isNavVisible) return null;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          HeatGaze
        </Link>

        <div className="navbar-menu">
          {currentUser ? (
            // Authenticated user menu
            <>
              <Link to="/dashboard" className="nav-link">
                Панель управления
              </Link>
              <Link to="/recordings" className="nav-link">
                Записи
              </Link>
              <Link to="/analysis" className="nav-link">
                Анализ данных
              </Link>
              <div className="nav-user">
                <span className="user-name">{currentUser.username}</span>
                <button onClick={handleLogout} className="logout-button">
                  Выйти
                </button>
              </div>
            </>
          ) : (
            // Guest menu
            <>
              <Link to="/login" className="nav-link">
                Вход
              </Link>
              <Link to="/register" className="nav-link highlight">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 