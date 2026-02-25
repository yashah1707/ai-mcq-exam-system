import React, { createContext, useEffect, useRef, useState } from 'react';
import { login as loginApi, register as registerApi } from '../services/authService';
import api from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  // Auto-logout when token expires and listen for global logout events
  const logoutTimerRef = useRef(null);

  const parseJwt = (tkn) => {
    try {
      const payload = tkn.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    // Cleanup previous timer
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }

    if (!token) return;

    const payload = parseJwt(token);
    if (!payload || !payload.exp) return;

    const expiresAt = payload.exp * 1000; // exp is in seconds
    const now = Date.now();
    const msLeft = expiresAt - now;

    if (msLeft <= 0) {
      // Token already expired
      setUser(null);
      setToken(null);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'warning', message: 'Session expired. Please sign in again.' } }));
      return;
    }

    // Schedule logout a few seconds after expiry
    logoutTimerRef.current = setTimeout(() => {
      setUser(null);
      setToken(null);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'warning', message: 'Session expired. Please sign in again.' } }));
      window.location.href = '/login';
    }, msLeft + 1000);

    // Listen for global logout events (e.g., api interceptor)
    const onGlobalLogout = () => {
      setUser(null);
      setToken(null);
      window.location.href = '/login';
    };
    window.addEventListener('app:logout', onGlobalLogout);

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      window.removeEventListener('app:logout', onGlobalLogout);
    };
  }, [token]);

  const login = async (credentials) => {
    const data = await loginApi(credentials);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const register = async (payload) => {
    const data = await registerApi(payload);
    // Only set user and token if token exists (verified users like admins)
    // Unverified students won't get a token until they verify email
    if (data.token) {
      setUser(data.user);
      setToken(data.token);
    }
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    try {
      // Also clear local storage and notify other tabs
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('app:logout'));
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'info', message: 'You have been logged out.' } }));
    } catch (e) { }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
