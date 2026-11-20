import React, { useState, useRef } from 'react';
import LocationSelector from './LocationSelector.jsx';
import { updateUserProfile, changeUserPassword, isPhoneTaken } from '../services/store.js';

export default function DetailsPage({
  user,
  onBack,
  onUserUpdated
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form State
  const [name, setName] = useState(user?.name || 'D L Narasimha sai');
  const [phone, setPhone] = useState(user?.phone || '9390075877');
  const [email, setEmail] = useState(user?.email || 'narasimhasai@gmail.com');
  const [upiId, setUpiId] = useState(user?.upiId || 'narasimhasai@okhdfcbank');
  const [photo, setPhoto] = useState(user?.photo || null);
  const [location, setLocation] = useState({
    city: user?.city || user?.location?.city || 'Kadapa',
    state: user?.state || user?.location?.state || 'Andhra Pradesh',
    pincode: user?.pincode || user?.location?.pincode || '516001',
    source: user?.location?.source || 'manual'
  });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // Password strength calculation
  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-zA-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score++;
    if (score <= 1) return { score: 1, label: 'Weak', color: 'var(--rose)', width: '33%' };
    if (score === 2) return { score: 2, label: 'Fair', color: '#FFA62B', width: '66%' };
    return { score: 3, label: 'Strong', color: 'var(--leaf)', width: '100%' };
  };

  const strength = calculateStrength(newPassword);

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setPhoto(dataUrl);
      // If not currently in editing mode, auto-save photo immediately
      if (!isEditing) {
        updateUserProfile(user.phone, { photo: dataUrl }).then(res => {
          if (res.success) {
            onUserUpdated(res.user);
            showToast('Profile photo updated ✓');
          }
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    if (!isEditing) {
      updateUserProfile(user.phone, { photo: null }).then(res => {
        if (res.success) {
          onUserUpdated(res.user);
          showToast('Profile photo removed ✓');
        }
      });
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleCancelEdit = () => {
    // Reset fields to current user values
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setEmail(user?.email || '');
    setUpiId(user?.upiId || '');
    setPhoto(user?.photo || null);
    setLocation({
      city: user?.city || user?.location?.city || 'Kadapa',
      state: user?.state || user?.location?.state || 'Andhra Pradesh',
      pincode: user?.pincode || user?.location?.pincode || '',
      source: 'manual'
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setIsEditing(false);
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    const newErrors = {};

    // Name validation
    if (!name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    // Phone validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'Mobile number is required.';
    } else if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number starting with 6-9.';
    } else if (cleanPhone !== user?.phone && isPhoneTaken(cleanPhone, user?.phone)) {
      newErrors.phone = 'This mobile number is already registered by another account.';
    }

    // Email validation
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    // UPI ID validation (optional, format check)
    const cleanUpi = upiId.trim();
    if (cleanUpi && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      newErrors.upiId = 'Enter a valid UPI ID (e.g. name@okhdfcbank).';
    }

    // Password validation (if user entered new password)
    if (newPassword || currentPassword) {
      if (!currentPassword) {
        newErrors.currentPassword = 'Enter your current password to set a new password.';
      }
      if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        newErrors.newPassword = 'Password must be at least 8 characters with a letter and a number.';
      }
      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle password change if requested
    if (newPassword && currentPassword) {
      const pwdRes = await changeUserPassword(user.phone, currentPassword, newPassword);
      if (!pwdRes.success) {
        setErrors({ currentPassword: pwdRes.error || 'Current password is incorrect.' });
        return;
      }
    }

    // Update profile
    const profileRes = await updateUserProfile(user.phone, {
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim(),
      upiId: cleanUpi,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      location,
      photo
    });

    if (profileRes.success) {
      onUserUpdated(profileRes.user);
      setIsEditing(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      showToast('Details saved successfully ✓');
    } else {
      setErrors({ general: profileRes.error });
    }
  };

  const avatarLetter = (name && name.includes('Narasimha')) ? 'N' : (name ? name.charAt(0).toUpperCase() : 'N');

  return (
    <div className="wrap" style={{ padding: '24px 4vw 80px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            right: '20px',
            background: 'var(--leaf)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 99,
            fontWeight: 600,
            animation: 'popIn 0.3s ease-out'
          }}
          role="status"
        >
          {toastMessage}
        </div>
      )}

      {/* Header Bar with Back Arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'transparent', border: 0, fontSize: '1.2rem', cursor: 'pointer', color: 'var(--ink)' }}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: 'Yatra One', fontSize: '1.6rem', color: 'var(--ink)', margin: 0 }}>
          Your details
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <div className="panel" style={{ padding: '28px' }}>
        {/* Profile Photo Block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '24px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
          <div
            style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'var(--gold)',
              color: '#3A0A1E',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'Yatra One',
              fontSize: '2.5rem',
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              flexShrink: 0
            }}
          >
            {photo ? (
              <img src={photo} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              avatarLetter
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>Profile Photo</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '4px 0 10px' }}>
              Upload your photo to personalize your Vedika experience.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--line)',
                  background: 'var(--card)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Change photo
              </button>

              {photo && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--rose)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Read-Only or Editable Form */}
        <form onSubmit={handleSaveDetails} noValidate>
          {errors.general && (
            <div style={{ color: 'var(--rose)', marginBottom: '14px', fontSize: '0.9rem' }}>
              ⚠️ {errors.general}
            </div>
          )}

          {/* Full Name */}
          <div className="row" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
              Full name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '0.95rem' }}
              />
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', fontWeight: 600 }}>
                {name}
              </div>
            )}
            {errors.name && <div style={{ color: 'var(--rose)', fontSize: '0.82rem', marginTop: '4px' }}>{errors.name}</div>}
          </div>

          {/* Mobile Number */}
          <div className="row" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
              Mobile number
            </label>
            {isEditing ? (
              <div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ padding: '10px 12px', background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: '10px', fontWeight: 600 }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength="10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '0.95rem' }}
                  />
                </div>
                {phone !== user?.phone && (
                  <div style={{ color: 'var(--gold)', fontSize: '0.8rem', marginTop: '4px' }}>
                    ⚠️ You will use the new number to log in.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', fontWeight: 600 }}>
                +91 {phone}
              </div>
            )}
            {errors.phone && <div style={{ color: 'var(--rose)', fontSize: '0.82rem', marginTop: '4px' }}>{errors.phone}</div>}
          </div>

          {/* Email Address */}
          <div className="row" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
              Email address
            </label>
            {isEditing ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '0.95rem' }}
              />
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', fontWeight: 600 }}>
                {email}
              </div>
            )}
            {errors.email && <div style={{ color: 'var(--rose)', fontSize: '0.82rem', marginTop: '4px' }}>{errors.email}</div>}
          </div>

          {/* UPI ID */}
          <div className="row" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
              UPI ID (Optional)
            </label>
            {isEditing ? (
              <input
                type="text"
                placeholder="e.g. name@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--line)', fontSize: '0.95rem' }}
              />
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', fontWeight: 600 }}>
                {upiId ? `🔗 ${upiId}` : 'Not set'}
              </div>
            )}
            {errors.upiId && <div style={{ color: 'var(--rose)', fontSize: '0.82rem', marginTop: '4px' }}>{errors.upiId}</div>}
          </div>

          {/* Location & Address */}
          <div className="row" style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
              Your location
            </label>
            {isEditing ? (
              <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '14px', background: 'var(--bg)' }}>
                <LocationSelector
                  value={location}
                  onChange={(newLoc) => setLocation(newLoc)}
                  compact={true}
                />
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '10px', fontWeight: 600 }}>
                📍 {location.city}, {location.state} {location.pincode ? `(${location.pincode})` : ''}
              </div>
            )}
          </div>

          {/* Change Password Section (available in edit mode) */}
          {isEditing && (
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--ink)', marginBottom: '12px' }}>
                Change password (optional)
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Current password</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    placeholder="Enter current password"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
                    {showCurrentPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.currentPassword && <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '4px' }}>{errors.currentPassword}</div>}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>New password</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    placeholder="Min 8 chars with letter & number"
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {newPassword && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ height: '4px', background: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: strength.width, background: strength.color, height: '100%', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                  </div>
                )}
                {errors.newPassword && <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '4px' }}>{errors.newPassword}</div>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  placeholder="Repeat new password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
                {errors.confirmPassword && <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '4px' }}>{errors.confirmPassword}</div>}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '2px solid var(--ink)',
                  background: 'transparent',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                ✏ Edit details
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--line)',
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 0,
                    background: 'var(--gold)',
                    color: '#3A0A1E',
                    fontFamily: 'Yatra One',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    boxShadow: '0 0 0 3px rgba(232, 184, 74, 0.4)'
                  }}
                >
                  Save changes
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
