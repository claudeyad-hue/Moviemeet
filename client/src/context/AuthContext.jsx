import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('moviemeet_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('moviemeet_token');
      if (storedToken) {
        try {
          const data = await api.getMe();
          setUser(data.user);
          setToken(storedToken);
        } catch (err) {
          console.warn('Stored token expired or invalid:', err.message);
          localStorage.removeItem('moviemeet_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const loginGuest = async (username) => {
    const data = await api.guestLogin(username);
    localStorage.setItem('moviemeet_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const registerUser = async (credentials) => {
    const data = await api.register(credentials);
    localStorage.setItem('moviemeet_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginUser = async (credentials) => {
    const data = await api.login(credentials);
    localStorage.setItem('moviemeet_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('moviemeet_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        loginGuest,
        registerUser,
        loginUser,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
