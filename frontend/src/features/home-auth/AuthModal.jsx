import React, { useState, useEffect } from 'react';
import LocationSelector from '../../shared/components/LocationSelector.jsx';
import TermsModal from './TermsModal.jsx';
import {
  authenticateUser,
  seedTestAccount,
  authenticateVendor,
  createVendorAccount,
  isUsernameTaken,
  seedTestVendor,
  dataService
} from '../../shared/data-service/index.js';
import { verifyDocument, VERIFICATION_STATUSES } from '../../shared/utils/verify.js';

export default function AuthModal({
  isOpen = false,
  initialMode = 'signup', // 'signup' | 'login'
  initialRole = 'user', // 'user' | 'vendor'
  onClose,
  onLoginSuccess,
  onVendorLoginSuccess,
  onRequestLoader // triggers the full-screen diya loader
}) {
  // Mode & Role
  const [role, setRole] = useState(initialRole); // 'user' | 'vendor'
  const [mode, setMode] = useState(initialMode); // 'signup' | 'login'
  const [isSuccess, setIsSuccess] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // User fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [location, setLocation] = useState({ city: '', state: '', pincode: '', source: 'auto' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Vendor Login fields
  const [vendorLoginUsername, setVendorLoginUsername] = useState('');
  const [vendorLoginPassword, setVendorLoginPassword] = useState('');
  const [showVendorLoginPassword, setShowVendorLoginPassword] = useState(false);
  const [forgotDemoMsg, setForgotDemoMsg] = useState(false);

  // Vendor Sign-up Wizard (6 steps)
  const [vendorStep, setVendorStep] = useState(1);
  const [owns, setOwns] = useState('both'); // 'hall' | 'catering' | 'both'
  const [businessNameHall, setBusinessNameHall] = useState('');
  const [businessNameCatering, setBusinessNameCatering] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorUpiId, setVendorUpiId] = useState('');

  // Step 3: Documents
  const [tradeLicenceNumber, setTradeLicenceNumber] = useState('');
  const [tradeLicenceFile, setTradeLicenceFile] = useState(null);
  const [tradeLicencePreview, setTradeLicencePreview] = useState(null);

  const [fssaiNumber, setFssaiNumber] = useState('');
  const [fssaiFile, setFssaiFile] = useState(null);
  const [fssaiPreview, setFssaiPreview] = useState(null);

  // Step 4: Verification results
  const [verifyingDocs, setVerifyingDocs] = useState(false);
  const [tradeChecklist, setTradeChecklist] = useState([]);
  const [tradeVerdict, setTradeVerdict] = useState(null);
  const [fssaiChecklist, setFssaiChecklist] = useState([]);
  const [fssaiVerdict, setFssaiVerdict] = useState(null);

  // Step 5: Terms checkbox
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 6: Login credentials
  const [vendorUsername, setVendorUsername] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState(null);
  const [vendorPassword, setVendorPassword] = useState('');
  const [vendorConfirmPassword, setVendorConfirmPassword] = useState('');
  const [showVendorPassword, setShowVendorPassword] = useState(false);
  const [showVendorConfirmPassword, setShowVendorConfirmPassword] = useState(false);

  // Errors state
  const [errors, setErrors] = useState({});

  useEffect(() => {
    seedTestAccount();
    seedTestVendor();
    setRole(initialRole || 'user');
    setMode(initialMode || 'signup');
    setIsSuccess(false);
    setErrors({});
  }, [initialMode, initialRole, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !termsModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, termsModalOpen]);

  // Live username availability check
  useEffect(() => {
    if (!vendorUsername || vendorUsername.length < 3) {
      setUsernameAvailability(null);
      return;
    }
    const timer = setTimeout(async () => {
      const taken = await isUsernameTaken(vendorUsername);
      setUsernameAvailability(!taken);
    }, 250);
    return () => clearTimeout(timer);
  }, [vendorUsername]);

  if (!isOpen) return null;

  // Password strength calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-zA-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'var(--rose)', width: '30%' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#FFA62B', width: '60%' };
    if (score >= 3) return { score: 3, label: 'Strong', color: 'var(--leaf)', width: '100%' };
    return { score: 0, label: '', color: 'transparent', width: '0%' };
  };

  const userStrength = calculatePasswordStrength(password);
  const vendorStrength = calculatePasswordStrength(vendorPassword);

  /* =========================================================================
     USER SUBMIT HANDLERS
     ========================================================================= */
  const handleUserSignUpSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!name.trim()) newErrors.name = 'Full name is required.';
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number starting with 6-9.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address.';
    }
    const cleanUpi = upiId.trim();
    if (cleanUpi && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      newErrors.upiId = 'Enter a valid UPI ID (e.g. name@okhdfcbank).';
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = 'Must be at least 8 characters with a letter and a number.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const newUser = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        upiId: cleanUpi,
        password,
        city: location.city || 'Kadapa',
        state: location.state || 'Andhra Pradesh',
        location
      };
      await dataService.auth.userSignup(newUser);

      if (onLoginSuccess) onLoginSuccess(newUser);
      onClose();
    } catch {
      onClose();
    }
  };

  const handleUserLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = loginPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrors({ loginPhone: 'Enter a valid 10-digit mobile number.' });
      return;
    }
    if (!loginPassword) {
      setErrors({ loginPassword: 'Password is required.' });
      return;
    }

    const res = await authenticateUser(cleanPhone, loginPassword);
    if (res.success) {
      if (onLoginSuccess) onLoginSuccess(res.user);
      onClose();
    } else {
      setErrors({ loginGeneral: 'Mobile number or password is incorrect.' });
    }
  };

  /* =========================================================================
     VENDOR LOGIN HANDLER
     ========================================================================= */
  const handleVendorLoginSubmit = async (e) => {
    e.preventDefault();
    if (!vendorLoginUsername.trim()) {
      setErrors({ vendorLoginUsername: 'Username is required.' });
      return;
    }
    if (!vendorLoginPassword) {
      setErrors({ vendorLoginPassword: 'Password is required.' });
      return;
    }

    const res = await authenticateVendor(vendorLoginUsername, vendorLoginPassword);
    if (res.success) {
      const targetVendor = res.vendor;
      if (onVendorLoginSuccess) onVendorLoginSuccess(targetVendor);
      else if (onLoginSuccess) onLoginSuccess(targetVendor);
      onClose();
    } else {
      setErrors({ vendorLoginGeneral: 'Username or password is incorrect.' });
    }
  };

  /* =========================================================================
     VENDOR SIGN-UP MULTI-STEP FLOW
     ========================================================================= */
  const handleVendorNextStep = async () => {
    const newErrors = {};

    if (vendorStep === 1) {
      setVendorStep(2);
      return;
    }

    if (vendorStep === 2) {
      if ((owns === 'hall' || owns === 'both') && !businessNameHall.trim()) {
        newErrors.businessNameHall = 'Name of the function hall is required.';
      }
      if ((owns === 'catering' || owns === 'both') && !businessNameCatering.trim()) {
        newErrors.businessNameCatering = 'Name of the catering service is required.';
      }
      if (!vendorName.trim()) {
        newErrors.vendorName = 'Your name is required.';
      }
      const cleanPhone = vendorPhone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
        newErrors.vendorPhone = 'Enter a valid 10-digit mobile number starting with 6-9.';
      }
      const cleanVendorUpi = vendorUpiId.trim();
      if (!cleanVendorUpi) {
        newErrors.vendorUpiId = 'Business UPI ID is required for direct payments.';
      } else if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanVendorUpi)) {
        newErrors.vendorUpiId = 'Enter a valid UPI ID (e.g. business@okaxis).';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      setErrors({});
      setVendorStep(3);
      return;
    }

    if (vendorStep === 3) {
      if (owns === 'hall' || owns === 'both') {
        if (!tradeLicenceNumber.trim()) {
          newErrors.tradeLicenceNumber = 'Trade licence number is required.';
        }
        if (!tradeLicenceFile) {
          newErrors.tradeLicenceFile = 'Please upload your trade licence document.';
        }
      }
      if (owns === 'catering' || owns === 'both') {
        if (!fssaiNumber.trim()) {
          newErrors.fssaiNumber = 'FSSAI licence number is required.';
        }
        if (!fssaiFile) {
          newErrors.fssaiFile = 'Please upload your FSSAI certificate.';
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      setErrors({});
      setVendorStep(4);
      runDocumentVerifications();
      return;
    }

    if (vendorStep === 4) {
      // Must be Verified or Needs manual review; cannot proceed if rejected
      const tradeOk = !tradeVerdict || tradeVerdict.status !== VERIFICATION_STATUSES.REJECTED;
      const fssaiOk = !fssaiVerdict || fssaiVerdict.status !== VERIFICATION_STATUSES.REJECTED;
      if (!tradeOk || !fssaiOk) {
        setErrors({ verification: 'Please fix or re-upload rejected documents before proceeding.' });
        return;
      }
      setErrors({});
      setVendorStep(5);
      return;
    }

    if (vendorStep === 5) {
      if (!termsAccepted) {
        setErrors({ terms: 'You must accept the Terms and Conditions to proceed.' });
        return;
      }
      setErrors({});
      setVendorStep(6);
      return;
    }
  };

  const runDocumentVerifications = async () => {
    setVerifyingDocs(true);
    setTradeVerdict(null);
    setFssaiVerdict(null);

    // Initial ticking checks
    const initialTradeChecks = [
      { id: '1', label: 'Reading the document…', done: true, passed: true },
      { id: '2', label: 'Checking the licence number format…', done: false, passed: false },
      { id: '3', label: 'Checking the document is clear and complete…', done: false, passed: false },
      { id: '4', label: 'Matching the business name…', done: false, passed: false },
      { id: '5', label: 'Checking it has not been used by another account…', done: false, passed: false }
    ];
    setTradeChecklist(initialTradeChecks);
    setFssaiChecklist(initialTradeChecks);

    // Ticking animation step-by-step
    for (let i = 1; i < 5; i++) {
      await new Promise(r => setTimeout(r, 600));
      setTradeChecklist(prev => prev.map((c, idx) => idx <= i ? { ...c, done: true, passed: true } : c));
      setFssaiChecklist(prev => prev.map((c, idx) => idx <= i ? { ...c, done: true, passed: true } : c));
    }

    // Run real verification adapter
    if (owns === 'hall' || owns === 'both') {
      const tv = await verifyDocument({
        type: 'trade_licence',
        number: tradeLicenceNumber,
        file: tradeLicenceFile,
        businessName: businessNameHall,
        existingLicenceNumbers: ['TL-DUPLICATE-999']
      });
      setTradeVerdict(tv);
      setTradeChecklist(tv.checks);
    }

    if (owns === 'catering' || owns === 'both') {
      const fv = await verifyDocument({
        type: 'fssai',
        number: fssaiNumber,
        file: fssaiFile,
        businessName: businessNameCatering,
        existingLicenceNumbers: ['19999999999999']
      });
      setFssaiVerdict(fv);
      setFssaiChecklist(fv.checks);
    }

    setVerifyingDocs(false);
  };

  const handleCreateVendorAccount = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const cleanUser = vendorUsername.trim().toLowerCase();
    const userTaken = await isUsernameTaken(cleanUser);
    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 20 || !/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      newErrors.vendorUsername = 'Username must be 3-20 characters (letters, numbers, underscore).';
    } else if (userTaken) {
      newErrors.vendorUsername = 'This username is already taken. Please choose another.';
    }

    if (vendorPassword.length < 8 || !/[a-zA-Z]/.test(vendorPassword) || !/[0-9]/.test(vendorPassword)) {
      newErrors.vendorPassword = 'Password must be at least 8 characters with a letter and a number.';
    }
    if (vendorPassword !== vendorConfirmPassword) {
      newErrors.vendorConfirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const res = await createVendorAccount({
      username: cleanUser,
      password: vendorPassword,
      name: vendorName.trim(),
      owns,
      businessNameHall,
      businessNameCatering,
      phone: vendorPhone.replace(/\D/g, ''),
      upiId: vendorUpiId.trim(),
      tradeLicenceNumber,
      fssaiNumber,
      tradeLicenceStatus: tradeVerdict?.status || 'Verified',
      fssaiStatus: fssaiVerdict?.status || 'Verified'
    });

    if (res.success) {
      setIsSuccess(true);
      if (onVendorLoginSuccess) onVendorLoginSuccess(res.vendor);
      else if (onLoginSuccess) onLoginSuccess(res.vendor);
      onClose();
    } else {
      setErrors({ vendorSubmit: res.error });
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !termsModalOpen) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card" style={{ maxWidth: '440px', width: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          &times;
        </button>

        {!isSuccess ? (
          <>
            {/* 1. TOP ROLE SWITCH: User vs Vendor */}
            <div
              className="auth-role-switch"
              style={{
                display: 'flex',
                background: 'color-mix(in srgb, var(--card) 85%, var(--ink))',
                border: '1.5px solid var(--line)',
                borderRadius: '99px',
                padding: '4px',
                marginBottom: '18px'
              }}
            >
              <button
                type="button"
                className={`auth-role-btn ${role === 'user' ? 'is-active' : ''}`}
                onClick={() => { setRole('user'); setErrors({}); }}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: '99px',
                  cursor: 'pointer',
                  fontSize: '0.92rem'
                }}
              >
                👤 User
              </button>
              <button
                type="button"
                className={`auth-role-btn ${role === 'vendor' ? 'is-active' : ''}`}
                onClick={() => { setRole('vendor'); setErrors({}); }}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: '99px',
                  cursor: 'pointer',
                  fontSize: '0.92rem'
                }}
              >
                🏛 Vendor
              </button>
            </div>

            {/* TAB SWITCH: Log In vs Sign Up (Segmented Tabs with Gold Active Fill) */}
            <div
              className="auth-mode-tabs"
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                background: 'color-mix(in srgb, var(--card) 90%, var(--bg))',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid var(--line)'
              }}
            >
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'login' ? 'is-active' : ''}`}
                onClick={() => { setMode('login'); setErrors({}); }}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontFamily: 'Yatra One, serif',
                  cursor: 'pointer'
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'signup' ? 'is-active' : ''}`}
                onClick={() => { setMode('signup'); setErrors({}); }}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontFamily: 'Yatra One, serif',
                  cursor: 'pointer'
                }}
              >
                Sign up free
              </button>
            </div>

            {/* =============================================================
                ROLE 1: USER FORMS (Maintained exactly as built)
                ============================================================= */}
            {role === 'user' && mode === 'signup' && (
              <form onSubmit={handleUserSignUpSubmit} noValidate>
                <div className="form-group">
                  <label className="field-label">Full name</label>
                  <input
                    type="text"
                    className={`vedika-input ${errors.name ? 'has-error' : ''}`}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.name && <p className="field-error">{errors.name}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Mobile number</label>
                  <div className={`phone-input-wrap ${errors.phone ? 'has-error' : ''}`}>
                    <span className="phone-prefix-chip">🇮🇳 +91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="vedika-input"
                      placeholder="Mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  {errors.phone && <p className="field-error">{errors.phone}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Email address</label>
                  <input
                    type="email"
                    className={`vedika-input ${errors.email ? 'has-error' : ''}`}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {errors.email && <p className="field-error">{errors.email}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Your location</label>
                  <LocationSelector value={location} onChange={setLocation} compact={true} />
                </div>

                <div className="form-group">
                  <label className="field-label">UPI ID (Optional)</label>
                  <input
                    type="text"
                    className={`vedika-input ${errors.upiId ? 'has-error' : ''}`}
                    placeholder="e.g. name@okhdfcbank"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                  {errors.upiId && <p className="field-error">{errors.upiId}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Create password</label>
                  <div className="input-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`vedika-input ${errors.password ? 'has-error' : ''}`}
                      placeholder="Min 8 characters (letters & numbers)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  {password && (
                    <div className="strength-bar-wrap">
                      <div className="strength-bar-fill" style={{ width: userStrength.width, backgroundColor: userStrength.color }} />
                    </div>
                  )}
                  {errors.password && <p className="field-error">{errors.password}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Confirm password</label>
                  <div className="input-container">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`vedika-input ${errors.confirmPassword ? 'has-error' : ''}`}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
                </div>

                <button type="submit" className="cta" style={{ width: '100%', marginTop: '10px' }}>
                  Create account
                </button>
              </form>
            )}

            {role === 'user' && mode === 'login' && (
              <form onSubmit={handleUserLoginSubmit} noValidate>
                {errors.loginGeneral && <div className="field-error general-alert">{errors.loginGeneral}</div>}

                <div className="form-group">
                  <label className="field-label">Mobile number</label>
                  <div className={`phone-input-wrap ${errors.loginPhone ? 'has-error' : ''}`}>
                    <span className="phone-prefix-chip">🇮🇳 +91</span>
                    <input
                      id="login-modal-phone"
                      type="tel"
                      maxLength={10}
                      className="vedika-input"
                      placeholder="Mobile number"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  {errors.loginPhone && <p className="field-error">{errors.loginPhone}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Password</label>
                  <div className="input-container">
                    <input
                      id="login-modal-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      className={`vedika-input ${errors.loginPassword ? 'has-error' : ''}`}
                      placeholder="Your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                      {showLoginPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  {errors.loginPassword && <p className="field-error">{errors.loginPassword}</p>}
                </div>

                <button type="submit" className="cta" style={{ width: '100%', marginTop: '10px' }}>
                  Log in
                </button>
              </form>
            )}

            {/* =============================================================
                ROLE 2: VENDOR LOGIN FORM
                ============================================================= */}
            {role === 'vendor' && mode === 'login' && (
              <form onSubmit={handleVendorLoginSubmit} noValidate>
                {errors.vendorLoginGeneral && <div className="field-error general-alert">{errors.vendorLoginGeneral}</div>}

                <div className="form-group">
                  <label className="field-label">Vendor Username</label>
                  <input
                    id="vendor-login-username"
                    type="text"
                    className={`vedika-input ${errors.vendorLoginUsername ? 'has-error' : ''}`}
                    placeholder="e.g. sai_halls"
                    value={vendorLoginUsername}
                    onChange={(e) => setVendorLoginUsername(e.target.value)}
                  />
                  {errors.vendorLoginUsername && <p className="field-error">{errors.vendorLoginUsername}</p>}
                </div>

                <div className="form-group">
                  <label className="field-label">Password</label>
                  <div className="input-container">
                    <input
                      id="vendor-login-password"
                      type={showVendorLoginPassword ? 'text' : 'password'}
                      className={`vedika-input ${errors.vendorLoginPassword ? 'has-error' : ''}`}
                      placeholder="Your password (e.g. Vedika@123)"
                      value={vendorLoginPassword}
                      onChange={(e) => setVendorLoginPassword(e.target.value)}
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowVendorLoginPassword(!showVendorLoginPassword)}>
                      {showVendorLoginPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  {errors.vendorLoginPassword && <p className="field-error">{errors.vendorLoginPassword}</p>}
                </div>

                <div style={{ textAlign: 'right', marginTop: '-4px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setForgotDemoMsg(true)}
                    style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Forgot password?
                  </button>
                  {forgotDemoMsg && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--leaf)', marginTop: '4px' }}>
                      Demo: Default test vendor is <b>sai_halls</b> / <b>Vedika@123</b>
                    </div>
                  )}
                </div>

                <button type="submit" className="cta" style={{ width: '100%', marginTop: '6px' }}>
                  Log in
                </button>
              </form>
            )}

            {/* =============================================================
                ROLE 2: VENDOR SIGN-UP 6-STEP WIZARD
                ============================================================= */}
            {role === 'vendor' && mode === 'signup' && (
              <div>
                {/* Gold Progress Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                    <span>Step {vendorStep} of 6</span>
                    <span>
                      {vendorStep === 1 && 'Business Type'}
                      {vendorStep === 2 && 'Business Details'}
                      {vendorStep === 3 && 'Upload Documents'}
                      {vendorStep === 4 && 'AI Verification'}
                      {vendorStep === 5 && 'Terms & Conditions'}
                      {vendorStep === 6 && 'Set Login'}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--line)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${(vendorStep / 6) * 100}%`, height: '100%', background: 'var(--gold)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* STEP 1: What do you own? */}
                {vendorStep === 1 && (
                  <div>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '6px' }}>
                      What do you own?
                    </h3>
                    <p style={{ fontSize: '0.86rem', color: 'var(--muted)', marginBottom: '16px' }}>
                      Choose the celebration services you provide on UstavOne.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { id: 'hall', label: '🏛 Function hall', sub: 'Convention centers, mandapams, banquet halls' },
                        { id: 'catering', label: '🍽 Catering', sub: 'Traditional banana leaf, buffet & live counters' },
                        { id: 'both', label: '🏛🍽 Both', sub: 'Provide both venue and gourmet food services' }
                      ].map(card => (
                        <div
                          key={card.id}
                          onClick={() => setOwns(card.id)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: '16px',
                            border: owns === card.id ? '2px solid var(--gold)' : '1.5px solid var(--line)',
                            background: owns === card.id ? 'color-mix(in srgb, var(--gold) 12%, var(--card))' : 'var(--bg)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <strong style={{ fontSize: '1.02rem', color: 'var(--text)' }}>{card.label}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{card.sub}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" className="cta" onClick={handleVendorNextStep}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Business & Owner Details */}
                {vendorStep === 2 && (
                  <div>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '6px' }}>
                      Business & Owner Details
                    </h3>

                    {(owns === 'hall' || owns === 'both') && (
                      <div className="form-group">
                        <label className="field-label">Name of the function hall</label>
                        <input
                          type="text"
                          className={`vedika-input ${errors.businessNameHall ? 'has-error' : ''}`}
                          placeholder="e.g. Sri Venkateswara Mandapam"
                          value={businessNameHall}
                          onChange={(e) => setBusinessNameHall(e.target.value)}
                        />
                        {errors.businessNameHall && <p className="field-error">{errors.businessNameHall}</p>}
                      </div>
                    )}

                    {(owns === 'catering' || owns === 'both') && (
                      <div className="form-group">
                        <label className="field-label">Name of the catering service</label>
                        <input
                          type="text"
                          className={`vedika-input ${errors.businessNameCatering ? 'has-error' : ''}`}
                          placeholder="e.g. Annapurna Caterers"
                          value={businessNameCatering}
                          onChange={(e) => setBusinessNameCatering(e.target.value)}
                        />
                        {errors.businessNameCatering && <p className="field-error">{errors.businessNameCatering}</p>}
                      </div>
                    )}

                    <div className="form-group">
                      <label className="field-label">Your name</label>
                      <input
                        type="text"
                        className={`vedika-input ${errors.vendorName ? 'has-error' : ''}`}
                        placeholder="Owner or Manager full name"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                      />
                      {errors.vendorName && <p className="field-error">{errors.vendorName}</p>}
                    </div>

                    <div className="form-group">
                      <label className="field-label">Mobile number</label>
                      <div className={`phone-input-wrap ${errors.vendorPhone ? 'has-error' : ''}`}>
                        <span className="phone-prefix-chip">🇮🇳 +91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          className="vedika-input"
                          placeholder="10-digit mobile number"
                          value={vendorPhone}
                          onChange={(e) => setVendorPhone(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      {errors.vendorPhone && <p className="field-error">{errors.vendorPhone}</p>}
                    </div>

                    <div className="form-group">
                      <label className="field-label">Business UPI ID * (for receiving direct customer payments)</label>
                      <input
                        type="text"
                        className={`vedika-input ${errors.vendorUpiId ? 'has-error' : ''}`}
                        placeholder="e.g. yourbusiness@okaxis"
                        value={vendorUpiId}
                        onChange={(e) => setVendorUpiId(e.target.value)}
                      />
                      {errors.vendorUpiId && <p className="field-error">{errors.vendorUpiId}</p>}
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" className="pill" onClick={() => setVendorStep(1)}>
                        ← Back
                      </button>
                      <button type="button" className="cta" onClick={handleVendorNextStep}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Documents Upload */}
                {vendorStep === 3 && (
                  <div>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '6px' }}>
                      Upload Government Licences
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '14px' }}>
                      PDF, JPG, or PNG up to 5 MB.
                    </p>

                    {(owns === 'hall' || owns === 'both') && (
                      <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '8px' }}>
                          🏛 Function Hall Trade Licence
                        </div>
                        <input
                          type="text"
                          className="vedika-input"
                          placeholder="Trade Licence Number (6-20 chars)"
                          value={tradeLicenceNumber}
                          onChange={(e) => setTradeLicenceNumber(e.target.value)}
                          style={{ marginBottom: '10px' }}
                        />
                        {errors.tradeLicenceNumber && <p className="field-error">{errors.tradeLicenceNumber}</p>}

                        <input
                          type="file"
                          accept=".pdf,image/*"
                          id="trade-upload"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setTradeLicenceFile(f);
                              if (f.type.startsWith('image/')) {
                                setTradeLicencePreview(URL.createObjectURL(f));
                              } else {
                                setTradeLicencePreview('PDF');
                              }
                            }
                          }}
                        />

                        {!tradeLicenceFile ? (
                          <label htmlFor="trade-upload" className="pill" style={{ cursor: 'pointer', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                            📁 Upload Trade Licence
                          </label>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{ fontSize: '1.2rem' }}>{tradeLicencePreview === 'PDF' ? '📄' : '🖼️'}</span>
                              <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <strong>{tradeLicenceFile.name}</strong> ({(tradeLicenceFile.size / 1024).toFixed(0)} KB)
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <label htmlFor="trade-upload" style={{ color: 'var(--gold)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Replace</label>
                              <button type="button" onClick={() => { setTradeLicenceFile(null); setTradeLicencePreview(null); }} style={{ background: 'none', border: 0, color: 'var(--rose)', fontSize: '0.78rem', cursor: 'pointer' }}>Remove</button>
                            </div>
                          </div>
                        )}
                        {errors.tradeLicenceFile && <p className="field-error">{errors.tradeLicenceFile}</p>}
                      </div>
                    )}

                    {(owns === 'catering' || owns === 'both') && (
                      <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '8px' }}>
                          🍽 Catering FSSAI Certificate
                        </div>
                        <input
                          type="text"
                          maxLength={14}
                          className="vedika-input"
                          placeholder="FSSAI Number (14 digits starting with 1 or 2)"
                          value={fssaiNumber}
                          onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, ''))}
                          style={{ marginBottom: '10px' }}
                        />
                        {errors.fssaiNumber && <p className="field-error">{errors.fssaiNumber}</p>}

                        <input
                          type="file"
                          accept=".pdf,image/*"
                          id="fssai-upload"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setFssaiFile(f);
                              if (f.type.startsWith('image/')) {
                                setFssaiPreview(URL.createObjectURL(f));
                              } else {
                                setFssaiPreview('PDF');
                              }
                            }
                          }}
                        />

                        {!fssaiFile ? (
                          <label htmlFor="fssai-upload" className="pill" style={{ cursor: 'pointer', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                            📁 Upload FSSAI Certificate
                          </label>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{ fontSize: '1.2rem' }}>{fssaiPreview === 'PDF' ? '📄' : '🖼️'}</span>
                              <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <strong>{fssaiFile.name}</strong> ({(fssaiFile.size / 1024).toFixed(0)} KB)
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <label htmlFor="fssai-upload" style={{ color: 'var(--gold)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Replace</label>
                              <button type="button" onClick={() => { setFssaiFile(null); setFssaiPreview(null); }} style={{ background: 'none', border: 0, color: 'var(--rose)', fontSize: '0.78rem', cursor: 'pointer' }}>Remove</button>
                            </div>
                          </div>
                        )}
                        {errors.fssaiFile && <p className="field-error">{errors.fssaiFile}</p>}
                      </div>
                    )}

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" className="pill" onClick={() => setVendorStep(2)}>
                        ← Back
                      </button>
                      <button type="button" className="cta" onClick={handleVendorNextStep}>
                        Verify my documents →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: AI Document Verification */}
                {vendorStep === 4 && (
                  <div>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '4px' }}>
                      Verified by UstavOne AI (pre-check)
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '16px' }}>
                      Automated security validation of licence numbers and document clarity.
                    </p>

                    {/* Trade Licence Checklist */}
                    {(owns === 'hall' || owns === 'both') && (
                      <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong>🏛 Trade Licence</strong>
                          {tradeVerdict ? (
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: tradeVerdict.status === 'Verified' ? 'var(--leaf)' : tradeVerdict.status === 'Needs manual review' ? '#FFA62B' : 'var(--rose)'
                            }}>
                              {tradeVerdict.status === 'Verified' ? '✅ Verified' : tradeVerdict.status === 'Needs manual review' ? '🟡 Under review' : '❌ Could not verify'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>Checking…</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                          {tradeChecklist.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{c.done ? (c.passed ? '✓' : '✗') : '○'}</span>
                              <span style={{ color: c.done ? (c.passed ? 'var(--text)' : 'var(--rose)') : 'var(--muted)' }}>{c.label}</span>
                            </div>
                          ))}
                        </div>

                        {tradeVerdict?.reasons?.length > 0 && (
                          <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(181, 23, 59, 0.08)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--rose)' }}>
                            {tradeVerdict.reasons.join(' ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* FSSAI Checklist */}
                    {(owns === 'catering' || owns === 'both') && (
                      <div style={{ background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong>🍽 FSSAI Certificate</strong>
                          {fssaiVerdict ? (
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: fssaiVerdict.status === 'Verified' ? 'var(--leaf)' : fssaiVerdict.status === 'Needs manual review' ? '#FFA62B' : 'var(--rose)'
                            }}>
                              {fssaiVerdict.status === 'Verified' ? '✅ Verified' : fssaiVerdict.status === 'Needs manual review' ? '🟡 Under review' : '❌ Could not verify'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>Checking…</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                          {fssaiChecklist.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{c.done ? (c.passed ? '✓' : '✗') : '○'}</span>
                              <span style={{ color: c.done ? (c.passed ? 'var(--text)' : 'var(--rose)') : 'var(--muted)' }}>{c.label}</span>
                            </div>
                          ))}
                        </div>

                        {fssaiVerdict?.reasons?.length > 0 && (
                          <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(181, 23, 59, 0.08)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--rose)' }}>
                            {fssaiVerdict.reasons.join(' ')}
                          </div>
                        )}
                      </div>
                    )}

                    {errors.verification && <p className="field-error" style={{ marginBottom: '12px' }}>{errors.verification}</p>}

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" className="pill" onClick={() => setVendorStep(3)}>
                        ← Back
                      </button>
                      <button
                        type="button"
                        className="cta"
                        disabled={verifyingDocs || (tradeVerdict?.status === 'Could not verify') || (fssaiVerdict?.status === 'Could not verify')}
                        onClick={handleVendorNextStep}
                        style={{
                          opacity: (verifyingDocs || (tradeVerdict?.status === 'Could not verify') || (fssaiVerdict?.status === 'Could not verify')) ? 0.6 : 1,
                          cursor: (verifyingDocs || (tradeVerdict?.status === 'Could not verify') || (fssaiVerdict?.status === 'Could not verify')) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: Terms & Conditions */}
                {vendorStep === 5 && (
                  <div>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '8px' }}>
                      Partner Agreement
                    </h3>
                    <p style={{ fontSize: '0.86rem', color: 'var(--muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                      UstavOne connects you with genuine customers while handling customer payments and date scheduling.
                    </p>

                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--bg)',
                        border: '1.5px solid var(--line)',
                        borderRadius: '16px',
                        marginBottom: '16px'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--gold)' }}
                        />
                        <span>
                          I have read and accept the{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setTermsModalOpen(true);
                            }}
                            style={{ background: 'none', border: 0, color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            Terms and Conditions
                          </button>
                        </span>
                      </label>
                    </div>

                    {errors.terms && <p className="field-error">{errors.terms}</p>}

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" className="pill" onClick={() => setVendorStep(4)}>
                        ← Back
                      </button>
                      <button
                        type="button"
                        className="cta"
                        disabled={!termsAccepted}
                        onClick={handleVendorNextStep}
                        style={{ opacity: !termsAccepted ? 0.6 : 1, cursor: !termsAccepted ? 'not-allowed' : 'pointer' }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 6: Set Login */}
                {vendorStep === 6 && (
                  <form onSubmit={handleCreateVendorAccount} noValidate>
                    <h3 style={{ fontFamily: 'Yatra One', fontSize: '1.25rem', color: 'var(--text)', marginBottom: '6px' }}>
                      Set Your Login Credentials
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '14px' }}>
                      You will use this username and password to log in to your vendor portal.
                    </p>

                    <div className="form-group">
                      <label className="field-label">Username</label>
                      <input
                        type="text"
                        className={`vedika-input ${errors.vendorUsername ? 'has-error' : ''}`}
                        placeholder="3-20 characters (e.g. sai_halls)"
                        value={vendorUsername}
                        onChange={(e) => setVendorUsername(e.target.value)}
                      />
                      {usernameAvailability === true && (
                        <p style={{ color: 'var(--leaf)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>
                          Username is available ✓
                        </p>
                      )}
                      {usernameAvailability === false && (
                        <p style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>
                          Username is already taken.
                        </p>
                      )}
                      {errors.vendorUsername && <p className="field-error">{errors.vendorUsername}</p>}
                    </div>

                    <div className="form-group">
                      <label className="field-label">Password</label>
                      <div className="input-container">
                        <input
                          type={showVendorPassword ? 'text' : 'password'}
                          className={`vedika-input ${errors.vendorPassword ? 'has-error' : ''}`}
                          placeholder="Min 8 characters (letters & numbers)"
                          value={vendorPassword}
                          onChange={(e) => setVendorPassword(e.target.value)}
                        />
                        <button type="button" className="password-toggle-btn" onClick={() => setShowVendorPassword(!showVendorPassword)}>
                          {showVendorPassword ? '👁️' : '🙈'}
                        </button>
                      </div>
                      {vendorPassword && (
                        <div className="strength-bar-wrap">
                          <div className="strength-bar-fill" style={{ width: vendorStrength.width, backgroundColor: vendorStrength.color }} />
                        </div>
                      )}
                      {errors.vendorPassword && <p className="field-error">{errors.vendorPassword}</p>}
                    </div>

                    <div className="form-group">
                      <label className="field-label">Confirm password</label>
                      <div className="input-container">
                        <input
                          type={showVendorConfirmPassword ? 'text' : 'password'}
                          className={`vedika-input ${errors.vendorConfirmPassword ? 'has-error' : ''}`}
                          placeholder="Re-enter password"
                          value={vendorConfirmPassword}
                          onChange={(e) => setVendorConfirmPassword(e.target.value)}
                        />
                        <button type="button" className="password-toggle-btn" onClick={() => setShowVendorConfirmPassword(!showVendorConfirmPassword)}>
                          {showVendorConfirmPassword ? '👁️' : '🙈'}
                        </button>
                      </div>
                      {errors.vendorConfirmPassword && <p className="field-error">{errors.vendorConfirmPassword}</p>}
                    </div>

                    {errors.vendorSubmit && <p className="field-error">{errors.vendorSubmit}</p>}

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <button type="button" className="pill" onClick={() => setVendorStep(5)}>
                        ← Back
                      </button>
                      <button type="submit" className="cta">
                        Create vendor account
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        ) : (
          /* ================= SUCCESS PANEL ================= */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '3.2rem', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ fontFamily: 'Yatra One', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '8px' }}>
              Welcome, {vendorName || name}!
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Your vendor partner account has been created.
              {tradeVerdict && <div>Trade Licence: <b>{tradeVerdict.status}</b></div>}
              {fssaiVerdict && <div>FSSAI: <b>{fssaiVerdict.status}</b></div>}
            </p>

            <button
              type="button"
              className="cta"
              onClick={() => {
                onClose();
                window.location.hash = role === 'vendor' ? '#/v/home' : '#/dashboard';
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Go to my dashboard →
            </button>
          </div>
        )}
      </div>

      {/* Small Centered Terms and Conditions Window */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}
