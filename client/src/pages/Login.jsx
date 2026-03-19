import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!email || !password) return setError('Email/Enrollment number and password are required');
      const data = await login({ email: email.trim(), password });

      // Redirect based on role
      if (data.user?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err.message;
      setError(errorMsg);

      // If error is about email verification, show token input
      if (errorMsg.includes('verify your email')) {
        setShowVerifyToken(true);
      }
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setError(null);
    setVerifySuccess('');

    if (!verifyToken.trim()) {
      return setError('Please enter the verification token from your email');
    }

    try {
      const response = await axios.get(`http://localhost:5000/api/verification/verify-email?token=${verifyToken.trim()}`);
      setVerifySuccess(response.data.message || 'Email verified successfully! You can now login.');
      setShowVerifyToken(false);
      setVerifyToken('');
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid or expired verification token');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>📝</h1>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>AI MCQ Exam</h2>
          <p className="text-muted" style={{ marginTop: '8px' }}>Sign in to continue</p>
        </div>

        <form onSubmit={submit}>
          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}
          {verifySuccess && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{verifySuccess}</div>}

          <div className="form-group">
            <label>Enrollment Number or Email</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enrollment or email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="button-lg" style={{ width: '100%' }}>
            Sign In →
          </button>
        </form>

        {/* Manual Token Verification Section */}
        {showVerifyToken && (
          <div style={{ marginTop: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#495057' }}>📧 Verify Your Email</h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#6c757d' }}>
              Find the verification token in your email. It looks like this:
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.75rem', color: '#999', fontFamily: 'monospace', background: '#fff', padding: '8px', borderRadius: '4px', wordBreak: 'break-all' }}>
              Example: 98e779feb29a0ac4053cef5882dbcd2e881b...
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#dc3545', fontWeight: '500' }}>
              ⚠️ Copy ONLY the token (the long code after "token=" in the link), NOT the entire URL!
            </p>
            <form onSubmit={handleVerifyToken}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={e => setVerifyToken(e.target.value)}
                  placeholder="Paste token here (long code only)"
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </div>
              <button type="submit" className="button-lg" style={{ width: '100%', fontSize: '0.875rem' }}>
                Verify Email ✓
              </button>
            </form>
          </div>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <span className="text-muted">Don't have an account? </span>
          <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Sign up here</Link>
        </div>
      </div>
    </div>
  );
}
