import React from 'react';

export default function LoadingSpinner({ fullScreen = false }) {
  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  };

  const containerStyle = fullScreen
    ? {
        ...baseStyle,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
      }
    : {
        ...baseStyle,
        padding: '32px',
        minHeight: '200px',
      };

  return (
    <div style={containerStyle}>
      <div style={styles.spinner} />
      <span style={styles.text}>Loading...</span>
    </div>
  );
}

const styles = {
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #0b5fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    color: '#666',
    fontWeight: '500',
    fontSize: '0.9rem',
  },
};

// Add CSS for animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
