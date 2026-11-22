import React, { useState, useEffect } from 'react';
import {
  getVendorBranches,
  saveVendorBranch,
  getVendorPreviousWorks,
  saveVendorPreviousWork,
  deleteVendorPreviousWork
} from '../../shared/data-service/index.js';
import PhotoUploader from '../dashboard-plan/PhotoUploader.jsx';
import { resolvePhotoUrls } from '../../shared/utils/photos.js';
import { VENDOR_CONFIG } from '../dashboard-plan/engine/config.js';

const EVENT_TYPES = [
  { id: 'wedding', name: 'Wedding', color: '#B5173B' },
  { id: 'reception', name: 'Reception', color: '#6B1230' },
  { id: 'engagement', name: 'Engagement', color: '#FF5C8A' },
  { id: 'sangeet', name: 'Sangeet', color: '#E8B84A' },
  { id: 'mehendi', name: 'Mehendi', color: '#2F7D5B' },
  { id: 'birthday', name: 'Birthday', color: '#3A0A1E' },
  { id: 'annaprasana', name: 'Annaprasana', color: '#E4572E' },
  { id: 'half_saree', name: 'Half Saree', color: '#9C27B0' }
];

const AVAILABLE_AMENITIES = [
  'Parking',
  'Generator',
  'Dining area',
  'Bridal room',
  'Stage',
  'Sound system',
  'Lift',
  'Valet'
];

export default function VendorDetails({ vendor, onNavigate }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'photos' | 'works'

  // Branch details form state
  const [branchDetails, setBranchDetails] = useState({
    name: '',
    description: '',
    street: '',
    area: '',
    city: 'Kadapa',
    capacity: 500,
    acType: 'Both',
    fullDayNonAc: 80000,
    fullDayAc: 110000,
    halfDay: 45000,
    amenities: [],
    blockedDates: [],
    photos: []
  });

  // Previous works state
  const [previousWorks, setPreviousWorks] = useState([]);
  const [editingWork, setEditingWork] = useState(null);
  const [isAddingWork, setIsAddingWork] = useState(false);
  const [workForm, setWorkForm] = useState({
    branchId: null,
    title: '',
    eventType: 'Wedding',
    date: '',
    guests: 400,
    caption: '',
    photos: []
  });

  // Calendar month state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // UI state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Load branches
  useEffect(() => {
    let isMounted = true;
    if (vendor?.username) {
      Promise.all([
        getVendorBranches(vendor.username),
        getVendorPreviousWorks(vendor.username)
      ]).then(async ([list, works]) => {
        if (!isMounted) return;
        const validList = Array.isArray(list) ? list : [];
        const resolvedBranches = await Promise.all(validList.map(async b => {
          if (Array.isArray(b.photos) && b.photos.length > 0) {
            const resolved = await resolvePhotoUrls(b.photos);
            return { ...b, photos: resolved };
          }
          return b;
        }));
        setBranches(resolvedBranches);
        if (resolvedBranches.length > 0 && !selectedBranchId) {
          setSelectedBranchId(resolvedBranches[0].id);
        }
        const validWorks = Array.isArray(works) ? works : [];
        const resolvedWorks = await Promise.all(validWorks.map(async w => {
          if (Array.isArray(w.photos) && w.photos.length > 0) {
            const resolved = await resolvePhotoUrls(w.photos);
            return { ...w, photos: resolved, coverPhoto: resolved.find(p => p.isCover)?.url || resolved[0]?.url || w.coverPhoto };
          }
          return w;
        }));
        setPreviousWorks(resolvedWorks);
      }).catch(err => {
        console.warn('[VendorDetails] Failed to load data:', err);
      });
    }
    return () => { isMounted = false; };
  }, [vendor]);

  // Load selected branch into form
  useEffect(() => {
    if (!selectedBranchId || branches.length === 0) return;
    const branch = branches.find(b => b.id === selectedBranchId) || branches[0];
    if (branch) {
      setBranchDetails({
        name: branch.name || '',
        description: branch.description || 'A grand venue equipped with state-of-the-art acoustics, banquet seating, and dedicated guest suites for memorable celebrations.',
        street: branch.address?.street || '',
        area: branch.address?.area || '',
        city: branch.address?.city || branch.city || 'Kadapa',
        capacity: branch.capacity || 500,
        acType: branch.acType || 'Both',
        fullDayNonAc: branch.pricing?.fullDayNonAc || branch.price || 80000,
        fullDayAc: branch.pricing?.fullDayAc || 110000,
        halfDay: branch.pricing?.halfDay || 45000,
        amenities: branch.amenities || ['Parking', 'Generator', 'Dining area', 'Stage'],
        blockedDates: branch.blockedDates || [],
        photos: branch.photos || []
      });
      setHasUnsavedChanges(false);
    }
  }, [selectedBranchId, branches]);

  // Warn before unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleToggleAmenity = (amenity) => {
    setBranchDetails(prev => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter(a => a !== amenity)
          : [...prev.amenities, amenity]
      };
    });
    setHasUnsavedChanges(true);
  };

  // Availability calendar date toggle
  const handleToggleDateBlock = (dateStr) => {
    setBranchDetails(prev => {
      const exists = prev.blockedDates.includes(dateStr);
      const updated = exists
        ? prev.blockedDates.filter(d => d !== dateStr)
        : [...prev.blockedDates, dateStr];
      return { ...prev, blockedDates: updated };
    });
    setHasUnsavedChanges(true);
  };

  // Calendar rendering helpers
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  // Save changes
  const handleSaveChanges = async () => {
    if (!selectedBranchId || !vendor?.username) return;

    const currentBranch = branches.find(b => b.id === selectedBranchId);
    if (!currentBranch) return;

    const updated = {
      ...currentBranch,
      name: branchDetails.name,
      description: branchDetails.description,
      capacity: Number(branchDetails.capacity),
      acType: branchDetails.acType,
      pricing: {
        ...(currentBranch.pricing || {}),
        fullDayNonAc: Number(branchDetails.fullDayNonAc),
        fullDayAc: Number(branchDetails.fullDayAc),
        halfDay: Number(branchDetails.halfDay)
      },
      price: Number(branchDetails.fullDayNonAc),
      amenities: branchDetails.amenities,
      blockedDates: branchDetails.blockedDates,
      photos: branchDetails.photos,
      coverPhoto: branchDetails.photos.find(p => p.isCover)?.url || branchDetails.photos[0]?.url || currentBranch.coverPhoto
    };

    await saveVendorBranch(vendor.username, updated);
    const refreshed = await getVendorBranches(vendor.username);
    setBranches(Array.isArray(refreshed) ? refreshed : []);
    setHasUnsavedChanges(false);
    showToast('Updated ✓');
  };

  const handleDiscardChanges = () => {
    const branch = branches.find(b => b.id === selectedBranchId);
    if (branch) {
      setBranchDetails({
        name: branch.name || '',
        description: branch.description || '',
        street: branch.address?.street || '',
        area: branch.address?.area || '',
        city: branch.address?.city || branch.city || 'Kadapa',
        capacity: branch.capacity || 500,
        acType: branch.acType || 'Both',
        fullDayNonAc: branch.pricing?.fullDayNonAc || branch.price || 80000,
        fullDayAc: branch.pricing?.fullDayAc || 110000,
        halfDay: branch.pricing?.halfDay || 45000,
        amenities: branch.amenities || [],
        blockedDates: branch.blockedDates || [],
        photos: branch.photos || []
      });
      setHasUnsavedChanges(false);
      showToast('Changes discarded.');
    }
  };

  // Previous works handlers
  const handleOpenAddWork = () => {
    setEditingWork(null);
    setWorkForm({
      branchId: selectedBranchId || activeBranch?.id || null,
      title: '',
      eventType: 'Wedding',
      date: new Date().toISOString().slice(0, 10),
      guests: 500,
      amount: '',
      caption: '',
      photos: []
    });
    setIsAddingWork(true);
  };

  const handleOpenEditWork = (work) => {
    setEditingWork(work);
    setWorkForm({
      branchId: work.branchId || selectedBranchId || activeBranch?.id || null,
      title: work.title || '',
      eventType: work.eventType || 'Wedding',
      date: work.date || '',
      guests: work.guests || 500,
      amount: work.amount != null ? work.amount : '',
      caption: work.caption || '',
      photos: work.photos || []
    });
    setIsAddingWork(true);
  };

  const handleDeleteWork = async (workId) => {
    if (!window.confirm('Delete this past work portfolio item?')) return;
    await deleteVendorPreviousWork(vendor.username, workId);
    const updated = await getVendorPreviousWorks(vendor.username);
    setPreviousWorks(Array.isArray(updated) ? updated : []);
    showToast('Portfolio event deleted.');
  };

  const activeBranch = branches.find(b => b.id === selectedBranchId);
  const branchWorks = previousWorks.filter(w => !w.branchId || w.branchId === selectedBranchId);

  const handleSaveWork = async () => {
    if (!workForm.title.trim()) {
      alert('Please enter a title for the event.');
      return;
    }

    const estimatedAmount = activeBranch?.kind === 'catering'
      ? (Number(workForm.guests) || 400) * (activeBranch?.pricing?.plateRate || activeBranch?.plateRate || 350)
      : (activeBranch?.pricing?.fullDay || activeBranch?.price || 120000);

    const enteredAmount = workForm.amount !== '' && workForm.amount != null ? Number(workForm.amount) : null;
    const finalAmount = (enteredAmount && !isNaN(enteredAmount) && enteredAmount > 0) ? enteredAmount : estimatedAmount;

    const payload = {
      id: editingWork?.id || undefined,
      branchId: workForm.branchId || selectedBranchId || activeBranch?.id || null,
      title: workForm.title,
      eventType: workForm.eventType,
      date: workForm.date,
      guests: Number(workForm.guests) || 400,
      amount: finalAmount,
      caption: workForm.caption,
      photos: workForm.photos,
      coverPhoto: workForm.photos.find(p => p.isCover)?.url || workForm.photos[0]?.url || ''
    };

    await saveVendorPreviousWork(vendor.username, payload);
    const updated = await getVendorPreviousWorks(vendor.username);
    const resolvedWorks = await Promise.all((Array.isArray(updated) ? updated : []).map(async w => {
      if (Array.isArray(w.photos) && w.photos.length > 0) {
        const resolved = await resolvePhotoUrls(w.photos);
        return { ...w, photos: resolved, coverPhoto: resolved.find(p => p.isCover)?.url || resolved[0]?.url || w.coverPhoto };
      }
      return w;
    }));
    setPreviousWorks(resolvedWorks);
    setIsAddingWork(false);
    showToast(editingWork ? 'Previous work updated ✓' : 'New portfolio event added ✓');
  };

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

      {/* Top Header & Branch Selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'Yatra One, serif', fontSize: '28px', color: 'var(--text)', margin: '0 0 6px' }}>
            Update Hall Details
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '15px' }}>
            Customize pricing, availability calendar, photos and previous work showcase.
          </p>
        </div>

        {/* Branch Selector Dropdown */}
        {branches.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Branch:</span>
            <select
              value={selectedBranchId}
              onChange={e => {
                if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Switch branch anyway?')) {
                  return;
                }
                setSelectedBranchId(e.target.value);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type === 'catering' ? 'Catering' : 'Hall'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '24px' }}>
        {[
          { id: 'details', label: '📋 Details & Calendar' },
          { id: 'photos', label: `🖼 Photos (${branchDetails.photos.length})` },
          { id: 'works', label: `✨ Previous Works (${branchWorks.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px',
              borderRadius: '999px',
              border: 'none',
              background: activeTab === tab.id ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
              color: activeTab === tab.id ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DETAILS & CALENDAR */}
      {activeTab === 'details' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Card 1: Basic & Description */}
          <div className="vedika-card" style={{ background: 'var(--card)', borderRadius: '20px', padding: '24px', border: '1px solid var(--line)' }}>
            <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 16px', fontSize: '18px' }}>
              Venue Information & Pricing
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Branch Name</label>
                <input
                  type="text"
                  value={branchDetails.name}
                  onChange={e => { setBranchDetails({ ...branchDetails, name: e.target.value }); setHasUnsavedChanges(true); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Max Capacity (Guests)</label>
                <input
                  type="number"
                  value={branchDetails.capacity}
                  onChange={e => { setBranchDetails({ ...branchDetails, capacity: e.target.value }); setHasUnsavedChanges(true); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Full Day Price (Non-AC) (₹)</label>
                <input
                  type="number"
                  value={branchDetails.fullDayNonAc}
                  onChange={e => { setBranchDetails({ ...branchDetails, fullDayNonAc: e.target.value }); setHasUnsavedChanges(true); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Full Day Price (AC) (₹)</label>
                <input
                  type="number"
                  value={branchDetails.fullDayAc}
                  onChange={e => { setBranchDetails({ ...branchDetails, fullDayAc: e.target.value }); setHasUnsavedChanges(true); }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Venue Description</label>
              <textarea
                rows={3}
                value={branchDetails.description}
                onChange={e => { setBranchDetails({ ...branchDetails, description: e.target.value }); setHasUnsavedChanges(true); }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: 'Hind, sans-serif' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Amenities Available</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {AVAILABLE_AMENITIES.map(amenity => {
                  const active = branchDetails.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => handleToggleAmenity(amenity)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        border: active ? '1px solid var(--gold)' : '1px solid var(--line)',
                        background: active ? 'rgba(234, 171, 80, 0.31)' : 'var(--bg)',
                        color: active ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--text)',
                        fontWeight: active ? 600 : 400
                      }}
                    >
                      {active ? '✓ ' : '+ '}{amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Interactive Availability Calendar (Date Blocker) */}
          <div className="vedika-card" style={{ background: 'var(--card)', borderRadius: '20px', padding: '24px', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 4px', fontSize: '18px' }}>
                  📅 Availability Calendar (Date Blocker)
                </h3>
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: '13px' }}>
                  Tap any date to block or unblock it. Blocked dates will show as unavailable/crossed out to customers.
                </p>
              </div>

              {/* Month Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ‹ Prev
                </button>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8ebd8', minWidth: '130px', textAlign: 'center' }}>
                  {monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Next ›
                </button>
              </div>
            </div>

            {/* Calendar Legend */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--bg)', border: '1px solid var(--line)' }} />
                <span>Available</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--rose)' }} />
                <span>Blocked by you ({branchDetails.blockedDates.length} dates)</span>
              </span>
            </div>

            {/* Calendar Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
                textAlign: 'center'
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontWeight: 600, fontSize: '12px', color: 'var(--muted)', padding: '6px 0' }}>
                  {d}
                </div>
              ))}

              {/* Blank leading days */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`blank-${i}`} style={{ height: '42px' }} />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isBlocked = branchDetails.blockedDates.includes(dateStr);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleToggleDateBlock(dateStr)}
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      border: isBlocked ? '1px solid var(--rose)' : '1px solid var(--line)',
                      background: isBlocked ? 'var(--rose)' : 'var(--bg)',
                      color: isBlocked ? '#fff' : 'var(--text)',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{dayNum}</span>
                    {isBlocked && (
                      <span style={{ fontSize: '9px', fontWeight: 700, textDecoration: 'line-through' }}>
                        BLOCKED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sticky Actions Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px',
              background: 'var(--card)',
              borderRadius: '16px',
              border: '1px solid var(--line)'
            }}
          >
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={!hasUnsavedChanges}
              className="vedika-btn"
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                color: hasUnsavedChanges ? 'var(--text)' : 'var(--muted)',
                padding: '10px 22px',
                borderRadius: '999px',
                cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed'
              }}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!hasUnsavedChanges}
              className={`vedika-btn ${hasUnsavedChanges ? 'pulse-gold' : ''}`}
              style={{
                background: hasUnsavedChanges ? 'var(--gold)' : 'var(--line)',
                color: hasUnsavedChanges ? 'var(--ink)' : 'var(--muted)',
                fontWeight: 700,
                border: 'none',
                padding: '10px 28px',
                borderRadius: '999px',
                cursor: hasUnsavedChanges ? 'pointer' : 'default'
              }}
            >
              💾 Save changes
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PHOTOS (Gallery Manager) */}
      {activeTab === 'photos' && (
        <div className="vedika-card fade-in" style={{ background: 'var(--card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--line)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 6px', fontSize: '20px' }}>
              Branch Photo Gallery (Up to 12 Photos)
            </h3>
            <p style={{ color: 'var(--muted)', margin: 0, fontSize: '14px' }}>
              Upload high-quality photos of the stage, dining area, entrance, and facilities. Drag or click arrows to reorder, set cover badges, and add captions.
            </p>
          </div>

          <PhotoUploader
            photos={branchDetails.photos}
            onChange={newPhotos => {
              setBranchDetails({ ...branchDetails, photos: newPhotos });
              setHasUnsavedChanges(true);
            }}
            maxPhotos={VENDOR_CONFIG.maxPhotosPerBranch}
          />

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!hasUnsavedChanges}
              className="vedika-btn pulse-gold"
              style={{
                background: 'var(--gold)',
                color: '#3A0A1E',
                fontWeight: 700,
                border: 'none',
                padding: '10px 28px',
                borderRadius: '999px',
                cursor: 'pointer'
              }}
            >
              💾 Save gallery changes
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PREVIOUS WORKS */}
      {activeTab === 'works' && (
        <div className="fade-in">
          {/* Header & Add Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 4px', fontSize: '20px' }}>
                Previous Works Portfolio
              </h3>
              <p style={{ color: 'var(--muted)', margin: 0, fontSize: '14px' }}>
                Showcase past weddings and celebrations hosted at your venue to inspire new customers.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddWork}
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
              ➕ Add previous work
            </button>
          </div>

          {/* Add / Edit Work Form Modal */}
          {isAddingWork && (
            <div className="modal-backdrop" onClick={() => setIsAddingWork(false)} style={{ zIndex: 9990 }}>
              <div
                className="vedika-card pop-in"
                onClick={e => e.stopPropagation()}
                style={{
                  width: 'min(640px, 94vw)',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  background: 'var(--card)',
                  borderRadius: '24px',
                  padding: '28px',
                  border: '1px solid var(--line)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: 0, fontSize: '20px' }}>
                    {editingWork ? '✏ Edit Portfolio Event' : '➕ Add Previous Work Event'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingWork(false)}
                    style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                      Event Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ravi & Anu's Traditional Telugu Wedding"
                      value={workForm.title}
                      onChange={e => setWorkForm({ ...workForm, title: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                        Event Type
                      </label>
                      <select
                        value={workForm.eventType}
                        onChange={e => setWorkForm({ ...workForm, eventType: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                      >
                        {EVENT_TYPES.map(ev => (
                          <option key={ev.id} value={ev.name}>{ev.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                        Date of Event
                      </label>
                      <input
                        type="date"
                        value={workForm.date}
                        onChange={e => setWorkForm({ ...workForm, date: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                        Guest Count
                      </label>
                      <input
                        type="number"
                        value={workForm.guests}
                        onChange={e => setWorkForm({ ...workForm, guests: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                        Event Revenue (₹) <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>(Optional)</span>
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 150000 (auto-estimated if empty)"
                        value={workForm.amount || ''}
                        onChange={e => setWorkForm({ ...workForm, amount: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                      Short Caption / Story
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Grand 800-guest mandap decoration with fresh marigolds and central AC hall."
                      value={workForm.caption}
                      onChange={e => setWorkForm({ ...workForm, caption: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: 'Hind, sans-serif' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                      Event Photos
                    </label>
                    <PhotoUploader
                      photos={workForm.photos}
                      onChange={newPhotos => setWorkForm({ ...workForm, photos: newPhotos })}
                      maxPhotos={6}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddingWork(false)}
                    className="vedika-btn"
                    style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)', padding: '8px 20px', borderRadius: '999px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWork}
                    className="vedika-btn pulse-gold"
                    style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700, border: 'none', padding: '8px 24px', borderRadius: '999px' }}
                  >
                    💾 Save portfolio event
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Previous Works List */}
          {branchWorks.length === 0 ? (
            <div className="vedika-card" style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--card)', borderRadius: '24px', border: '1px dashed var(--line)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✨</div>
              <h3 style={{ fontFamily: 'Yatra One, serif', color: 'var(--text)', margin: '0 0 6px' }}>No previous works added yet</h3>
              <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '0 0 16px' }}>Add photos and stories from weddings and events you hosted to showcase your venue.</p>
              <button
                type="button"
                onClick={handleOpenAddWork}
                className="vedika-btn pulse-gold"
                style={{ background: 'var(--gold)', color: '#3A0A1E', fontWeight: 700, padding: '10px 24px', borderRadius: '999px', border: 'none' }}
              >
                ➕ Add first event
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {branchWorks.map(work => {
                const eventConfig = EVENT_TYPES.find(ev => ev.name.toLowerCase() === (work.eventType || '').toLowerCase()) || EVENT_TYPES[0];
                const cover = work.coverPhoto || work.photos?.[0]?.url;

                return (
                  <div
                    key={work.id}
                    className="vedika-card pop-in"
                    style={{
                      background: 'var(--card)',
                      borderRadius: '20px',
                      border: '1px solid var(--line)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        height: '160px',
                        background: cover ? `url(${cover}) center/cover no-repeat` : `linear-gradient(135deg, ${eventConfig.color}, var(--ink))`,
                        position: 'relative'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          background: eventConfig.color,
                          color: '#fff',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {work.eventType}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '10px',
                          right: '10px',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}
                      >
                        👥 {work.guests} guests
                      </span>
                    </div>

                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontFamily: 'Yatra One, serif', color: 'var(--text)', margin: '0 0 6px', fontSize: '16px' }}>
                        {work.title}
                      </h4>
                      <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 10px' }}>
                        📅 {work.date}
                      </p>
                      {work.caption && (
                        <p style={{ color: 'var(--text)', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.4 }}>
                          "{work.caption}"
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditWork(work)}
                          className="vedika-btn"
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            border: '1px solid var(--line)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ✏ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWork(work.id)}
                          className="vedika-btn"
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            color: 'var(--rose)',
                            border: '1px solid var(--rose)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
