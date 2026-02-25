import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
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
          <a href="/admin/users"><button>Manage Users</button></a>
          <a href="/admin/questions" style={{ marginLeft: 8 }}><button>Manage Questions</button></a>
          <a href="/admin/exams" style={{ marginLeft: 8 }}><button>Manage Exams</button></a>
          <a href="/admin/analytics" style={{ marginLeft: 8 }}><button style={{ backgroundColor: '#6366f1' }}>Batch Analytics 📊</button></a>
          <a href="/admin/reports" style={{ marginLeft: 8 }}><button>View Reports</button></a>
        </div>
      </div>
    </div>
  );
}
