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
      if (event.key === 'Escape') setMenuOpen(false);
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

          {/* ── Logo ── */}
          <div style={styles.logo} onClick={() => navigate(getHomeRouteForRole(user.role))}>
            <img
              src="/mit-logo-white.png"
              alt="MIT-ADT University"
              style={styles.logoImg}
            />
          </div>

          {/* ── Nav Links ── */}
          <nav style={styles.nav}>
            {isAdmin && (
              <>
                <NavLink text="Dashboard"  isActive={isActive('/admin/dashboard')}  onClick={() => handleNavigate('/admin/dashboard')} />
                <NavLink text="Users"      isActive={isActive('/admin/users')}      onClick={() => handleNavigate('/admin/users')} />
                <NavLink text="Classes"    isActive={isActive('/admin/classes')}    onClick={() => handleNavigate('/admin/classes')} />
                <NavLink text="Questions"  isActive={isActive('/admin/questions')}  onClick={() => handleNavigate('/admin/questions')} />
                <NavLink text="Exams"      isActive={isActive('/admin/exams')}      onClick={() => handleNavigate('/admin/exams')} />
                <NavLink text="Reports"    isActive={isActive('/admin/reports')}    onClick={() => handleNavigate('/admin/reports')} />
              </>
            )}
            {isTeacher && (
              <>
                <NavLink text="Dashboard"  isActive={isActive('/teacher/dashboard')} onClick={() => handleNavigate('/teacher/dashboard')} />
                <NavLink text="Questions"  isActive={isActive('/teacher/questions')} onClick={() => handleNavigate('/teacher/questions')} />
                <NavLink text="Exams"      isActive={isActive('/teacher/exams')}     onClick={() => handleNavigate('/teacher/exams')} />
                <NavLink text="Reports"    isActive={isActive('/teacher/reports')}   onClick={() => handleNavigate('/teacher/reports')} />
                <NavLink text="Analytics"  isActive={isActive('/teacher/analytics')} onClick={() => handleNavigate('/teacher/analytics')} />
              </>
            )}
            {!isAdmin && !isTeacher && (
              <>
                <NavLink text="Dashboard"  isActive={isActive('/dashboard')}  onClick={() => handleNavigate('/dashboard')} />
                <NavLink text="Exams"      isActive={isActive('/exams')}      onClick={() => handleNavigate('/exams')} />
                <NavLink text="History"    isActive={isActive('/history')}    onClick={() => handleNavigate('/history')} />
                <NavLink text="Analytics"  isActive={isActive('/analytics')}  onClick={() => handleNavigate('/analytics')} />
              </>
            )}
          </nav>

          {/* ── Role pill + avatar menu ── */}
          <div style={styles.rightSection}>
            <span style={styles.rolePill}>{user.role}</span>

            <div ref={menuRef} style={styles.userMenuWrap}>
              <button
                type="button"
                style={styles.avatarButton}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Open profile menu"
                aria-expanded={menuOpen}
              >
                <ProfileCircleIcon />
              </button>

              {menuOpen && (
                <div style={styles.menuPanel} role="menu" aria-label="Profile menu">
                  {/* small user identity row */}
                  <div style={styles.menuUserRow}>
                    <span style={styles.menuUserName}>{user.firstName || user.name || user.email}</span>
                    <span style={styles.menuUserEmail}>{user.email}</span>
                  </div>
                  <div style={styles.menuDivider} />
                  <button type="button" style={styles.menuItem} onClick={() => handleNavigate('/profile')}>
                    👤 Update Profile
                  </button>
                  <div style={styles.menuDivider} />
                  <button type="button" style={{ ...styles.menuItem, ...styles.menuItemDanger }} onClick={handleLogout}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>
      {/* Rainbow accent line */}
      <div style={styles.rainbowLine} />
    </>
  );
}

function NavLink({ text, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      style={{
        ...styles.navLink,
        ...(isActive ? styles.navLinkActive : hovered ? styles.navLinkHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {text}
    </button>
  );
}

function ProfileCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: 28, height: 28, display: 'block' }}>
      <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,0.13)" />
      <circle cx="12" cy="9"  r="3.2" fill="#fff" />
      <path
        d="M6.8 18.1c1.7-2.4 3.7-3.6 5.2-3.6s3.5 1.2 5.2 3.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_HEIGHT = 70; // px — single source of truth

const styles = {
  header: {
    background: 'linear-gradient(90deg, #4B0082 0%, #6A0DAD 38%, #9B30E0 68%, #D4267A 100%)',
    color: '#fff',
    padding: 0,
    boxShadow: '0 2px 16px rgba(75,0,130,0.22)',
    position: 'static',
    top: 0,
    zIndex: 200,
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: `0 32px`,
    height: `${NAV_HEIGHT}px`,
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  logo: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
    textDecoration: 'none',
    marginRight: '40px', // Compensate for scaling
  },
  logoImg: {
    width: '240px',
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
    transform: 'scale(1.15)',
    transformOrigin: 'left center',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.1,
    gap: '2px',
  },
  brandName: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: '13px',
    letterSpacing: '0.07em',
    color: '#fff',
    textTransform: 'uppercase',
  },
  brandSub: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    fontSize: '9px',
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
    justifyContent: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  navLink: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.82)',
    border: 'none',
    padding: '6px 11px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.05em',
    transition: 'background 0.18s, color 0.18s',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  navLinkHover: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  rolePill: {
    fontSize: '9px',
    fontWeight: 700,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    background: '#00D4C8',
    color: '#003D3B',
    padding: '3px 9px',
    borderRadius: '20px',
  },
  userMenuWrap: {
    position: 'relative',
  },
  avatarButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1.5px solid rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.1)',
    padding: 0,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.18s, transform 0.18s',
  },
  menuPanel: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 10px)',
    minWidth: '200px',
    padding: '8px',
    borderRadius: '14px',
    background: 'rgba(18,10,38,0.96)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 16px 40px rgba(10,4,28,0.38)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    zIndex: 300,
  },
  menuUserRow: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px 6px',
    gap: '2px',
  },
  menuUserName: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#fff',
  },
  menuUserEmail: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.5)',
    wordBreak: 'break-all',
  },
  menuItem: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.88)',
    border: 'none',
    textAlign: 'left',
    padding: '9px 12px',
    borderRadius: '9px',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 600,
    fontFamily: "'Outfit', sans-serif",
    transition: 'background 0.15s',
    letterSpacing: '0.02em',
  },
  menuItemDanger: {
    color: '#FFB4B4',
  },
  menuDivider: {
    height: '1px',
    margin: '2px 4px',
    background: 'rgba(255,255,255,0.1)',
  },
  rainbowLine: {
    height: '3px',
    background: 'linear-gradient(90deg, #9B30E0 0%, #C0359E 25%, #E8631A 55%, #F5AB00 100%)',
    flexShrink: 0,
  },
};
