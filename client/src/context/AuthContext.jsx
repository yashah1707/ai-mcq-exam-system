import React, { createContext, useEffect, useRef, useState } from 'react';
import { login as loginApi, logout as logoutApi, me as meApi } from '../services/authService';
import { requestNavigation, showToast } from '../utils/appEvents';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [authReady, setAuthReady] = useState(false);

  const clearSession = () => {
    setUser(null);
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (e) {
      // ignore storage cleanup errors
    }
  };

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const response = await meApi();
        if (isMounted) {
          setUser(response.user || null);
        }
      } catch (error) {
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    };

    bootstrapSession();

    const onGlobalLogout = (event) => {
      clearSession();
      setAuthReady(true);
      requestNavigation(event?.detail?.to || '/login', { replace: event?.detail?.replace ?? true, state: event?.detail?.state });
    };
    window.addEventListener('app:logout', onGlobalLogout);

    return () => {
      isMounted = false;
      window.removeEventListener('app:logout', onGlobalLogout);
    };
  }, []);

  const login = async (credentials) => {
    const data = await loginApi(credentials);
    setUser(data.user);
    // Persist the JWT so api.js can attach it after page refresh
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    setAuthReady(true);
    return data;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      // Ignore logout transport issues and clear local session anyway.
    }
    clearSession();
    showToast('You have been logged out.', { type: 'info' });
    requestNavigation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout, setUser }}>
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
