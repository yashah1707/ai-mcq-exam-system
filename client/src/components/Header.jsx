import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getHomeRouteForRole, isAdminRole, isTeacherRole } from '../utils/roleRouting';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = isAdminRole(user?.role);
  const isTeacher = isTeacherRole(user?.role);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  const handleNavigate = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  return (
    <>
      <header style={styles.header}>
        <div style={styles.container}>
          <div style={styles.logo} onClick={() => navigate(getHomeRouteForRole(user.role))}>
            <img
              src="/mit-logo-white.png"
              alt="MIT-ADT University"
              style={styles.logoImg}
            />
            <div style={styles.brandText}>
              <span style={styles.title}>MIT-ADT EXAM</span>
              <span style={styles.subtitle}>UNIVERSITY PORTAL</span>
            </div>
          </div>

          <nav style={styles.nav}>
            {isAdmin && (
              <>
                <NavLink text="Dashboard" isActive={isActive('/admin/dashboard')} onClick={() => navigate('/admin/dashboard')} />
                <NavLink text="Users" isActive={isActive('/admin/users')} onClick={() => navigate('/admin/users')} />
                <NavLink text="Classes" isActive={isActive('/admin/classes')} onClick={() => navigate('/admin/classes')} />
                <NavLink text="Subjects" isActive={isActive('/admin/subjects')} onClick={() => navigate('/admin/subjects')} />
                <NavLink text="Questions" isActive={isActive('/admin/questions')} onClick={() => navigate('/admin/questions')} />
                <NavLink text="Exams" isActive={isActive('/admin/exams')} onClick={() => navigate('/admin/exams')} />
                <NavLink text="Reports" isActive={isActive('/admin/reports')} onClick={() => navigate('/admin/reports')} />
              </>
            )}
            {isTeacher && (
              <>
                <NavLink text="Dashboard" isActive={isActive('/teacher/dashboard')} onClick={() => navigate('/teacher/dashboard')} />
                <NavLink text="Questions" isActive={isActive('/teacher/questions')} onClick={() => navigate('/teacher/questions')} />
                <NavLink text="Exams" isActive={isActive('/teacher/exams')} onClick={() => navigate('/teacher/exams')} />
                <NavLink text="Reports" isActive={isActive('/teacher/reports')} onClick={() => navigate('/teacher/reports')} />
                <NavLink text="Analytics" isActive={isActive('/teacher/analytics')} onClick={() => navigate('/teacher/analytics')} />
              </>
            )}
            {!isAdmin && !isTeacher && (
              <>
                <NavLink text="Dashboard" isActive={isActive('/dashboard')} onClick={() => navigate('/dashboard')} />
                <NavLink text="Exams" isActive={isActive('/exams')} onClick={() => navigate('/exams')} />
                <NavLink text="History" isActive={isActive('/history')} onClick={() => navigate('/history')} />
                <NavLink text="Analytics" isActive={isActive('/analytics')} onClick={() => navigate('/analytics')} />
              </>
            )}
          </nav>

          <div ref={menuRef} style={styles.userMenuWrap}>
            <button
              type="button"
              style={styles.avatarButton}
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
            >
              <ProfileCircleIcon />
            </button>

            {menuOpen && (
              <div style={styles.menuPanel} role="menu" aria-label="Profile menu">
                <button type="button" style={styles.menuItem} onClick={() => handleNavigate('/profile')}>
                  Update Profile
                </button>
                <button type="button" style={styles.menuItem} onClick={() => handleNavigate('/profile/password')}>
                  Edit Password
                </button>
                <div style={styles.menuDivider} />
                <button type="button" style={{ ...styles.menuItem, ...styles.menuItemDanger }} onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div style={styles.rainbowLine} />
    </>
  );
}

function NavLink({ text, isActive, onClick }) {
  return (
    <button
      type="button"
      style={{
        ...styles.navLink,
        ...(isActive && styles.navLinkActive),
      }}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

function ProfileCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={styles.avatarIcon}>
      <circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.14)" />
      <circle cx="12" cy="9" r="3.25" fill="#ffffff" />
      <path
        d="M6.75 18.2c1.8-2.5 3.85-3.7 5.25-3.7s3.45 1.2 5.25 3.7"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const styles = {
  header: {
    background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 42%, #9B30E0 72%, #D4267A 100%)',
    color: '#fff',
    padding: 0,
    boxShadow: '0 4px 18px rgba(75, 0, 130, 0.24)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  container: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '14px 28px',
    minHeight: '88px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
  },
  logo: {
    cursor: 'pointer',
    marginRight: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexShrink: 0,
  },
  logoImg: {
    height: '540px',
    width: 'auto',
    objectFit: 'contain',
    filter: 'brightness(1.08)',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.05,
  },
  title: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '19px',
    letterSpacing: '0.08em',
    color: '#fff',
  },
  subtitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    fontSize: '10px',
    letterSpacing: '0.16em',
    color: 'rgba(255, 255, 255, 0.72)',
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flex: 1,
    flexWrap: 'wrap',
  },
  navLink: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.88)',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.04em',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    color: '#fff',
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.14)',
  },
  userMenuWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarButton: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.22)',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: 0,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.14)',
    transition: 'transform 0.18s ease, background 0.18s ease',
  },
  avatarIcon: {
    width: '32px',
    height: '32px',
    display: 'block',
  },
  menuPanel: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 12px)',
    minWidth: '220px',
    padding: '10px',
    borderRadius: '18px',
    background: 'rgba(22, 16, 42, 0.94)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 20px 42px rgba(18, 10, 40, 0.36)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 20,
  },
  menuItem: {
    background: 'transparent',
    color: '#fff',
    border: 'none',
    textAlign: 'left',
    padding: '11px 14px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    transition: 'background 0.18s ease, transform 0.18s ease',
  },
  menuItemDanger: {
    color: '#FFB8B8',
  },
  menuDivider: {
    height: '1px',
    margin: '2px 4px',
    background: 'rgba(255, 255, 255, 0.12)',
  },
  rainbowLine: {
    height: '4px',
    background: 'linear-gradient(90deg, #9B30E0 0%, #C0359E 25%, #E8631A 55%, #F5AB00 100%)',
    flexShrink: 0,
  },
};
