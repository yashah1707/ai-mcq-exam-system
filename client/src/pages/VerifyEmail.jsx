import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        const verifyEmail = async () => {
            const token = searchParams.get('token');

            if (!token) {
                setStatus('error');
                setMessage('Invalid verification link. No token provided.');
                return;
            }

            try {
                const response = await axios.get(`http://localhost:5000/api/verification/verify-email?token=${token}`);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');

                // Redirect to login after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Failed to verify email. The link may be invalid or expired.');
            }
        };

        verifyEmail();
    }, [searchParams, navigate]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
            <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                <div style={{ marginBottom: '24px' }}>
                    {status === 'verifying' && (
                        <>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>Verifying Email</h2>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--success)' }}>Email Verified!</h2>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--danger)' }}>Verification Failed</h2>
                        </>
                    )}
                </div>

                <p className="text-muted" style={{ marginBottom: '24px', fontSize: '1rem' }}>
                    {message}
                </p>

                {status === 'success' && (
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                        Redirecting to login page in 3 seconds...
                    </p>
                )}

                {status === 'error' && (
                    <div style={{ marginTop: '24px' }}>
                        <a href="/login" className="button-lg" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            Go to Login
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
