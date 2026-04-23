import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { verifyEmailToken } from '../services/verificationService';
import { getHomeRouteForRole } from '../utils/roleRouting';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!email || !password) return setError('Email, enrollment number, employee ID, or admin ID and password are required');
      const data = await login({ email: email.trim(), password });
      navigate(getHomeRouteForRole(data.user?.role), { replace: true });
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
      const response = await verifyEmailToken(verifyToken.trim());
      setVerifySuccess(response.message || 'Email verified successfully! You can now login.');
      setShowVerifyToken(false);
      setVerifyToken('');
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid or expired verification token');
    }
  };

  return (
    <div style={pageStyles.wrapper}>
      {/* Decorative diagonal stripes overlay */}
      <div style={pageStyles.overlay} />

      <div className="card" style={pageStyles.card}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/mit-logo-white.png"
            alt="MIT-ADT University"
            style={pageStyles.logo}
          />
          <h2 style={pageStyles.title}>MIT-ADT EXAM PORTAL</h2>
          <p style={pageStyles.subtitle}>Sign in to continue</p>
        </div>

        <form onSubmit={submit}>
          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}
          {verifySuccess && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{verifySuccess}</div>}

          <div className="form-group">
            <label htmlFor="login-email">Email, Enrollment Number, Employee ID, or Admin ID</label>
            <input
              id="login-email"
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email, enrollment number, employee ID, or admin ID"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: '72px', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  color: '#6A0DAD',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  padding: 0,
                  fontFamily: "'Outfit', sans-serif",
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="button-lg" style={pageStyles.submitBtn}>
            Sign In →
          </button>
        </form>

        {/* Manual Token Verification Section */}
        {showVerifyToken && (
          <div style={pageStyles.verifySection}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#4B0082', fontWeight: 800 }}>📧 Verify Your Email</h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#5A5A7A' }}>
              Find the verification token in your email. It looks like this:
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.75rem', color: '#999', fontFamily: 'monospace', background: '#fff', padding: '8px', borderRadius: '4px', wordBreak: 'break-all' }}>
              Example: 98e779feb29a0ac4053cef5882dbcd2e881b...
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#E8361A', fontWeight: '700' }}>
              ⚠️ Copy ONLY the token (the long code after "token=" in the link), NOT the entire URL!
            </p>
            <form onSubmit={handleVerifyToken}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label htmlFor="login-verify-token" className="small">Verification Token</label>
                <input
                  id="login-verify-token"
                  type="text"
                  value={verifyToken}
                  onChange={e => setVerifyToken(e.target.value)}
                  placeholder="Paste token here (long code only)"
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem', width: '100%' }}
                />
              </div>
              <button type="submit" className="button-lg" style={pageStyles.submitBtn}>
                Verify Email ✓
              </button>
            </form>
          </div>
        )}
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <Link to="/forgot-password" style={{ color: '#6A0DAD', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            Forgot password?
          </Link>
        </div>
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <span className="text-muted">Accounts are created by your administrator.</span>
        </div>
      </div>
    </div>
  );
}

const pageStyles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #C0359E 0%, #E85A28 55%, #F5AB00 100%)',
    padding: '16px',
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: `repeating-linear-gradient(
      -45deg,
      rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px,
      transparent 1px, transparent 16px
    )`,
    pointerEvents: 'none',
  },
  card: {
    maxWidth: '420px',
    width: '100%',
    position: 'relative',
    zIndex: 1,
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 20px 40px rgba(75, 0, 130, 0.2)',
    padding: '32px',
  },
  logo: {
    height: '56px',
    width: 'auto',
    marginBottom: '12px',
    filter: 'drop-shadow(0 2px 8px rgba(75, 0, 130, 0.25))',
    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
    padding: '8px 12px',
    borderRadius: '10px',
  },
  title: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
    color: '#1A1A2E',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  subtitle: {
    marginTop: '6px',
    color: '#5A5A7A',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
    fontSize: '0.9rem',
  },
  submitBtn: {
    width: '100%',
    background: 'linear-gradient(90deg, #D9601A 0%, #E88A10 100%)',
    border: 'none',
    borderRadius: '24px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '1rem',
    letterSpacing: '0.04em',
  },
  verifySection: {
    marginTop: '24px',
    padding: '16px',
    background: '#F0EDF8',
    borderRadius: '12px',
    border: '1px solid #E2D8F0',
  },
};
