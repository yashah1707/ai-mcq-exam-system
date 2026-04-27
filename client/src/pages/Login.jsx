import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { verifyEmailToken } from '../services/verificationService';
import { getHomeRouteForRole } from '../utils/roleRouting';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState(null);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [verifyToken, setVerifyToken]   = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!email || !password)
        return setError('Email, enrollment number, employee ID, or admin ID and password are required');
      const data = await login({ email: email.trim(), password });
      navigate(getHomeRouteForRole(data.user?.role), { replace: true });
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err.message;
      setError(errorMsg);
      if (errorMsg.includes('verify your email')) setShowVerifyToken(true);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setError(null);
    setVerifySuccess('');
    if (!verifyToken.trim())
      return setError('Please enter the verification token from your email');
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
    <div style={S.page}>
      {/* left panel — brand side */}
      <div style={S.leftPanel}>
        <div style={S.leftOverlay} />
        {/* Logo pinned top-left */}
        <img src="/mit-logo-white.png" alt="MIT-ADT University" style={S.leftLogo} />
        {/* Centered content */}
        <div style={S.leftContent}>
          <h1 style={S.leftHeading}>EXAM PORTAL</h1>
          <div style={S.colorBar}>
            <span style={{ background: '#9B30E0', flex: 1, borderRadius: '3px 0 0 3px' }} />
            <span style={{ background: '#E8631A', flex: 1 }} />
            <span style={{ background: '#00A878', flex: 1, borderRadius: '0 3px 3px 0' }} />
          </div>
        </div>
      </div>

      {/* right panel — form side */}
      <div style={S.rightPanel}>
        <div style={S.formCard}>
          {/* Header strip — just SIGN IN */}
          <div style={S.cardHeader}>
            <span style={S.cardSignIn}>SIGN IN</span>
          </div>

          {/* Rainbow accent */}
          <div style={S.rainbow} />

          <div style={S.formBody}>
            
            <p style={S.formSubtitle}>Enter your credentials to access your account</p>

            <form onSubmit={submit} style={{ marginTop: '20px' }}>
              {error && (
                <div style={S.alertDanger}>{error}</div>
              )}
              {verifySuccess && (
                <div style={S.alertSuccess}>{verifySuccess}</div>
              )}

              <div style={S.fieldGroup}>
                <label htmlFor="login-email" style={S.label}>
                  ID / EMAIL
                </label>
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enrollment No, Employee ID, Admin ID or Email"
                  required
                  style={S.input}
                />
              </div>

              <div style={S.fieldGroup}>
                <label htmlFor="login-password" style={S.label}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    style={{ ...S.input, paddingRight: '68px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(c => !c)}
                    style={S.showHideBtn}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', marginTop: '-4px' }}>
                <Link to="/forgot-password" style={S.forgotLink}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" style={S.submitBtn}>
                Sign In →
              </button>
            </form>

            {/* Verify email section */}
            {showVerifyToken && (
              <div style={S.verifyBox}>
                <h3 style={S.verifyTitle}>📧 Verify Your Email</h3>
                <p style={S.verifyText}>
                  Find the verification token in your email and paste it below.
                </p>
                <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#999', fontFamily: 'monospace', background: '#fff', padding: '6px 8px', borderRadius: '6px', wordBreak: 'break-all' }}>
                  Example: 98e779feb29a0ac4053cef5882dbcd2e881b...
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#E8361A', fontWeight: 700 }}>
                  ⚠️ Paste ONLY the token code, not the full URL.
                </p>
                <form onSubmit={handleVerifyToken}>
                  <label htmlFor="login-verify-token" style={S.label}>VERIFICATION TOKEN</label>
                  <input
                    id="login-verify-token"
                    type="text"
                    value={verifyToken}
                    onChange={e => setVerifyToken(e.target.value)}
                    placeholder="Paste token here"
                    style={{ ...S.input, fontFamily: 'monospace', marginBottom: '10px' }}
                  />
                  <button type="submit" style={S.submitBtn}>
                    Verify Email ✓
                  </button>
                </form>
              </div>
            )}

            <p style={S.footNote}>
              Accounts are provisioned by your institution administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(255,255,255,0.12)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: '20px', color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginTop: '3px' }}>{label}</div>
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

  /* ── Left brand panel ── */
  leftPanel: {
    flex: '0 0 42%',
    background: 'linear-gradient(145deg, #4B0082 0%, #6A0DAD 40%, #9B30E0 72%, #C0359E 100%)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '48px',
    overflow: 'hidden',
  },
  leftOverlay: {
    position: 'absolute',
    inset: 0,
    background: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 18px)`,
    pointerEvents: 'none',
  },
  leftLogo: {
    position: 'absolute',
    top: '28px',
    left: '36px',
    width: '52%',
    maxWidth: '240px',
    height: 'auto',
    objectFit: 'contain',
    filter: 'drop-shadow(0 2px 12px rgba(255,255,255,0.25))',
    zIndex: 2,
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
  },
  leftHeading: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '3.6rem',
    color: '#fff',
    lineHeight: 1.0,
    letterSpacing: '0.03em',
    margin: '0 0 20px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  colorBar: {
    display: 'flex',
    height: '6px',
    width: '180px',
    gap: '3px',
  },
  leftSub: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.72)',
    marginBottom: '32px',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  statRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  /* ── Right form panel ── */
  rightPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
  },
  formCard: {
    width: '100%',
    maxWidth: '440px',
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(75,0,130,0.12)',
    overflow: 'hidden',
    border: '1px solid #E2D8F0',
  },
  cardHeader: {
    background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 50%, #9B30E0 100%)',
    padding: '18px 28px',
    display: 'flex',
    alignItems: 'center',
  },
  cardSignIn: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '22px',
    color: '#fff',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  rainbow: {
    height: '3px',
    background: 'linear-gradient(90deg, #9B30E0 0%, #C0359E 25%, #E8631A 55%, #F5AB00 100%)',
  },
  formBody: {
    padding: '28px 28px 24px',
  },
  formTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '1.5rem',
    color: '#1A1A2E',
    margin: '0 0 4px',
  },
  formSubtitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
    fontSize: '0.88rem',
    color: '#5A5A7A',
    margin: 0,
  },
  fieldGroup: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.1em',
    color: '#5A5A7A',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #E2D8F0',
    borderRadius: '8px',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '0.92rem',
    color: '#1A1A2E',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#FAFAFE',
    boxSizing: 'border-box',
  },
  showHideBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    border: 0,
    background: 'transparent',
    color: '#6A0DAD',
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: 0,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.06em',
  },
  forgotLink: {
    color: '#6A0DAD',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(90deg, #D9601A 0%, #E88A10 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '24px',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '0.95rem',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.2s',
  },
  alertDanger: {
    padding: '10px 14px',
    background: '#fee2e2',
    borderLeft: '4px solid #E8361A',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '0.85rem',
    color: '#7f1d1d',
    fontFamily: "'Outfit', sans-serif",
  },
  alertSuccess: {
    padding: '10px 14px',
    background: '#dcfce7',
    borderLeft: '4px solid #28A745',
    borderRadius: '8px',
    marginBottom: '14px',
    fontSize: '0.85rem',
    color: '#166534',
    fontFamily: "'Outfit', sans-serif",
  },
  verifyBox: {
    marginTop: '20px',
    padding: '16px',
    background: '#F0EDF8',
    borderRadius: '12px',
    border: '1px solid #E2D8F0',
  },
  verifyTitle: {
    margin: '0 0 10px',
    fontSize: '0.95rem',
    color: '#4B0082',
    fontWeight: 800,
    fontFamily: "'Outfit', sans-serif",
  },
  verifyText: {
    margin: '0 0 8px',
    fontSize: '0.82rem',
    color: '#5A5A7A',
    fontFamily: "'Outfit', sans-serif",
  },
  footNote: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '0.78rem',
    color: '#9B9BB8',
    fontFamily: "'Outfit', sans-serif",
  },
};
