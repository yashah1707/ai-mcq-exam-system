import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getHomeRouteForRole, isAdminRole, isTeacherRole } from '../utils/roleRouting';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const primaryIdentifier = user?.role === 'admin'
    ? (user.adminId || user.email)
    : user?.role === 'teacher'
      ? (user.employeeId || user.enrollmentNo || user.email)
      : (user?.enrollmentNo || user?.email);

  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  const isAdmin = isAdminRole(user.role);
  const isTeacher = isTeacherRole(user.role);
  const isActive = (path) => location.pathname === path;

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        {/* Logo/Title */}
        <div style={styles.logo} onClick={() => navigate(getHomeRouteForRole(user.role))}>
          <h1 style={styles.title}>📝 AI MCQ Exam</h1>
        </div>

        {/* Navigation Links */}
        <nav style={styles.nav}>
          {isAdmin && (
            <>
              <NavLink text="Dashboard" path="/admin/dashboard" isActive={isActive('/admin/dashboard')} onClick={() => navigate('/admin/dashboard')} />
              <NavLink text="Users" path="/admin/users" isActive={isActive('/admin/users')} onClick={() => navigate('/admin/users')} />
              <NavLink text="Classes" path="/admin/classes" isActive={isActive('/admin/classes')} onClick={() => navigate('/admin/classes')} />
              <NavLink text="Subjects" path="/admin/subjects" isActive={isActive('/admin/subjects')} onClick={() => navigate('/admin/subjects')} />
              <NavLink text="Questions" path="/admin/questions" isActive={isActive('/admin/questions')} onClick={() => navigate('/admin/questions')} />
              <NavLink text="Exams" path="/admin/exams" isActive={isActive('/admin/exams')} onClick={() => navigate('/admin/exams')} />
              <NavLink text="Reports" path="/admin/reports" isActive={isActive('/admin/reports')} onClick={() => navigate('/admin/reports')} />
              <NavLink text="Profile" path="/profile" isActive={isActive('/profile')} onClick={() => navigate('/profile')} />
            </>
          )}
          {isTeacher && (
            <>
              <NavLink text="Dashboard" path="/teacher/dashboard" isActive={isActive('/teacher/dashboard')} onClick={() => navigate('/teacher/dashboard')} />
              <NavLink text="Questions" path="/teacher/questions" isActive={isActive('/teacher/questions')} onClick={() => navigate('/teacher/questions')} />
              <NavLink text="Exams" path="/teacher/exams" isActive={isActive('/teacher/exams')} onClick={() => navigate('/teacher/exams')} />
              <NavLink text="Reports" path="/teacher/reports" isActive={isActive('/teacher/reports')} onClick={() => navigate('/teacher/reports')} />
              <NavLink text="Analytics" path="/teacher/analytics" isActive={isActive('/teacher/analytics')} onClick={() => navigate('/teacher/analytics')} />
              <NavLink text="Profile" path="/profile" isActive={isActive('/profile')} onClick={() => navigate('/profile')} />
            </>
          )}
          {!isAdmin && !isTeacher && (
            <>
              <NavLink text="Dashboard" path="/dashboard" isActive={isActive('/dashboard')} onClick={() => navigate('/dashboard')} />
              <NavLink text="Exams" path="/exams" isActive={isActive('/exams')} onClick={() => navigate('/exams')} />
              <NavLink text="History" path="/history" isActive={isActive('/history')} onClick={() => navigate('/history')} />
              <NavLink text="Analytics" path="/analytics" isActive={isActive('/analytics')} onClick={() => navigate('/analytics')} />
              <NavLink text="Profile" path="/profile" isActive={isActive('/profile')} onClick={() => navigate('/profile')} />
            </>
          )}
        </nav>

        {/* User Info & Logout */}
        <div style={styles.userSection}>
          <span style={styles.userEmail}>{primaryIdentifier}</span>
          <span style={styles.userRole}>{user.role}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ text, path, isActive, onClick }) {
  return (
    <button
      style={{
        ...styles.navLink,
        ...(isActive && styles.navLinkActive)
      }}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

const styles = {
  header: {
    backgroundColor: '#0b5fff',
    color: '#fff',
    padding: '0',
    boxShadow: '0 2px 8px rgba(11, 95, 255, 0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    cursor: 'pointer',
    marginRight: '32px',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '700',
  },
  nav: {
    display: 'flex',
    gap: '4px',
    flex: 1,
  },
  navLink: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.8)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.3s ease',
  },
  navLinkActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    color: '#fff',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: '32px',
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  userRole: {
    fontSize: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
    color: '#fff',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  logoutBtn: {
    background: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '500',
    transition: 'all 0.3s ease',
  },
};
