import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/verificationService';

export default function ForgotPassword() {
  const [email, setEmail]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]     = useState('');
  const [error, setError]         = useState('');

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
    <div style={S.page}>
      {/* left brand strip */}
      <div style={S.leftPanel}>
        <div style={S.leftOverlay} />
        <div style={S.leftContent}>
          <img src="/mit-logo-white.png" alt="MIT-ADT University" style={S.leftLogo} />
          <h1 style={S.leftHeading}>Password<br />Reset</h1>
          <p style={S.leftSub}>We'll send a secure link to your registered email address.</p>
        </div>
      </div>

      {/* right form */}
      <div style={S.rightPanel}>
        <div style={S.formCard}>
          <div style={S.cardHeader}>
            <img src="/mit-logo-white.png" alt="MIT-ADT" style={S.cardLogo} />
            <div>
              <div style={S.cardBrand}>EXAM PORTAL</div>
              <div style={S.cardBrandSub}>MIT-ADT University</div>
            </div>
          </div>
          <div style={S.rainbow} />

          <div style={S.formBody}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔑</div>
            <h2 style={S.formTitle}>Reset Password</h2>
            <p style={S.formSubtitle}>Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              {message && <div style={S.alertSuccess}>{message}</div>}
              {error   && <div style={S.alertDanger}>{error}</div>}

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="forgot-password-email" style={S.label}>EMAIL ADDRESS</label>
                <input
                  id="forgot-password-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={S.input}
                />
              </div>

              <button type="submit" style={S.submitBtn} disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Reset Link →'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link to="/login" style={S.backLink}>← Back to Sign In</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'Outfit', sans-serif",
    background: '#F0EDF8',
  },
  leftPanel: {
    flex: '0 0 42%',
    background: 'linear-gradient(145deg, #4B0082 0%, #6A0DAD 45%, #9B30E0 78%, #C0359E 100%)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '56px 48px',
    overflow: 'hidden',
  },
  leftOverlay: {
    position: 'absolute',
    inset: 0,
    background: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 18px)`,
    pointerEvents: 'none',
  },
  leftContent: { position: 'relative', zIndex: 1 },
  leftLogo: { height: '48px', width: 'auto', display: 'block', marginBottom: '28px', objectFit: 'contain' },
  leftHeading: {
    fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '2.6rem',
    color: '#fff', lineHeight: 1.05, letterSpacing: '0.04em', margin: '0 0 14px',
  },
  leftSub: {
    fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, fontStyle: 'italic',
  },
  rightPanel: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
  },
  formCard: {
    width: '100%', maxWidth: '420px', background: '#fff',
    borderRadius: '20px', boxShadow: '0 8px 32px rgba(75,0,130,0.12)',
    overflow: 'hidden', border: '1px solid #E2D8F0',
  },
  cardHeader: {
    background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 50%, #9B30E0 100%)',
    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px',
  },
  cardLogo: { height: '34px', width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 },
  cardBrand: { fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '14px', color: '#fff', letterSpacing: '0.08em' },
  cardBrandSub: { fontFamily: "'Outfit',sans-serif", fontWeight: 400, fontSize: '10px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' },
  rainbow: { height: '3px', background: 'linear-gradient(90deg, #9B30E0 0%, #C0359E 25%, #E8631A 55%, #F5AB00 100%)' },
  formBody: { padding: '28px 28px 24px' },
  formTitle: {
    fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '1.4rem', color: '#1A1A2E', margin: '0 0 4px',
  },
  formSubtitle: { fontFamily: "'Outfit',sans-serif", fontWeight: 400, fontSize: '0.88rem', color: '#5A5A7A', margin: 0 },
  label: {
    display: 'block', fontFamily: "'Outfit',sans-serif", fontWeight: 700,
    fontSize: '10px', letterSpacing: '0.1em', color: '#5A5A7A', textTransform: 'uppercase', marginBottom: '6px',
  },
  input: {
    width: '100%', padding: '10px 14px', border: '1.5px solid #E2D8F0',
    borderRadius: '8px', fontFamily: "'Outfit',sans-serif", fontSize: '0.92rem',
    color: '#1A1A2E', outline: 'none', background: '#FAFAFE', boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%', padding: '12px',
    background: 'linear-gradient(90deg, #D9601A 0%, #E88A10 100%)',
    color: '#fff', border: 'none', borderRadius: '24px',
    fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '0.92rem',
    letterSpacing: '0.06em', cursor: 'pointer',
  },
  alertDanger: {
    padding: '10px 14px', background: '#fee2e2', borderLeft: '4px solid #E8361A',
    borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', color: '#7f1d1d',
    fontFamily: "'Outfit',sans-serif",
  },
  alertSuccess: {
    padding: '10px 14px', background: '#dcfce7', borderLeft: '4px solid #28A745',
    borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', color: '#166534',
    fontFamily: "'Outfit',sans-serif",
  },
  backLink: {
    color: '#6A0DAD', textDecoration: 'none', fontWeight: 600,
    fontSize: '0.88rem', fontFamily: "'Outfit',sans-serif",
  },
};