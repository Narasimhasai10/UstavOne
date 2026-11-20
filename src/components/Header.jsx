import React, { useState, useRef, useEffect } from 'react';
import LocationPopover from './LocationPopover.jsx';

export default function Header({
  user,
  onLogout,
  onOpenLocationModal
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const avatarRef = useRef(null);
  const menuRef = useRef(null);
  const itemsRef = useRef([]);

  const userCity = user?.city || user?.location?.city || 'Kadapa';
  const fullName = user?.name || 'D L Narasimha sai';
  const userPhone = user?.phone || '9390075877';

  // Masked phone format: +91 ••••••5877
  const maskedPhone = userPhone.length >= 4
    ? `+91 ••••••${userPhone.slice(-4)}`
    : `+91 ••••••5877`;

  // Avatar letter or photo
  const avatarLetter = (user?.name && user.name.includes('Narasimha'))
    ? 'N'
    : (user?.name ? user.name.charAt(0).toUpperCase() : 'N');

  // Menu items list
  const menuItems = [
    { id: 'bookings', label: '📅 My bookings', href: '#/bookings' },
    { id: 'details', label: '✏ Edit details', href: '#/details' },
    { id: 'messages', label: '💬 Messages', href: '#/chat/h-kad-1' },
    { id: 'logout', label: '↩ Log out', isLogout: true }
  ];

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !avatarRef.current?.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProfileMenu]);

  // Keyboard navigation inside dropdown menu
  useEffect(() => {
    if (!showProfileMenu) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        avatarRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % menuItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleItemClick(menuItems[focusedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileMenu, focusedIndex, menuItems]);

  // Focus the item when focusedIndex changes
  useEffect(() => {
    if (showProfileMenu && itemsRef.current[focusedIndex]) {
      itemsRef.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, showProfileMenu]);

  const handleItemClick = (item) => {
    setShowProfileMenu(false);
    avatarRef.current?.focus();
    if (item.isLogout) {
      if (onLogout) onLogout();
    } else if (item.href) {
      window.location.hash = item.href;
    }
  };

  return (
    <header className="top" style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4vw', background: 'color-mix(in srgb, var(--ink) 62%, var(--acc))', transition: 'background 0.8s', color: '#FFE7B0' }}>
      {/* LEFT: Logo "Vedika" with 22px accent circle */}
      <a
        href="#/dashboard"
        className="logo"
        style={{ textDecoration: 'none', color: '#FFE7B0', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Yatra One', fontSize: '1.45rem' }}
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = '#/dashboard';
        }}
      >
        <b
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--acc)',
            boxShadow: '0 0 0 4px #ffffff22',
            transition: 'background 0.6s'
          }}
        />
        <span>Vedika</span>
      </a>

      {/* RIGHT: (1) Location pill, (2) My bookings pill, (3) Profile picture */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
        {/* 1. Location Pill */}
        <button
          type="button"
          className="pill header-location-pill"
          onClick={onOpenLocationModal}
          aria-label="Change city"
          style={{
            border: '1px solid #FFE7B055',
            background: 'transparent',
            color: '#FFE7B0',
            borderRadius: '99px',
            padding: '7px 12px',
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
        >
          <span>📍 {userCity}</span>
          <span style={{ fontSize: '0.75rem' }}>▾</span>
        </button>

        {/* 2. My Bookings Pill */}
        <button
          type="button"
          className="pill header-bookings-pill"
          onClick={() => { window.location.hash = '#/bookings'; }}
          aria-label="View bookings"
          style={{
            border: '1px solid #FFE7B055',
            background: 'transparent',
            color: '#FFE7B0',
            borderRadius: '99px',
            padding: '7px 14px',
            fontSize: '0.88rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <span className="bookings-label-full">My bookings</span>
          <span className="bookings-label-short" style={{ display: 'none' }}>📅 Bookings</span>
        </button>

        {/* 3. Round Profile Picture / Avatar */}
        <div
          ref={avatarRef}
          role="button"
          tabIndex={0}
          onClick={() => {
            setShowProfileMenu((prev) => !prev);
            setFocusedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowProfileMenu((prev) => !prev);
              setFocusedIndex(0);
            }
          }}
          aria-haspopup="true"
          aria-expanded={showProfileMenu}
          title={fullName}
          aria-label="Profile menu"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--gold)',
            color: '#3A0A1E',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            overflow: 'hidden',
            border: '2px solid #FFE7B055',
            flexShrink: 0
          }}
        >
          {user?.photo ? (
            <img
              src={user.photo}
              alt={fullName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            avatarLetter
          )}
        </div>

        {/* Profile Menu Dropdown Card */}
        {showProfileMenu && (
          <div
            ref={menuRef}
            role="menu"
            className="profile-dropdown-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: '260px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '18px',
              padding: '16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.38)',
              zIndex: 50,
              color: 'var(--text)',
              animation: 'popIn 0.3s cubic-bezier(0.2, 1.2, 0.4, 1)'
            }}
          >
            {/* Arrow Tip pointing to avatar */}
            <div
              style={{
                position: 'absolute',
                top: '-6px',
                right: '12px',
                width: '12px',
                height: '12px',
                background: 'var(--card)',
                borderLeft: '1px solid var(--line)',
                borderTop: '1px solid var(--line)',
                transform: 'rotate(45deg)'
              }}
            />

            {/* Top User Info */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--line)', marginBottom: '8px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--gold)',
                  color: '#3A0A1E',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {user?.photo ? (
                  <img src={user.photo} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  avatarLetter
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {maskedPhone}
                </div>
              </div>
            </div>

            {/* Menu Items with Icons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {menuItems.map((item, idx) => (
                <button
                  key={item.id}
                  ref={(el) => { itemsRef.current[idx] = el; }}
                  type="button"
                  role="menuitem"
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: 0,
                    background: focusedIndex === idx ? 'color-mix(in srgb, var(--ink) 8%, var(--card))' : 'transparent',
                    color: item.isLogout ? 'var(--rose)' : 'var(--text)',
                    fontSize: '0.9rem',
                    fontWeight: item.isLogout ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginTop: item.isLogout ? '6px' : '0',
                    borderTop: item.isLogout ? '1px solid var(--line)' : '0'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

