import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount by hitting the backend.
    // The request interceptor in api.js will attach the stored Bearer token,
    // so this works even when cookies are blocked cross-origin.
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('ntee_token');
        localStorage.removeItem('ntee_user');
      })
      .finally(() => {
        setLoading(false);
      });

    // Handle global session expiration event (fired by api.js interceptor)
    const handleSessionExpired = () => {
      setUser(null);
      localStorage.removeItem('ntee_token');
      localStorage.removeItem('ntee_user');
    };
    window.addEventListener('ntee:session-expired', handleSessionExpired);
    return () => window.removeEventListener('ntee:session-expired', handleSessionExpired);
  }, []);

  /**
   * Called after a successful login/register response.
   * @param {object} userData  - The user object from the API response.
   * @param {string} [token]   - JWT token returned in the response body (optional fallback).
   */
  const login = (userData, token) => {
    if (token) {
      // Store token so the request interceptor can send it as Authorization: Bearer
      // in environments where cross-origin cookies are blocked.
      localStorage.setItem('ntee_token', token);
    }
    localStorage.setItem('ntee_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      localStorage.removeItem('ntee_token');
      localStorage.removeItem('ntee_user');
      setUser(null);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
