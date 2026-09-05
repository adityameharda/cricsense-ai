import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';
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
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, formData);
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
    setFormData({ username: 'cric_fan', email: 'fan@striker.live', password: 'password123' });
    setError('');
  };

  return (
    <div className="auth-page animate-fade-up">
      <div className="auth-card-outer">
        {/* Left Hero Showcase */}
        <div className="auth-left-panel">
          <div className="auth-brand-row">
            <div className="auth-brand-icon">
              <Icon name="cricket" size={22} color="white" />
            </div>
            <div>
              <div className="auth-brand-name-wrap">
                <span className="auth-brand-name">Striker</span>
                <span className="auth-brand-tag">PRO</span>
              </div>
              <span className="auth-brand-domain">striker.live</span>
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
                { title: 'Sub-Second Telemetry', desc: 'Live ball-by-ball updates & CRR tracking', icon: 'zap' },
                { title: 'Fantasy Dream Arena', desc: 'Custom private contests & real-time rank points', icon: 'trophy' },
                { title: 'CricSense AI Engine', desc: 'Live tactical insights & win probability', icon: 'sparkles' }
              ].map((f, i) => (
                <div key={i} className="auth-feature-item">
                  <div className="auth-feature-icon">
                    <Icon name={f.icon} size={14} color="white" />
                  </div>
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
            <span>v2.0 Pro Edition • striker.live</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-right-panel">
          <div className="auth-toggle">
            <button
              type="button"
              className={`auth-toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <h3 className="auth-panel-title">{isLogin ? 'Welcome Back!' : 'Join Striker'}</h3>
          <p className="auth-panel-sub">
            {isLogin ? 'Access your fantasy squads and live predictions' : 'Create an account to start competing'}
          </p>

          {error && (
            <div className="auth-error">
              <Icon name="info" size={16} color="var(--color-out)" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Icon name="user" size={16} />
                </span>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <Icon name="mail" size={16} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="form-input"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              </div>
              <div className="input-wrap">
                <span className="input-icon">
                  <Icon name="lock" size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="auth-submit-btn"
            >
              <Icon name={isLogin ? 'login' : 'check'} size={16} color="white" />
              <span>{loading ? 'Authenticating…' : isLogin ? 'Sign In to Account' : 'Create My Account'}</span>
            </button>
          </form>

          <hr className="auth-divider" />

          <button
            type="button"
            onClick={handleQuickDemo}
            className="auth-guest-link"
          >
            Fill Demo Credentials (cric_fan)
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;