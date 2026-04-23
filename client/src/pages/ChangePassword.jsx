import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/profileService';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      setMessage(res.message || 'Password changed successfully');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="container">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Change Password</h2>
          <p style={styles.pageSubtitle}>Set a new password for your account.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => navigate('/profile')}>
          Edit Profile
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="profile-current-password">Current Password</label>
            <input
              id="profile-current-password"
              type="password"
              value={passwordForm.oldPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-new-password">New Password</label>
            <input
              id="profile-new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="profile-confirm-password">Confirm New Password</label>
            <input
              id="profile-confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="button-warning" disabled={changingPassword}>
            {changingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
  },
  pageSubtitle: {
    margin: '6px 0 0',
    color: '#667085',
  },
};