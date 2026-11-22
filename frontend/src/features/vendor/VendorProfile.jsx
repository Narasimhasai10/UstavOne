import React, { useState, useEffect } from 'react';
import {
  getCurrentVendor,
  setCurrentVendor,
  updateVendorProfile,
  changeVendorPassword,
  vendorLogout,
  isUsernameTaken
} from '../../shared/data-service/index.js';
import { compressImage, savePhoto } from '../../shared/utils/photos.js';

export default function VendorProfile({ vendor, onVendorUpdated, onLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Profile fields state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    email: '',
    upiId: '',
    hallName: '',
    cateringName: '',
    avatarUrl: ''
  });

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Logo file upload
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        username: vendor.username || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        upiId: vendor.upiId || 'sai.halls@okaxis',
        hallName: vendor.hallName || vendor.businessName || '',
        cateringName: vendor.cateringName || '',
        avatarUrl: vendor.avatarUrl || ''
      });
    }
  }, [vendor]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Password strength calculation
  const getPasswordStrength = (pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score += 30;
    if (/[A-Z]/.test(pw)) score += 20;
    if (/[a-z]/.test(pw)) score += 20;
    if (/[0-9]/.test(pw)) score += 20;
    if (/[^A-Za-z0-9]/.test(pw)) score += 10;
    return Math.min(score, 100);
  };

  const pwStrength = getPasswordStrength(newPassword);

  // Handle Logo Upload
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    setUploadingLogo(true);
    try {
      const compressedDataUrl = await compressImage(file, 400, 0.85);
      const photoId = await savePhoto(compressedDataUrl);
      setFormData(prev => ({ ...prev, avatarUrl: compressedDataUrl }));
    } catch (err) {
      alert('Failed to process image: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Save Profile Changes
  const handleSaveProfile = async () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.phone.trim() || !/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Valid 10-digit mobile number starting 6-9 is required';
    }

    const cleanUpi = (formData.upiId || '').trim();
    if (!cleanUpi) {
      newErrors.upiId = 'Business UPI ID is required';
    } else if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
      newErrors.upiId = 'Valid UPI ID (e.g. name@bank) is required';
    }

    // Check unique username if changed
    if (formData.username !== vendor.username) {
      const taken = await isUsernameTaken(formData.username, vendor.username);
      if (taken) {
        newErrors.username = 'This username is already taken';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const updates = {
      name: formData.name,
      username: formData.username,
      phone: formData.phone,
      email: formData.email,
      upiId: cleanUpi,
      hallName: formData.hallName,
      cateringName: formData.cateringName,
      businessName: formData.hallName || formData.cateringName,
      avatarUrl: formData.avatarUrl
    };

    const updated = await updateVendorProfile(vendor.username, updates);
    if (onVendorUpdated) onVendorUpdated(updated);
    setIsEditing(false);
    showToast('Profile updated successfully ✓');
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must be at least 8 characters with at least one letter and one number');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const res = await changeVendorPassword(vendor.username, currentPassword, newPassword);
    if (res.success) {
      setPasswordSuccess('Password changed successfully ✓');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated ✓');
    } else {
      setPasswordError(res.message || 'Incorrect current password');
    }
  };

  if (!vendor) return null;

  return (
    <div className="vedika-vendor-page fade-in" style={{ padding: '24px 0 80px' }}>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(234, 171, 80, 0.31)',
            color: 'var(--vendor-btn-text, #f8ebd8)',
            padding: '12px 22px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontWeight: 600,
            fontSize: '14px',
            border: '1px solid var(--gold)'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Header & Edit Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Yatra One, serif', fontSize: '28px', color: '#f8ebd8', margin: '0 0 6px' }}>
            Vendor Profile & Settings
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '15px' }}>
            Manage your registered business credentials, contact info, security and verification badges.
          </p>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="vedika-btn pulse-gold"
            style={{
              background: 'var(--gold)',
              color: '#3A0A1E',
              fontWeight: 700,
              padding: '10px 22px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ✏ Edit details
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="vedika-btn"
              style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', padding: '8px 18px', borderRadius: '999px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="vedika-btn pulse-gold"
              style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700, border: 'none', padding: '8px 22px', borderRadius: '999px' }}
            >
              💾 Save changes
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div
        className="vedika-card"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}
      >
        {/* Avatar / Logo Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--line)' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: formData.avatarUrl ? `url(${formData.avatarUrl}) center/cover no-repeat` : 'rgba(234, 171, 80, 0.31)',
              color: 'var(--vendor-btn-text, #f8ebd8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontFamily: 'Yatra One, serif',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '2px solid var(--gold)'
            }}
          >
            {!formData.avatarUrl && (vendor.name?.[0] || 'V')}
          </div>

          <div>
            <h2 style={{ fontFamily: 'Yatra One, serif', fontSize: '22px', color: '#f8ebd8', margin: '0 0 4px' }}>
              {vendor.businessName || vendor.hallName || vendor.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: 'var(--leaf)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px'
                }}
              >
                ✓ Verified Vendor
              </span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                @{vendor.username} · Member since {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : '2025'}
              </span>
            </div>

            {isEditing && (
              <div style={{ marginTop: '10px' }}>
                <label
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-block'
                  }}
                >
                  📷 Change Logo / Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Details Grid: Read-Only OR Edit Form */}
        {!isEditing ? (
          /* READ-ONLY VIEW */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Owner Full Name
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                {vendor.name}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Mobile Number
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                🇮🇳 +91 {vendor.phone}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Owned Business Type
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)', textTransform: 'capitalize' }}>
                {vendor.businessType === 'both' ? '🏛🍽 Function Hall & Catering' : vendor.businessType === 'hall' ? '🏛 Function Hall' : '🍽 Catering Service'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Username
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                {vendor.username}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Business UPI ID
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                🔗 {vendor.upiId || 'sai.halls@okaxis'}
              </div>
            </div>

            {vendor.hallName && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Hall Business Name
                </div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                  {vendor.hallName}
                </div>
              </div>
            )}

            {vendor.cateringName && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Catering Business Name
                </div>
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                  {vendor.cateringName}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Document Verification Status
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <span style={{ background: '#E8F5E9', color: 'var(--leaf)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                  ✓ Trade Licence: Verified
                </span>
                {vendor.businessType === 'both' && (
                  <span style={{ background: '#E8F5E9', color: 'var(--leaf)', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                    ✓ FSSAI: Verified
                  </span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Policy Warnings
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: (vendor.warnings || 0) > 0 ? 'var(--rose)' : 'var(--leaf)' }}>
                {vendor.warnings || 0} violations recorded (Limit: 3)
              </div>
            </div>
          </div>
        ) : (
          /* EDITABLE FORM */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
                {errors.name && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{errors.name}</span>}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Mobile Number *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ padding: '10px 12px', background: 'var(--line)', borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    className="vedika-input"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                  />
                </div>
                {errors.phone && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{errors.phone}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
                {errors.username && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{errors.username}</span>}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="vedika-input"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Business UPI ID *
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  placeholder="e.g. yourbusiness@okaxis"
                  value={formData.upiId}
                  onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
                {errors.upiId && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{errors.upiId}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Hall Business Name
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  value={formData.hallName}
                  onChange={e => setFormData({ ...formData, hallName: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                  Catering Business Name
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  value={formData.cateringName}
                  onChange={e => setFormData({ ...formData, cateringName: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="vedika-btn"
                style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', padding: '8px 20px', borderRadius: '999px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="vedika-btn pulse-gold"
                style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700, border: 'none', padding: '8px 24px', borderRadius: '999px' }}
              >
                💾 Save changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div
        className="vedika-card"
        style={{
          background: 'var(--card)',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          padding: '28px',
          marginBottom: '28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}
      >
        <h3 style={{ fontFamily: 'Yatra One, serif', fontSize: '18px', color: '#f8ebd8', margin: '0 0 16px' }}>
          🔒 Security & Password
        </h3>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
              Current Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrentPw ? 'text' : 'password'}
                className="vedika-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                style={{ position: 'absolute', right: '12px', top: '10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {showCurrentPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                New Password (min 8 chars, letter + number) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  className="vedika-input"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  style={{ position: 'absolute', right: '12px', top: '10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {showNewPw ? '🙈' : '👁'}
                </button>
              </div>

              {/* Strength bar */}
              {newPassword && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ height: '4px', background: 'var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pwStrength}%`,
                        background: pwStrength < 50 ? 'var(--rose)' : pwStrength < 80 ? 'var(--gold)' : 'var(--leaf)',
                        transition: 'width 0.3s'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {pwStrength < 50 ? 'Weak' : pwStrength < 80 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                Confirm New Password *
              </label>
              <input
                type="password"
                className="vedika-input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
              />
            </div>
          </div>

          {passwordError && (
            <div style={{ color: 'var(--rose)', fontSize: '13px', fontWeight: 600 }}>
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div style={{ color: 'var(--leaf)', fontSize: '13px', fontWeight: 600 }}>
              {passwordSuccess}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="vedika-btn"
              style={{
                background: 'rgba(234, 171, 80, 0.31)',
                color: 'var(--vendor-btn-text, #f8ebd8)',
                border: '1px solid rgba(232, 184, 74, 0.3)',
                padding: '10px 24px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Logout Action */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => {
            vendorLogout();
            if (onLogout) onLogout();
            window.location.hash = '#/home';
          }}
          className="vedika-btn"
          style={{
            background: 'transparent',
            color: 'var(--rose)',
            border: '1px solid var(--rose)',
            padding: '10px 32px',
            borderRadius: '999px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ↩ Log out of Vendor account
        </button>
      </div>
    </div>
  );
}
