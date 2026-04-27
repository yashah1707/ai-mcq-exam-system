import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../services/profileService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  const profileIdentifierLabel = authUser?.role === 'admin'
    ? 'Admin ID'
    : authUser?.role === 'teacher'
      ? 'Employee ID'
      : 'Enrollment Number';

  const profileIdentifierValue = authUser?.role === 'admin'
    ? (authUser?.adminId || '')
    : authUser?.role === 'teacher'
      ? (authUser?.employeeId || authUser?.enrollmentNo || '')
      : (authUser?.enrollmentNo || '');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await getProfile();
      const user = res.user;
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      });
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setUpdating(true);

    try {
      const res = await updateProfile(profileForm);
      setMessage(res.message || 'Profile updated successfully');
      if (res.user) {
        setUser(res.user);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>My Profile</h2>
          <p style={styles.pageSubtitle}>Update your personal and contact details.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => navigate('/profile/password')}>
          Change Password
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Profile Information</h3>
        <form onSubmit={handleUpdateProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="profile-first-name">First Name</label>
              <input
                id="profile-first-name"
                type="text"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-last-name">Last Name</label>
              <input
                id="profile-last-name"
                type="text"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>Changing your email will require re-verification</small>
          </div>

          <div className="form-group">
            <label htmlFor="profile-enrollment">{profileIdentifierLabel}</label>
            <input
              id="profile-enrollment"
              type="text"
              value={profileIdentifierValue}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-role">Role</label>
            <input
              id="profile-role"
              type="text"
              value={authUser?.role || ''}
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed', textTransform: 'capitalize' }}
            />
          </div>

          <button type="submit" className="button-success" disabled={updating}>
            {updating ? 'Updating...' : 'Update Profile'}
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