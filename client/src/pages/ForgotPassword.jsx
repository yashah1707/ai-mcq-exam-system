import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/verificationService';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const response = await requestPasswordReset(email.trim());
      setMessage(response.message || 'If the email exists, a password reset link has been sent.');
      setEmail('');
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={pageStyles.wrapper}>
      <div style={pageStyles.overlay} />
      <div className="card" style={pageStyles.card}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔑</div>
          <h2 style={pageStyles.title}>RESET YOUR PASSWORD</h2>
          <p className="text-muted" style={{ marginTop: '8px' }}>
            Enter your email address and we will send you a secure password setup or reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {message && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{message}</div>}
          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

          <div className="form-group">
            <label htmlFor="forgot-password-email">Email</label>
            <input
              id="forgot-password-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              style={{ width: '100%' }}
            />
          </div>

          <button type="submit" className="button-lg" style={pageStyles.submitBtn} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#6A0DAD', textDecoration: 'none', fontWeight: 600 }}>
            Back to Sign In
          </Link>
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
    maxWidth: '440px',
    width: '100%',
    position: 'relative',
    zIndex: 1,
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 20px 40px rgba(75, 0, 130, 0.2)',
    padding: '32px',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
    color: '#1A1A2E',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
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
};