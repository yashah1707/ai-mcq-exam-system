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
        <div key={t.id} style={{ ...toastStyle, ...(t.type === 'warning' ? warningStyle : {}) }}>
          <strong style={{display:'block'}}>{t.type === 'warning' ? 'Warning' : 'Info'}</strong>
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
  background: '#111',
  color: '#fff',
  padding: '12px 16px',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const warningStyle = {
  background: '#ffb74d',
  color: '#111'
};
