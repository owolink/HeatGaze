import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="logo">
          <Link to="/">
            <h1>HeatGaze</h1>
          </Link>
        </div>

        <nav className="main-nav">
          {user ? (
            <>
              <Link to="/dashboard">Панель управления</Link>
              <div className="user-menu">
                <span className="username">{user.username}</span>
                <button className="btn-link" onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            </>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn-link">Вход</Link>
              <Link to="/register" className="btn-primary">Регистрация</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header; 