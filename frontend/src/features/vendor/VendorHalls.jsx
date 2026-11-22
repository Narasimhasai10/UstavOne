import React, { useState, useEffect } from 'react';
import { getVendorBranches, saveVendorBranch, deleteVendorBranch } from '../../shared/data-service/index.js';
import PhotoUploader from '../dashboard-plan/PhotoUploader.jsx';
import { verifyDocument } from '../../shared/utils/verify.js';
import { VENDOR_CONFIG } from '../dashboard-plan/engine/config.js';
import districtsData from '../../shared/data/districts.json' with { type: 'json' };
import cityDistrictMap from '../../shared/data/cityDistrict.json' with { type: 'json' };

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

const CUISINES_LIST = [
  'South Indian',
  'North Indian',
  'Andhra Special',
  'Chinese',
  'Mughlai',
  'Continental',
  'Sweets & Desserts'
];

const SERVING_STYLES = [
  'Buffet',
  'Banana Leaf',
  'Live Counters',
  'Seated Service'
];

export default function VendorHalls({ vendor, onNavigate }) {
  const [branches, setBranches] = useState([]);
  const [typeFilter, setTypeFilter] = useState('hall'); // 'hall' | 'catering'
  const [isEditing, setIsEditing] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    type: 'hall',
    name: '',
    street: '',
    area: '',
    city: 'Kadapa',
    state: 'Andhra Pradesh',
    pincode: '516001',
    capacity: 600,
    acType: 'Both', // 'AC' | 'Non-AC' | 'Both'
    priceFullDayNonAc: 85000,
    priceFullDayAc: 120000,
    priceHalfDay: 50000,
    parkingSpaces: 80,
    rooms: 6,
    amenities: ['Parking', 'Generator', 'Dining area', 'Stage'],
    // Catering specific
    kitchenAddress: '',
    cuisines: ['South Indian', 'Andhra Special'],
    servingStyles: ['Buffet', 'Banana Leaf'],
    minPlates: 100,
    plateRates: {
      veg: { basic: 350, standard: 500, premium: 700, luxury: 1000 },
      nonVeg: { basic: 500, standard: 700, premium: 950, luxury: 1400 }
    },
    photos: [],
    licenceNumber: '',
    licenceFile: null,
    verificationStatus: 'Verified'
  });

  const [formStep, setFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [verifyingDoc, setVerifyingDoc] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Load branches
  const reloadBranches = async () => {
    if (vendor?.username) {
      try {
        const list = await getVendorBranches(vendor.username);
        setBranches(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('[VendorHalls] Failed to load branches:', err);
      }
    }
  };

  useEffect(() => {
    reloadBranches();
  }, [vendor]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const ownsBoth = vendor?.businessType === 'both';
  const ownsCateringOnly = vendor?.businessType === 'catering';

  // Determine active branch type filter
  useEffect(() => {
    if (ownsCateringOnly) {
      setTypeFilter('catering');
    }
  }, [ownsCateringOnly]);

  const filteredBranches = branches.filter(b => {
    if (!ownsBoth) return true;
    return (b.type || 'hall') === typeFilter;
  });

  const handleOpenAdd = () => {
    setEditingBranchId(null);
    setFormStep(1);
    setFormErrors({});
    setVerificationResult(null);
    setFormData({
      type: ownsCateringOnly ? 'catering' : typeFilter,
      name: '',
      street: '',
      area: '',
      city: vendor?.city || 'Kadapa',
      state: vendor?.state || 'Andhra Pradesh',
      district: vendor?.district || (cityDistrictMap[vendor?.city] || 'YSR Kadapa'),
      pincode: '516001',
      capacity: 500,
      acType: 'Both',
      priceFullDayNonAc: 80000,
      priceFullDayAc: 110000,
      priceHalfDay: 45000,
      parkingSpaces: 50,
      rooms: 4,
      amenities: ['Parking', 'Generator', 'Dining area', 'Stage'],
      kitchenAddress: '',
      cuisines: ['South Indian', 'Andhra Special'],
      servingStyles: ['Buffet'],
      minPlates: 100,
      plateRates: {
        veg: { basic: 350, standard: 500, premium: 700, luxury: 1000 },
        nonVeg: { basic: 500, standard: 700, premium: 950, luxury: 1400 }
      },
      photos: [],
      licenceNumber: '',
      licenceFile: null,
      verificationStatus: 'Verified'
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (branch) => {
    setEditingBranchId(branch.id);
    setFormStep(1);
    setFormErrors({});
    setVerificationResult(null);
    setFormData({
      type: branch.type || 'hall',
      name: branch.name || '',
      street: branch.address?.street || '',
      area: branch.address?.area || '',
      city: branch.address?.city || branch.city || 'Kadapa',
      state: branch.state || branch.address?.state || 'Andhra Pradesh',
      district: branch.district || branch.address?.district || (cityDistrictMap[branch.city] || 'YSR Kadapa'),
      pincode: branch.address?.pincode || '516001',
      capacity: branch.capacity || 500,
      acType: branch.acType || 'Both',
      priceFullDayNonAc: branch.pricing?.fullDayNonAc || branch.price || 80000,
      priceFullDayAc: branch.pricing?.fullDayAc || 110000,
      priceHalfDay: branch.pricing?.halfDay || 45000,
      parkingSpaces: branch.parkingSpaces || 50,
      rooms: branch.rooms || 4,
      amenities: branch.amenities || ['Parking', 'Generator', 'Dining area', 'Stage'],
      kitchenAddress: branch.kitchenAddress || '',
      cuisines: branch.cuisines || ['South Indian', 'Andhra Special'],
      servingStyles: branch.servingStyles || ['Buffet'],
      minPlates: branch.minPlates || 100,
      plateRates: branch.plateRates || {
        veg: { basic: 350, standard: 500, premium: 700, luxury: 1000 },
        nonVeg: { basic: 500, standard: 700, premium: 950, luxury: 1400 }
      },
      photos: branch.photos || [],
      licenceNumber: branch.licenceNumber || '',
      licenceFile: null,
      verificationStatus: branch.verificationStatus || 'Verified'
    });
    setIsEditing(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !vendor?.username) return;
    try {
      await deleteVendorBranch(vendor.username, deleteConfirmId);
      setDeleteConfirmId(null);
      await reloadBranches();
      showToast('Branch deleted successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to delete branch');
    }
  };

  const handleToggleAmenity = (amenity) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter(a => a !== amenity)
          : [...prev.amenities, amenity]
      };
    });
  };

  const handleToggleCuisine = (cuisine) => {
    setFormData(prev => {
      const exists = prev.cuisines.includes(cuisine);
      return {
        ...prev,
        cuisines: exists
          ? prev.cuisines.filter(c => c !== cuisine)
          : [...prev.cuisines, cuisine]
      };
    });
  };

  const handleToggleServingStyle = (style) => {
    setFormData(prev => {
      const exists = prev.servingStyles.includes(style);
      return {
        ...prev,
        servingStyles: exists
          ? prev.servingStyles.filter(s => s !== style)
          : [...prev.servingStyles, style]
      };
    });
  };

  // Run AI Verification on Branch Doc
  const handleVerifyBranchDoc = async () => {
    if (!formData.licenceNumber) {
      setFormErrors(prev => ({ ...prev, licenceNumber: 'Please enter the licence number' }));
      return;
    }

    setVerifyingDoc(true);
    setVerificationResult(null);

    const result = await verifyDocument({
      type: formData.type === 'hall' ? 'trade_licence' : 'fssai',
      number: formData.licenceNumber,
      file: formData.licenceFile,
      businessName: formData.name
    });

    setVerifyingDoc(false);
    setVerificationResult(result);
    setFormData(prev => ({
      ...prev,
      verificationStatus: result.status === 'Verified' ? 'Verified' : 'Under review'
    }));
  };

  const handleSaveBranch = async () => {
    // Validation
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Branch name is required';
    if (!formData.street.trim()) errors.street = 'Street address is required';
    if (!formData.area.trim()) errors.area = 'Area/locality is required';
    if (!formData.pincode.trim() || formData.pincode.length !== 6) errors.pincode = 'Valid 6-digit pincode is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormStep(1);
      return;
    }

    const branchPayload = {
      id: editingBranchId || undefined,
      type: formData.type,
      name: formData.name,
      businessName: formData.name,
      city: formData.city,
      state: formData.state || 'Andhra Pradesh',
      district: formData.district || (cityDistrictMap[formData.city] || 'YSR Kadapa'),
      address: {
        street: formData.street,
        area: formData.area,
        city: formData.city,
        state: formData.state,
        district: formData.district || (cityDistrictMap[formData.city] || 'YSR Kadapa'),
        pincode: formData.pincode
      },
      capacity: Number(formData.capacity) || 500,
      acType: formData.acType,
      pricing: {
        fullDayNonAc: Number(formData.priceFullDayNonAc) || 80000,
        fullDayAc: Number(formData.priceFullDayAc) || 110000,
        halfDay: Number(formData.priceHalfDay) || 45000
      },
      price: Number(formData.priceFullDayNonAc) || 80000,
      parkingSpaces: Number(formData.parkingSpaces) || 50,
      rooms: Number(formData.rooms) || 4,
      amenities: formData.amenities,
      kitchenAddress: formData.kitchenAddress,
      cuisines: formData.cuisines,
      servingStyles: formData.servingStyles,
      minPlates: Number(formData.minPlates) || 100,
      plateRates: formData.plateRates,
      photos: formData.photos,
      coverPhoto: formData.photos.find(p => p.isCover)?.url || formData.photos[0]?.url || '',
      licenceNumber: formData.licenceNumber,
      verificationStatus: formData.verificationStatus || 'Verified'
    };

    await saveVendorBranch(vendor.username, branchPayload);
    setIsEditing(false);
    await reloadBranches();
    showToast(editingBranchId ? 'Branch updated successfully ✓' : 'New branch added & listed ✓');
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmId(null)} style={{ zIndex: 9990 }}>
          <div
            className="vedika-card pop-in"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(420px, 92vw)',
              padding: '24px',
              borderRadius: '20px',
              background: 'var(--card)',
              border: '1px solid var(--line)'
            }}
          >
            <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 12px' }}>
              Delete this branch?
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
              This branch will be removed from your catalog and will no longer be visible to customers on Utsavora.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="vedika-btn"
                onClick={() => setDeleteConfirmId(null)}
                style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vedika-btn"
                onClick={handleDeleteConfirm}
                style={{ background: 'var(--rose)', color: '#fff', border: 'none' }}
              >
                Delete branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Yatra One, serif', fontSize: '28px', color: '#f8ebd8', margin: '0 0 6px' }}>
            {typeFilter === 'catering' ? 'Catering Branches' : 'Function Hall Branches'}
          </h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '15px' }}>
            Manage venues, catering kitchens, pricing and listings visible to customers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="vedika-btn pulse-gold"
          style={{
            background: 'var(--gold)',
            color: '#3A0A1E',
            fontWeight: 700,
            fontSize: '15px',
            padding: '12px 24px',
            borderRadius: '999px',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <span>➕</span>
          <span>{typeFilter === 'catering' ? 'Add catering branch' : 'Add branch'}</span>
        </button>
      </div>

      {/* Segmented Filter if owns Both */}
      {ownsBoth && (
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--line)',
              borderRadius: '999px',
              padding: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => setTypeFilter('hall')}
              style={{
                border: 'none',
                padding: '8px 20px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                background: typeFilter === 'hall' ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                color: typeFilter === 'hall' ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)',
                transition: 'all 0.2s'
              }}
            >
              🏛 Function halls
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('catering')}
              style={{
                border: 'none',
                padding: '8px 20px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                background: typeFilter === 'catering' ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                color: typeFilter === 'catering' ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)',
                transition: 'all 0.2s'
              }}
            >
              🍽 Catering kitchens
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Form OR List */}
      {isEditing ? (
        /* Stepped / Sectioned Add/Edit Form */
        <div
          className="vedika-card pop-in"
          style={{
            background: 'var(--card)',
            borderRadius: '24px',
            border: '1px solid var(--line)',
            padding: '28px',
            marginBottom: '32px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: 0, fontSize: '22px' }}>
              {editingBranchId ? '✏ Edit Branch Details' : '➕ Add New Branch'}
            </h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Stepper Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '24px' }}>
            {[
              { num: 1, label: 'Basic & Location' },
              { num: 2, label: formData.type === 'hall' ? 'Hall Capacity & Pricing' : 'Menu & Plate Rates' },
              { num: 3, label: 'Photos & Amenities' },
              { num: 4, label: 'Licence Verification' }
            ].map(step => (
              <button
                key={step.num}
                type="button"
                onClick={() => setFormStep(step.num)}
                style={{
                  background: formStep === step.num ? 'rgba(234, 171, 80, 0.31)' : 'transparent',
                  color: formStep === step.num ? 'var(--vendor-btn-text, #f8ebd8)' : 'var(--muted)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {step.num}. {step.label}
              </button>
            ))}
          </div>

          {/* STEP 1: Basic & Location */}
          {formStep === 1 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                  Branch Name *
                </label>
                <input
                  type="text"
                  className="vedika-input"
                  placeholder="e.g. Sai Function Hall - Bypass Road Branch"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                />
                {formErrors.name && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{formErrors.name}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    Street / Door No. *
                  </label>
                  <input
                    type="text"
                    className="vedika-input"
                    placeholder="e.g. 4/122 Gandhi Road"
                    value={formData.street}
                    onChange={e => setFormData({ ...formData, street: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                  {formErrors.street && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{formErrors.street}</span>}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    Area / Locality *
                  </label>
                  <input
                    type="text"
                    className="vedika-input"
                    placeholder="e.g. Yerramukkapalli"
                    value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                  {formErrors.area && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{formErrors.area}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    State
                  </label>
                  <select
                    className="vedika-input"
                    value={formData.state || 'Andhra Pradesh'}
                    onChange={e => {
                      const newState = e.target.value;
                      const dists = districtsData[newState] || [];
                      setFormData({
                        ...formData,
                        state: newState,
                        district: dists[0] || ''
                      });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Telangana">Telangana</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    District
                  </label>
                  <select
                    className="vedika-input"
                    value={formData.district || (cityDistrictMap[formData.city] || 'YSR Kadapa')}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    {(districtsData[formData.state || 'Andhra Pradesh'] || []).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    City
                  </label>
                  <input
                    type="text"
                    className="vedika-input"
                    value={formData.city}
                    onChange={e => {
                      const newCity = e.target.value;
                      const mappedDist = cityDistrictMap[newCity];
                      setFormData({
                        ...formData,
                        city: newCity,
                        ...(mappedDist ? { district: mappedDist } : {})
                      });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                    Pincode *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="vedika-input"
                    value={formData.pincode}
                    onChange={e => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                  {formErrors.pincode && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{formErrors.pincode}</span>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Hall or Catering Specs */}
          {formStep === 2 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {formData.type === 'hall' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Capacity (Max Guests)
                      </label>
                      <input
                        type="number"
                        min="50"
                        step="50"
                        className="vedika-input"
                        value={formData.capacity}
                        onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Air Conditioning (AC)
                      </label>
                      <select
                        className="vedika-input"
                        value={formData.acType}
                        onChange={e => setFormData({ ...formData, acType: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      >
                        <option value="Both">Both (Central AC + Non-AC option)</option>
                        <option value="AC">Central AC Only</option>
                        <option value="Non-AC">Non-AC Only</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Parking Spaces
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="vedika-input"
                        value={formData.parkingSpaces}
                        onChange={e => setFormData({ ...formData, parkingSpaces: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Attached Rooms
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="vedika-input"
                        value={formData.rooms}
                        onChange={e => setFormData({ ...formData, rooms: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Full Day Price (Non-AC) (₹)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        className="vedika-input"
                        value={formData.priceFullDayNonAc}
                        onChange={e => setFormData({ ...formData, priceFullDayNonAc: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Full Day Price (AC) (₹)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        className="vedika-input"
                        value={formData.priceFullDayAc}
                        onChange={e => setFormData({ ...formData, priceFullDayAc: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Half Day Price (₹)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        className="vedika-input"
                        value={formData.priceHalfDay}
                        onChange={e => setFormData({ ...formData, priceHalfDay: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Catering specs */
                <>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                      Kitchen & Prep Facility Address
                    </label>
                    <input
                      type="text"
                      className="vedika-input"
                      placeholder="e.g. Commercial Kitchen Complex, Industrial Area"
                      value={formData.kitchenAddress}
                      onChange={e => setFormData({ ...formData, kitchenAddress: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                      Cuisines Prepared
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {CUISINES_LIST.map(cuisine => {
                        const active = formData.cuisines.includes(cuisine);
                        return (
                          <button
                            key={cuisine}
                            type="button"
                            onClick={() => handleToggleCuisine(cuisine)}
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
                            {active ? '✓ ' : '+ '}{cuisine}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                      Serving Styles Supported
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {SERVING_STYLES.map(style => {
                        const active = formData.servingStyles.includes(style);
                        return (
                          <button
                            key={style}
                            type="button"
                            onClick={() => handleToggleServingStyle(style)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '999px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              border: active ? '1px solid var(--rose)' : '1px solid var(--line)',
                              background: active ? 'var(--rose)' : 'var(--bg)',
                              color: active ? '#fff' : 'var(--text)',
                              fontWeight: active ? 600 : 400
                            }}
                          >
                            {active ? '✓ ' : '+ '}{style}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '6px', color: 'var(--text)' }}>
                        Minimum Plate Count
                      </label>
                      <input
                        type="number"
                        min="50"
                        className="vedika-input"
                        value={formData.minPlates}
                        onChange={e => setFormData({ ...formData, minPlates: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text)' }}>
                      Plate Rates per Guest (₹)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '14px', border: '1px solid var(--line)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--leaf)', marginBottom: '8px' }}>🌱 Pure Veg</div>
                        {['basic', 'standard', 'premium', 'luxury'].map(tier => (
                          <div key={tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{tier}:</span>
                            <input
                              type="number"
                              value={formData.plateRates.veg[tier]}
                              onChange={e => setFormData({
                                ...formData,
                                plateRates: {
                                  ...formData.plateRates,
                                  veg: { ...formData.plateRates.veg, [tier]: Number(e.target.value) }
                                }
                              })}
                              style={{ width: '90px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line)', textAlign: 'right' }}
                            />
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '14px', border: '1px solid var(--line)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--rose)', marginBottom: '8px' }}>🍗 Non-Veg</div>
                        {['basic', 'standard', 'premium', 'luxury'].map(tier => (
                          <div key={tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{tier}:</span>
                            <input
                              type="number"
                              value={formData.plateRates.nonVeg[tier]}
                              onChange={e => setFormData({
                                ...formData,
                                plateRates: {
                                  ...formData.plateRates,
                                  nonVeg: { ...formData.plateRates.nonVeg, [tier]: Number(e.target.value) }
                                }
                              })}
                              style={{ width: '90px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line)', textAlign: 'right' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Photos & Amenities */}
          {formStep === 3 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text)' }}>
                  Branch Gallery Photos (Max 12)
                </label>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>
                  Upload photos of your hall, stage, dining hall or catering spread. The first photo or photo marked "Cover" appears on listing cards.
                </p>
                <PhotoUploader
                  photos={formData.photos}
                  onChange={newPhotos => setFormData({ ...formData, photos: newPhotos })}
                  maxPhotos={VENDOR_CONFIG.maxPhotosPerBranch}
                  branchId={editingBranchId || null}
                />
              </div>

              {formData.type === 'hall' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text)' }}>
                    Amenities Available
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {AVAILABLE_AMENITIES.map(amenity => {
                      const active = formData.amenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => handleToggleAmenity(amenity)}
                          style={{
                            padding: '8px 16px',
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
              )}
            </div>
          )}

          {/* STEP 4: Licence Verification */}
          {formStep === 4 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: '16px', border: '1px solid var(--line)' }}>
                <h4 style={{ margin: '0 0 8px', color: '#f8ebd8' }}>
                  {formData.type === 'hall' ? '🏛 Trade Licence Verification' : '🍽 FSSAI Licence Verification'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  To ensure quality and authenticity for our customers, each branch licence is verified by Utsavora AI pre-check.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                      {formData.type === 'hall' ? 'Trade Licence Number (6-20 chars)' : 'FSSAI Licence Number (14 digits starting 1 or 2)'}
                    </label>
                    <input
                      type="text"
                      className="vedika-input"
                      placeholder={formData.type === 'hall' ? 'e.g. TL-KDP-2024-9841' : 'e.g. 10123000000000'}
                      value={formData.licenceNumber}
                      onChange={e => setFormData({ ...formData, licenceNumber: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--card)' }}
                    />
                    {formErrors.licenceNumber && <span style={{ color: 'var(--rose)', fontSize: '12px' }}>{formErrors.licenceNumber}</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                      Upload Certificate (PDF / JPG / PNG, max 5 MB)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => setFormData({ ...formData, licenceFile: e.target.files[0] })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={handleVerifyBranchDoc}
                      disabled={verifyingDoc}
                      className="vedika-btn"
                      style={{
                        background: 'rgba(234, 171, 80, 0.31)',
                        color: 'var(--vendor-btn-text, #f8ebd8)',
                        border: '1px solid rgba(232, 184, 74, 0.3)',
                        padding: '10px 20px',
                        borderRadius: '999px',
                        fontWeight: 600,
                        cursor: verifyingDoc ? 'not-allowed' : 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      {verifyingDoc ? 'Verifying document…' : '⚡ Verify Document with AI'}
                    </button>
                  </div>
                </div>

                {/* Verification result card */}
                {verificationResult && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: verificationResult.status === 'Verified' ? '#E8F5E9' : '#FFF3E0',
                      border: `1px solid ${verificationResult.status === 'Verified' ? 'var(--leaf)' : 'var(--gold)'}`
                    }}
                  >
                    <div style={{ fontWeight: 600, color: verificationResult.status === 'Verified' ? 'var(--leaf)' : '#B78103', marginBottom: '6px' }}>
                      {verificationResult.status === 'Verified' ? '✅ Verified by Utsavora AI (pre-check)' : '🟡 Needs manual review (usually 24 hours)'}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#333' }}>
                      {verificationResult.checks.map((chk, idx) => (
                        <li key={idx}>{chk.name}: {chk.pass ? '✓' : '⚠️'}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
            <div>
              {formStep > 1 && (
                <button
                  type="button"
                  className="vedika-btn"
                  onClick={() => setFormStep(s => s - 1)}
                  style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)', padding: '8px 20px', borderRadius: '999px' }}
                >
                  ← Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="vedika-btn"
                onClick={() => setIsEditing(false)}
                style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', padding: '8px 20px', borderRadius: '999px' }}
              >
                Cancel
              </button>

              {formStep < 4 ? (
                <button
                  type="button"
                  className="vedika-btn"
                  onClick={() => setFormStep(s => s + 1)}
                  style={{ background: 'rgba(234, 171, 80, 0.31)', color: 'var(--vendor-btn-text, #f8ebd8)', border: '1px solid rgba(232, 184, 74, 0.3)', padding: '8px 24px', borderRadius: '999px', fontWeight: 600 }}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="vedika-btn pulse-gold"
                  onClick={handleSaveBranch}
                  style={{ background: 'var(--gold)', color: '#3A0A1E', border: 'none', padding: '10px 28px', borderRadius: '999px', fontWeight: 700 }}
                >
                  💾 Save & List Branch
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Branch Cards Grid */
        <div>
          {filteredBranches.length === 0 ? (
            <div
              className="vedika-card"
              style={{
                textAlign: 'center',
                padding: '60px 24px',
                borderRadius: '24px',
                background: 'var(--card)',
                border: '1px dashed var(--line)'
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏛</div>
              <h3 style={{ fontFamily: 'Yatra One, serif', color: '#f8ebd8', margin: '0 0 8px' }}>
                No branches added yet
              </h3>
              <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto 24px', fontSize: '14px', lineHeight: 1.5 }}>
                Tap the gold button above to add your venue or catering kitchen. Once added, it will be instantly visible to customers in Kadapa and beyond.
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="vedika-btn pulse-gold"
                style={{
                  background: 'var(--gold)',
                  color: '#3A0A1E',
                  fontWeight: 700,
                  padding: '12px 28px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ➕ Add your first branch
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '24px'
              }}
            >
              {filteredBranches.map(branch => {
                const cover = branch.coverPhoto || branch.photos?.[0]?.url;
                const isVerified = (branch.verificationStatus || 'Verified') === 'Verified';

                return (
                  <div
                    key={branch.id}
                    className="vedika-card pop-in"
                    style={{
                      background: 'var(--card)',
                      borderRadius: '24px',
                      border: '1px solid var(--line)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Cover photo or placeholder */}
                    <div
                      style={{
                        height: '180px',
                        background: cover ? `url(${cover}) center/cover no-repeat` : 'linear-gradient(135deg, var(--ink2), var(--rose))',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {!cover && (
                        <span style={{ fontSize: '44px' }}>
                          {branch.type === 'catering' ? '🍽' : '🏛'}
                        </span>
                      )}

                      {/* Status Chip */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: isVerified ? 'var(--leaf)' : 'var(--gold)',
                          color: isVerified ? '#fff' : 'var(--ink)',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: '999px',
                          letterSpacing: '0.5px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                        }}
                      >
                        {isVerified ? '✓ Verified' : '🟡 Under review'}
                      </span>

                      {/* Branch Type Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        {branch.type === 'catering' ? '🍽 Catering Kitchen' : `🏛 Function Hall · ${branch.capacity} guests`}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontFamily: 'Yatra One, serif', fontSize: '18px', color: '#f8ebd8', margin: '0 0 6px' }}>
                        {branch.name}
                      </h3>

                      <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.4 }}>
                        📍 {branch.address?.area ? `${branch.address.area}, ${branch.address.city || branch.city}` : (branch.city || 'Kadapa')}
                      </p>

                      {/* Key metrics */}
                      <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px' }}>
                        {branch.type === 'catering' ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span><strong>Min:</strong> {branch.minPlates || 100} plates</span>
                            <span><strong>Veg from:</strong> ₹{branch.plateRates?.veg?.basic || 350}</span>
                            <span><strong>Non-Veg:</strong> ₹{branch.plateRates?.nonVeg?.basic || 500}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span><strong>Day:</strong> ₹{Number(branch.pricing?.fullDayNonAc || branch.price || 0).toLocaleString('en-IN')}</span>
                            <span><strong>AC Day:</strong> ₹{Number(branch.pricing?.fullDayAc || 0).toLocaleString('en-IN')}</span>
                            <span><strong>Rooms:</strong> {branch.rooms || 4}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(branch)}
                          className="vedika-btn"
                          style={{
                            flex: 1,
                            background: 'var(--bg)',
                            color: '#f8ebd8',
                            border: '1px solid var(--line)',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            window.location.hash = `#/v/details`;
                          }}
                          className="vedika-btn"
                          style={{
                            flex: 1,
                            background: 'rgba(234, 171, 80, 0.31)',
                            color: 'var(--vendor-btn-text, #f8ebd8)',
                            border: '1px solid rgba(232, 184, 74, 0.3)',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          📅 Calendar & Details
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(branch.id)}
                          aria-label="Delete branch"
                          style={{
                            background: 'transparent',
                            color: 'var(--rose)',
                            border: '1px solid var(--line)',
                            borderRadius: '12px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '14px'
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
