import React, { useEffect, useState } from 'react';

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      const id = Date.now() + Math.random();
      const toast = { id, type: detail.type || 'info', message: detail.message || '' };
      setToasts((t) => [...t, toast]);
      // auto remove
      setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), detail.duration || 5000);
    };

    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={containerStyle} aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} style={{ ...toastStyle, ...(variantStyles[t.type] || infoStyle) }}>
          <strong style={{display:'block'}}>{labels[t.type] || 'Info'}</strong>
          <div>{t.message}</div>
        </div>
      ))}
    </div>
  );
}

const containerStyle = {
  position: 'fixed',
  right: 16,
  top: 80,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const toastStyle = {
  minWidth: 260,
  padding: '12px 16px',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(75, 0, 130, 0.18)',
  fontFamily: "'Outfit', sans-serif",
  fontSize: '0.9rem',
};

const infoStyle = {
  background: '#1A1A2E',
  color: '#fff'
};

const warningStyle = {
  background: '#F5AB00',
  color: '#1A1A2E'
};

const successStyle = {
  background: '#28A745',
  color: '#fff'
};

const errorStyle = {
  background: '#E8361A',
  color: '#fff'
};

const variantStyles = {
  info: infoStyle,
  warning: warningStyle,
  success: successStyle,
  error: errorStyle,
};

const labels = {
  info: 'Info',
  warning: 'Warning',
  success: 'Success',
  error: 'Error',
};
