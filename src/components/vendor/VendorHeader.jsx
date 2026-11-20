import React, { useState, useRef, useEffect } from 'react';

export default function VendorHeader({
  vendor,
  currentRoute = 'home',
  unreadRequestsCount = 1,
  hasNewBookings = true,
  onLogout
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const avatarRef = useRef(null);
  const menuRef = useRef(null);
  const itemsRef = useRef([]);

  const vendorName = vendor?.name || 'Sai Kumar';
  const hallBiz = vendor?.businessNameHall || 'Sai Function Hall';
  const cateringBiz = vendor?.businessNameCatering || 'Annapurna Catering';
  const avatarLetter = vendorName.charAt(0).toUpperCase();

  const navItems = [
    { id: 'halls', label: '➕ Add function halls', href: '#/v/halls' },
    { id: 'details', label: '🖼 Update hall details', href: '#/v/details' },
    { id: 'bookings', label: '📅 Manage bookings', href: '#/v/bookings', hasDot: hasNewBookings },
    { id: 'requests', label: '💬 Customer requests', href: '#/v/requests', badge: unreadRequestsCount },
    { id: 'revenue', label: '📈 Track revenue', href: '#/v/revenue' }
  ];

  const profileMenuItems = [
    { id: 'profile', label: '✏ Edit details', href: '#/v/profile' },
    { id: 'bookings', label: '📅 All bookings', href: '#/v/bookings' },
    { id: 'logout', label: '↩ Log out', isLogout: true }
  ];

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !avatarRef.current?.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // Keyboard navigation
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        avatarRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % profileMenuItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + profileMenuItems.length) % profileMenuItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = profileMenuItems[focusedIndex];
        setShowProfileMenu(false);
        if (item.isLogout) onLogout();
        else if (item.href) window.location.hash = item.href;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileMenu, focusedIndex, profileMenuItems, onLogout]);

  return (
    <div className="vendor-header-wrapper" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'color-mix(in srgb, var(--ink) 62%, var(--acc))', transition: 'background 0.8s', color: '#FFE7B0', boxShadow: '0 2px 14px rgba(0,0,0,0.25)' }}>
      {/* Top Bar */}
      <header
        className="top"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 4vw',
          gap: '8px'
        }}
      >
        {/* LEFT: Logo Vedika with Accent Circle + Vendor Tag */}
        <a
          href="#/v/home"
          className="logo"
          style={{
            textDecoration: 'none',
            color: '#FFE7B0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'Yatra One',
            fontSize: '1.45rem'
          }}
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = '#/v/home';
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
          <span
            style={{
              fontSize: '0.72rem',
              background: 'var(--gold)',
              color: '#3A0A1E',
              padding: '2px 8px',
              borderRadius: '99px',
              fontFamily: 'Hind',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Vendor
          </span>
        </a>

        {/* RIGHT: Avatar / Profile Menu */}
        <div style={{ position: 'relative' }}>
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
            title={vendorName}
            aria-label="Vendor profile menu"
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
            {vendor?.photo ? (
              <img src={vendor.photo} alt={vendorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              avatarLetter
            )}
          </div>

          {/* Profile Dropdown Menu Card */}
          {showProfileMenu && (
            <div
              ref={menuRef}
              role="menu"
              className="profile-dropdown-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '270px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '18px',
                padding: '16px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.38)',
                zIndex: 60,
                color: 'var(--text)',
                animation: 'popIn 0.3s cubic-bezier(0.2, 1.2, 0.4, 1)'
              }}
            >
              {/* Arrow Tip */}
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

              {/* Vendor Info Header */}
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
                    flexShrink: 0
                  }}
                >
                  {vendor?.photo ? (
                    <img src={vendor.photo} alt={vendorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {vendorName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {hallBiz || cateringBiz}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '3px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--leaf)',
                      background: 'color-mix(in srgb, var(--leaf) 15%, transparent)',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    ✓ Verified Partner
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {profileMenuItems.map((item, idx) => (
                  <button
                    key={item.id}
                    ref={(el) => { itemsRef.current[idx] = el; }}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (item.isLogout) onLogout();
                      else if (item.href) window.location.hash = item.href;
                    }}
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
                      fontSize: '0.88rem',
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

      {/* Top Navigation Bar: Horizontally scrollable on small screens */}
      <nav
        aria-label="Vendor Portal Navigation"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '0 4vw 8px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {navItems.map((item) => {
          const isActive = currentRoute === item.id;
          return (
            <a
              key={item.id}
              href={item.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '99px',
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                background: isActive ? 'var(--gold)' : 'rgba(255, 231, 176, 0.12)',
                color: isActive ? '#3A0A1E' : '#FFE7B0',
                border: isActive ? '1px solid var(--gold)' : '1px solid rgba(255, 231, 176, 0.25)',
                position: 'relative'
              }}
            >
              <span>{item.label}</span>
              {/* Dot for new bookings */}
              {item.hasDot && (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--leaf)',
                    boxShadow: '0 0 4px #2F7D5B'
                  }}
                  title="New booking"
                />
              )}
              {/* Badge for unread requests */}
              {Boolean(item.badge) && item.badge > 0 && (
                <span
                  style={{
                    background: 'var(--rose)',
                    color: '#fff',
                    borderRadius: '99px',
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    fontWeight: 700,
                    lineHeight: 1.2
                  }}
                >
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
