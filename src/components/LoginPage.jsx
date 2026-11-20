import React, { useState } from 'react';
import Confetti from './Confetti';
import DiyaLoader from './DiyaLoader';

/**
 * LoginPage
 * Vedika Indian family event-booking platform authentication.
 * Supports Sign Up (Create account) and Log In modes, full input validation,
 * dynamic DiyaLoader trigger, and success confirmation state.
 */
export default function LoginPage() {
  // Mode: 'signup' | 'login'
  const [authMode, setAuthMode] = useState('signup');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Login Mode single-field toggle: 'phone' | 'email'
  const [loginMethod, setLoginMethod] = useState('phone');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');

  // Validation Errors
  const [errors, setErrors] = useState({});

  // Loading & Success States
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Dark mode toggle (supports prefers-color-scheme by default)
  const [themeMode, setThemeMode] = useState('system'); // 'system' | 'light' | 'dark'

  // Handle Theme Switch
  const toggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'system' : 'dark';
    setThemeMode(nextTheme);
    if (nextTheme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
  };

  // Validation Logic
  const validateForm = () => {
    const newErrors = {};

    if (authMode === 'signup') {
      // Name validation: required, non-empty
      if (!fullName.trim()) {
        newErrors.fullName = 'Please enter your full name';
      } else if (fullName.trim().length < 2) {
        newErrors.fullName = 'Name should be at least 2 characters';
      }

      // Email validation: valid format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        newErrors.email = 'Please enter your email address';
      } else if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Enter a valid email address (e.g. name@example.com)';
      }

      // Phone validation: exactly 10 digits starting with 6, 7, 8, 9
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) {
        newErrors.phone = 'Please enter your mobile number';
      } else if (cleanPhone.length !== 10) {
        newErrors.phone = 'Enter a 10-digit mobile number';
      } else if (!/^[6-9]/.test(cleanPhone)) {
        newErrors.phone = 'Mobile number must start with 6, 7, 8, or 9';
      }
    } else {
      // Login validation
      if (loginMethod === 'phone') {
        const cleanPhone = loginPhone.replace(/\D/g, '');
        if (!cleanPhone) {
          newErrors.loginPhone = 'Please enter your mobile number';
        } else if (cleanPhone.length !== 10) {
          newErrors.loginPhone = 'Enter a 10-digit mobile number';
        } else if (!/^[6-9]/.test(cleanPhone)) {
          newErrors.loginPhone = 'Mobile number must start with 6, 7, 8, or 9';
        }
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!loginEmail.trim()) {
          newErrors.loginEmail = 'Please enter your email address';
        } else if (!emailRegex.test(loginEmail.trim())) {
          newErrors.loginEmail = 'Enter a valid email address';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Form Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (validateForm()) {
      setIsLoading(true);
    }
  };

  // Loader Completion Handler
  const handleLoaderComplete = () => {
    setIsLoading(false);
    setIsSuccess(true);
  };

  // Reset form to try again
  const handleReset = () => {
    setIsSuccess(false);
    setErrors({});
  };

  // Switch between Sign Up and Log In
  const switchMode = (mode) => {
    setAuthMode(mode);
    setErrors({});
    setIsSuccess(false);
  };

  // Mask phone for success screen: +91 XXXXXXXX{last2}
  const getMaskedPhone = () => {
    const rawNumber = authMode === 'signup' ? phone : (loginMethod === 'phone' ? loginPhone : '9876543210');
    const clean = rawNumber.replace(/\D/g, '');
    const last2 = clean.length >= 2 ? clean.slice(-2) : '10';
    return `+91 XXXXXXXX${last2}`;
  };

  const getGreetingName = () => {
    if (authMode === 'signup' && fullName.trim()) {
      return fullName.trim().split(' ')[0];
    }
    return 'there';
  };

  return (
    <div className="vedika-hero-bg">
      {/* Drifting Confetti Background */}
      <Confetti count={28} />

      {/* Top Header */}
      <header className="vedika-topbar">
        <a
          href="#home"
          className="vedika-logo-wrap"
          onClick={(e) => { e.preventDefault(); handleReset(); }}
          aria-label="Vedika Home"
        >
          <span className="vedika-logo-dot" aria-hidden="true" />
          <span className="vedika-logo-text">Vedika</span>
          <span className="vedika-logo-tagline">Function Halls &middot; Catering &middot; Decor</span>
        </a>

        {/* Quick Theme Pill */}
        <button
          type="button"
          onClick={toggleTheme}
          className="ghost-pill-btn"
          aria-label={`Toggle theme (currently ${themeMode})`}
          title="Switch theme"
        >
          {themeMode === 'dark' ? '🌙 Dark' : themeMode === 'light' ? '☀️ Light' : '✨ Theme'}
        </button>
      </header>

      {/* Main Center Content */}
      <main className="vedika-main-content">
        <div className="vedika-auth-card" role="region" aria-labelledby="auth-card-title">
          {!isSuccess ? (
            <>
              {/* Card Header */}
              <div className="auth-header">
                <h1 id="auth-card-title" className="auth-heading">
                  {authMode === 'signup' ? 'Create your free account' : 'Welcome back'}
                </h1>
                <p className="auth-subtext">Plan your event in minutes.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate>
                {authMode === 'signup' ? (
                  <>
                    {/* Field 1: Full Name */}
                    <div className="form-group">
                      <label htmlFor="vedika-fullname" className="field-label">
                        Full Name
                      </label>
                      <input
                        id="vedika-fullname"
                        type="text"
                        className={`vedika-input ${errors.fullName ? 'has-error' : ''}`}
                        placeholder="Your name"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors({ ...errors, fullName: null });
                        }}
                        autoComplete="name"
                        aria-invalid={Boolean(errors.fullName)}
                        aria-describedby={errors.fullName ? 'error-fullname' : undefined}
                        disabled={isLoading}
                      />
                      {errors.fullName && (
                        <p id="error-fullname" className="field-error" role="alert">
                          {errors.fullName}
                        </p>
                      )}
                    </div>

                    {/* Field 2: Email */}
                    <div className="form-group">
                      <label htmlFor="vedika-email" className="field-label">
                        Email Address
                      </label>
                      <input
                        id="vedika-email"
                        type="email"
                        className={`vedika-input ${errors.email ? 'has-error' : ''}`}
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors({ ...errors, email: null });
                        }}
                        autoComplete="email"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'error-email' : undefined}
                        disabled={isLoading}
                      />
                      {errors.email && (
                        <p id="error-email" className="field-error" role="alert">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Field 3: Mobile Number with fixed +91 prefix */}
                    <div className="form-group">
                      <label htmlFor="vedika-phone" className="field-label">
                        Mobile Number
                      </label>
                      <div className={`phone-input-wrap ${errors.phone ? 'has-error' : ''}`}>
                        <span className="phone-prefix-chip" aria-hidden="true">
                          <span className="prefix-flag">🇮🇳</span> +91
                        </span>
                        <input
                          id="vedika-phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          className="vedika-input"
                          placeholder="Mobile number"
                          value={phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(val);
                            if (errors.phone) setErrors({ ...errors, phone: null });
                          }}
                          autoComplete="tel"
                          aria-label="10 digit Indian mobile number"
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={errors.phone ? 'error-phone' : undefined}
                          disabled={isLoading}
                        />
                      </div>
                      {errors.phone && (
                        <p id="error-phone" className="field-error" role="alert">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Log In Mode */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                      <button
                        type="button"
                        onClick={() => { setLoginMethod('phone'); setErrors({}); }}
                        className="ghost-pill-btn"
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          color: loginMethod === 'phone' ? '#3A0A1E' : 'var(--text)',
                          backgroundColor: loginMethod === 'phone' ? 'var(--gold)' : 'transparent',
                          borderColor: loginMethod === 'phone' ? 'var(--gold)' : 'var(--line)',
                          fontWeight: 600
                        }}
                      >
                        Mobile
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLoginMethod('email'); setErrors({}); }}
                        className="ghost-pill-btn"
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                          color: loginMethod === 'email' ? '#3A0A1E' : 'var(--text)',
                          backgroundColor: loginMethod === 'email' ? 'var(--gold)' : 'transparent',
                          borderColor: loginMethod === 'email' ? 'var(--gold)' : 'var(--line)',
                          fontWeight: 600
                        }}
                      >
                        Email
                      </button>
                    </div>

                    {loginMethod === 'phone' ? (
                      <div className="form-group">
                        <label htmlFor="login-phone" className="field-label">
                          Mobile Number
                        </label>
                        <div className={`phone-input-wrap ${errors.loginPhone ? 'has-error' : ''}`}>
                          <span className="phone-prefix-chip" aria-hidden="true">
                            <span className="prefix-flag">🇮🇳</span> +91
                          </span>
                          <input
                            id="login-phone"
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            className="vedika-input"
                            placeholder="Mobile number"
                            value={loginPhone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setLoginPhone(val);
                              if (errors.loginPhone) setErrors({ ...errors, loginPhone: null });
                            }}
                            autoComplete="tel"
                            aria-label="10 digit Indian mobile number"
                            aria-invalid={Boolean(errors.loginPhone)}
                            aria-describedby={errors.loginPhone ? 'error-loginphone' : undefined}
                            disabled={isLoading}
                          />
                        </div>
                        {errors.loginPhone && (
                          <p id="error-loginphone" className="field-error" role="alert">
                            {errors.loginPhone}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="form-group">
                        <label htmlFor="login-email" className="field-label">
                          Email Address
                        </label>
                        <input
                          id="login-email"
                          type="email"
                          className={`vedika-input ${errors.loginEmail ? 'has-error' : ''}`}
                          placeholder="Email address"
                          value={loginEmail}
                          onChange={(e) => {
                            setLoginEmail(e.target.value);
                            if (errors.loginEmail) setErrors({ ...errors, loginEmail: null });
                          }}
                          autoComplete="email"
                          aria-invalid={Boolean(errors.loginEmail)}
                          aria-describedby={errors.loginEmail ? 'error-loginemail' : undefined}
                          disabled={isLoading}
                        />
                        {errors.loginEmail && (
                          <p id="error-loginemail" className="field-error" role="alert">
                            {errors.loginEmail}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Primary Button */}
                <button
                  type="submit"
                  className="vedika-btn-primary"
                  disabled={isLoading}
                  aria-busy={isLoading}
                >
                  Continue
                </button>
              </form>

              {/* Switch Auth Mode Link */}
              <div className="auth-switch-wrap">
                {authMode === 'signup' ? (
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => switchMode('login')}
                  >
                    Already have an account? <strong>Log in</strong>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => switchMode('signup')}
                  >
                    Don't have an account? <strong>Sign up</strong>
                  </button>
                )}
              </div>

              {/* Indian Event Categories Preview Badges */}
              <div className="event-badges-row" aria-hidden="true">
                <span className="event-badge">🏛️ Halls</span>
                <span className="event-badge">🍛 Catering</span>
                <span className="event-badge">🌺 Decor</span>
                <span className="event-badge">💌 Cards</span>
                <span className="event-badge">🥁 Band Baja</span>
              </div>
            </>
          ) : (
            /* Success State after Loader completes */
            <div className="success-card-content">
              <div className="success-emoji" aria-hidden="true">
                🎉
              </div>
              <h2 className="success-heading">
                You're all set{fullName.trim() ? `, ${getGreetingName()}` : ''}!
              </h2>
              <p className="success-subtext">
                We'll send an OTP to <strong>{getMaskedPhone()}</strong>.
              </p>

              <button
                type="button"
                className="vedika-btn-primary"
                onClick={() => alert("Welcome to Vedika! Venue booking and event planner dashboard loading...")}
              >
                Start planning
              </button>

              <div className="auth-switch-wrap" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="auth-switch-btn"
                  onClick={handleReset}
                >
                  &larr; Back to login / sign up
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="vedika-footer">
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Vedika. Made for Indian celebrations. All rights reserved.
        </p>
      </footer>

      {/* Reusable DiyaLoader Component */}
      <DiyaLoader
        isOpen={isLoading}
        onComplete={handleLoaderComplete}
        caption="Lighting the lamps for your function…"
        duration={3000}
      />
    </div>
  );
}
