import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  return (
    <div className="container">
      <div className="nav">
        <h2>Admin Dashboard</h2>
        <div>
          <span className="small">{user?.email}</span>
          <button style={{ marginLeft: 12 }} onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="card">
        <h3>Welcome, {user?.name || 'Admin'}</h3>
        <p className="small">Manage exam system from here.</p>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/admin/users')}>Manage Users</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/questions')}>Manage Questions</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/exams')}>Manage Exams</button>
          <button style={{ marginLeft: 8, backgroundColor: '#6366f1' }} onClick={() => navigate('/admin/analytics')}>Batch Analytics 📊</button>
          <button style={{ marginLeft: 8 }} onClick={() => navigate('/admin/reports')}>View Reports</button>
        </div>
      </div>
    </div>
  );
}
