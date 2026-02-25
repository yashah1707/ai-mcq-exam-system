import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword } from '../services/profileService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Profile() {
    const { user: authUser, setUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const [profileForm, setProfileForm] = useState({
        name: '',
        email: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await getProfile();
            const user = res.user;
            setProfileForm({
                name: user.name || '',
                email: user.email || ''
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
            // Update auth context
            if (res.user) {
                setUser(res.user);
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        // Validate passwords match
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setChangingPassword(true);
        try {
            const res = await changePassword({
                oldPassword: passwordForm.oldPassword,
                newPassword: passwordForm.newPassword
            });
            setMessage(res.message || 'Password changed successfully');
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setError(err?.response?.data?.message || err.message);
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="container">
            <h2>My Profile</h2>

            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Profile Information Card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginTop: 0 }}>Profile Information</h3>
                <form onSubmit={handleUpdateProfile}>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={profileForm.name}
                            disabled
                            style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            required
                        />
                        <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>Changing your email will require re-verification</small>
                    </div>

                    <div className="form-group">
                        <label>Enrollment Number</label>
                        <input
                            type="text"
                            value={authUser?.enrollmentNo || ''}
                            disabled
                            style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Role</label>
                        <input
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

            {/* Change Password Card */}
            <div className="card">
                <h3 style={{ marginTop: 0 }}>Change Password</h3>
                <form onSubmit={handleChangePassword}>
                    <div className="form-group">
                        <label>Current Password</label>
                        <input
                            type="password"
                            value={passwordForm.oldPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>New Password</label>
                        <input
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
                        <label>Confirm New Password</label>
                        <input
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
