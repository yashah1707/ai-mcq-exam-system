import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Show admin option only if Vite env allows it
  const allowAdmin = import.meta.env.VITE_ALLOW_ADMIN_REGISTRATION === 'true';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError('First name is required');
    if (!lastName.trim()) return setError('Last name is required');
    if (!validateEmail(email)) return setError('Please enter a valid email address');
    if (!validatePassword(password)) return setError('Password must contain at least 8 characters, including uppercase, lowercase, number, and special character');
    setSubmitting(true);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      const response = await register({ name, email, password, role, enrollmentNo: enrollmentNo.trim() });

      // If token is returned (admin registration), go to dashboard
      // If no token (student registration), show success message and redirect to login
      if (response.token) {
        navigate(response.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true });
      } else {
        // Student registration - needs email verification
        alert(response.message || 'Registration successful! Please check your email to verify your account before logging in.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setSubmitting(false);
    }
  };

  const validateEmail = (em) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  };

  const validatePassword = (pwd) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const isLongEnough = pwd.length >= 8;
    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && isLongEnough;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem' }}>📝</h1>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>AI MCQ Exam</h2>
          <p className="text-muted" style={{ marginTop: '8px' }}>Create a new account</p>
        </div>

        <form onSubmit={submit}>
          {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

          <div className="form-group">
            <label>First Name</label>
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="e.g., John"
              required
            />
          </div>

          <div className="form-group">
            <label>Last Name</label>
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g., Doe"
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g., you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Enrollment Number</label>
            <input
              value={enrollmentNo}
              onChange={e => setEnrollmentNo(e.target.value)}
              placeholder="e.g., CS2024001 or ENG123"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <div className="text-muted" style={{ marginTop: 6, fontSize: '0.875rem', lineHeight: '1.4' }}>
              Password must contain:
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                <li>At least 8 characters</li>
                <li>One uppercase letter (A-Z)</li>
                <li>One lowercase letter (a-z)</li>
                <li>One number (0-9)</li>
                <li>One special character (!@#$%^&*)</li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label>Account Type</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="student">Student</option>
              {allowAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          <button type="submit" className="button-lg" style={{ width: '100%', marginTop: '8px' }} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Account →'}
          </button>
        </form>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p className="text-small" style={{ margin: 0 }}>Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Sign in here</Link></p>
        </div>
      </div>
    </div>
  );
}
