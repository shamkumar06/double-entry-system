import React, { useState } from 'react';
import { authApi } from '../services/api';

export default function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [registered, setRegistered] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const switchMode = (m) => {
    setMode(m);
    setLoginError('');
    setRegError('');
    setRegistered(false);
  };

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await authApi.login(loginEmail, loginPassword);
      onLoginSuccess(response.user || response);
    } catch (err) {
      setLoginError(err?.error || err?.message || 'Invalid email or password.');
    } finally {
      setLoginLoading(false);
    }
  };

  /* ── Register ── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');

    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match.');
      return;
    }

    setRegLoading(true);
    try {
      await authApi.register(regEmail, regPassword, regName.trim() || undefined);
      setRegistered(true);
    } catch (err) {
      setRegError(err?.error || err?.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  /* ── Shared styles ── */
  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-main)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
    display: 'block',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const alertStyle = (color) => ({
    background: `rgba(${color}, 0.12)`,
    color: color === '239,68,68' ? 'var(--danger)' : '#10b981',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: `1px solid rgba(${color}, 0.25)`,
  });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--background)',
      padding: '1.5rem',
    }}>
      <div className="glass-panel" style={{
        padding: '2.5rem 2rem',
        maxWidth: '420px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
        borderRadius: '18px',
        animation: 'fadeInUp 0.4s ease',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Double Entry
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Log in to access your financial records' : 'Create a new account'}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--surface)',
          borderRadius: '10px',
          padding: '4px',
          gap: '4px',
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                background: mode === m ? 'var(--primary)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loginError && (
              <div style={alertStyle('239,68,68')}>{loginError}</div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loginLoading}
              style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem', borderRadius: '10px' }}
            >
              {loginLoading ? 'Authenticating…' : 'Sign In →'}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Don't have an account?{' '}
              <span
                onClick={() => switchMode('register')}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign Up
              </span>
            </p>
          </form>
        )}

        {/* ── Register form ── */}
        {mode === 'register' && !registered && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {regError && (
              <div style={alertStyle('239,68,68')}>{regError}</div>
            )}
            <div>
              <label style={labelStyle}>Full Name <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your Name"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Role notice */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              borderRadius: '8px',
              padding: '0.6rem 0.85rem',
              fontSize: '0.78rem',
              color: 'var(--primary)',
              fontWeight: 500,
            }}>
              ℹ️ New accounts are created with <strong>Viewer</strong> access. Contact an Admin to upgrade your role.
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={regLoading}
              style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem', borderRadius: '10px' }}
            >
              {regLoading ? 'Creating account…' : 'Create Account →'}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Already have an account?{' '}
              <span
                onClick={() => switchMode('login')}
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              >
                Sign In
              </span>
            </p>
          </form>
        )}

        {/* ── Success state ── */}
        {mode === 'register' && registered && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.2rem', alignItems: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
              border: '2px solid rgba(16, 185, 129, 0.3)',
            }}>
              ✅
            </div>
            <div>
              <h3 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>Account Created!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Your account for <strong>{regEmail}</strong> has been created with Viewer access.
                You can now sign in.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => {
                setLoginEmail(regEmail);
                setLoginPassword('');
                switchMode('login');
              }}
              style={{ padding: '0.75rem 2rem', fontWeight: 700, borderRadius: '10px' }}
            >
              Go to Sign In →
            </button>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
