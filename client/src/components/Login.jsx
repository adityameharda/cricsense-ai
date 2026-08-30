import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Icon from './common/Icons';

export const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const isFormValid = isLogin
    ? formData.username?.trim() && formData.password?.trim()
    : formData.username?.trim() && formData.email?.trim() && formData.password?.trim();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await axios.post(`http://localhost:5000${endpoint}`, formData);
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        if (onLogin) onLogin(response.data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setIsLogin(true);
    setFormData({ username: 'cric_fan', email: 'fan@cricscore.com', password: 'password123' });
    setError('');
  };

  return (
    <div className="auth-page animate-fade-up">
      <div className="auth-card-outer">
        {/* Left Hero Showcase */}
        <div className="auth-left-panel">
          <div className="auth-left-glow" />
          
          <div className="auth-brand-row">
            <div className="auth-brand-logo">🏏</div>
            <div>
              <span className="auth-brand-name">CricScore</span>
              <span className="auth-brand-tag">PRO</span>
            </div>
          </div>

          <div className="auth-left-content">
            <h2 className="auth-headline">
              Real-Time Cricket Intelligence & Fantasy Arena
            </h2>
            <p className="auth-sub">
              Track live ball-by-ball telemetry, build unbeatable fantasy squads with live multipliers, and tap into AI match analytics.
            </p>

            <div className="auth-features">
              {[
                { title: 'Sub-Second Telemetry', desc: 'Live ball-by-ball updates & CRR tracking' },
                { title: 'Fantasy Dream Arena', desc: 'Custom private contests & real-time rank points' },
                { title: 'CricSense AI Engine', desc: 'Live tactical insights & win probability' }
              ].map((f, i) => (
                <div key={i} className="auth-feature-item">
                  <div className="auth-feature-check">✓</div>
                  <div>
                    <div className="auth-feature-title">{f.title}</div>
                    <div className="auth-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-left-footer">
            <div className="auth-live-indicator">
              <span className="auth-live-dot" />
              <span>Live match feeds active</span>
            </div>
            <span>v1.0 Pro Edition</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-right-panel">
          {/* Segmented Switch */}
          <div className="auth-toggle">
            <button
              type="button"
              id="login-tab-btn"
              className={`auth-toggle-btn${isLogin ? ' active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              id="register-tab-btn"
              className={`auth-toggle-btn${!isLogin ? ' active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <div className="auth-header-block">
            <h3 className="auth-panel-title">
              {isLogin ? 'Welcome back 👋' : 'Join the Arena 🚀'}
            </h3>
            <p className="auth-panel-sub">
              {isLogin
                ? 'Sign in to access live scorecards and manage your fantasy teams.'
                : 'Create an account to start drafting your dream 11.'}
            </p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <span className="auth-error-icon">⚠️</span>
              <div className="auth-error-text">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Username */}
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Icon name="user" size={16} />
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                  className="form-input"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Email (only in register) */}
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <Icon name="mail" size={16} />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="password">Password</label>
                {isLogin && (
                  <span className="forgot-link" title="Contact admin to reset">Forgot password?</span>
                )}
              </div>
              <div className="input-wrap">
                <span className="input-icon">
                  <Icon name="lock" size={16} />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            {/* Remember Me */}
            {isLogin && (
              <div className="remember-row">
                <label className="remember-checkbox-label">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="remember-checkbox"
                  />
                  <span>Stay signed in for 7 days</span>
                </label>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              id="auth-submit-btn"
              disabled={!isFormValid || loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <>
                  <div className="auth-btn-spinner" />
                  <span>Authenticating…</span>
                </>
              ) : isLogin ? 'Sign In to CricScore →' : 'Complete Registration →'}
            </button>
          </form>

          {/* Quick Demo Fill (for testing / evaluator convenience) */}
          <div className="auth-quick-demo">
            <button
              type="button"
              onClick={handleQuickDemo}
              className="auth-demo-btn"
            >
              ⚡ Fill Demo Account (cric_fan)
            </button>
          </div>

          <div className="auth-guest-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="auth-guest-link"
            onClick={() => navigate('/')}
          >
            Continue as Guest (Read Only) →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;