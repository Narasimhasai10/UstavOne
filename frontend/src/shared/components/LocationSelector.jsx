import React, { useState, useEffect, useRef } from 'react';
import { INDIAN_LOCATIONS, getCurrentPositionAsync, reverseGeocode } from '../utils/locationService';

export default function LocationSelector({
  value,
  onChange,
  error,
  compact = false
}) {
  const [tab, setTab] = useState(value?.source === 'manual' ? 'manual' : 'auto'); // 'auto' | 'manual'
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  
  // Manual selection states
  const [selectedState, setSelectedState] = useState(value?.state || '');
  const [selectedCity, setSelectedCity] = useState(value?.city || '');
  const [customCity, setCustomCity] = useState(value?.city || '');
  const [pincode, setPincode] = useState(value?.pincode || '');
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // Dynamically augmented state cities list (in case auto-detected city wasn't in original list)
  const [locations, setLocations] = useState(() => {
    const copy = { ...INDIAN_LOCATIONS };
    if (value?.state && value?.city && copy[value.state]) {
      if (!copy[value.state].includes(value.city)) {
        copy[value.state] = [value.city, ...copy[value.state]];
      }
    }
    return copy;
  });

  // Sync with value prop if updated from outside
  useEffect(() => {
    if (value) {
      if (value.state) setSelectedState(value.state);
      if (value.city) {
        setSelectedCity(value.city);
        setCustomCity(value.city);
      }
      if (value.pincode) setPincode(value.pincode);
      if (value.source) setTab(value.source);
    }
  }, [value]);

  // Handle Geolocation detection
  const handleDetectLocation = async () => {
    setDetectError('');
    setIsDetecting(true);

    try {
      const coords = await getCurrentPositionAsync();
      const result = await reverseGeocode(coords.lat, coords.lon);

      // Add detected city to state list if not present
      if (result.state && result.city) {
        setLocations(prev => {
          const updated = { ...prev };
          const list = updated[result.state] ? [...updated[result.state]] : [];
          if (!list.includes(result.city)) {
            list.unshift(result.city);
            updated[result.state] = list;
          }
          return updated;
        });
      }

      setSelectedState(result.state);
      setSelectedCity(result.city);
      setCustomCity(result.city);
      if (result.pincode) setPincode(result.pincode);

      onChange({
        city: result.city,
        state: result.state,
        pincode: result.pincode || '',
        lat: result.lat,
        lon: result.lon,
        source: 'auto'
      });
    } catch (err) {
      setDetectError(err.message || "We couldn't find your location. Choose your city manually instead.");
    } finally {
      setIsDetecting(false);
    }
  };

  // Switch to manual mode pre-filling existing values
  const handleSwitchToManual = () => {
    setTab('manual');
    setDetectError('');
  };

  // Handle state change in manual dropdown
  const handleStateChange = (e) => {
    const st = e.target.value;
    setSelectedState(st);
    setSelectedCity('');
    setCitySearchQuery('');

    onChange({
      city: '',
      state: st,
      pincode: pincode.trim(),
      source: 'manual'
    });
  };

  // Handle city selection
  const handleCitySelect = (ct) => {
    setSelectedCity(ct);
    onChange({
      city: ct,
      state: selectedState,
      pincode: pincode.trim(),
      source: 'manual'
    });
  };

  // Handle custom free-text city
  const handleCustomCityChange = (e) => {
    const val = e.target.value;
    setCustomCity(val);
    setSelectedCity(val);
    onChange({
      city: val,
      state: selectedState,
      pincode: pincode.trim(),
      source: 'manual'
    });
  };

  // Handle pincode change (numbers only, max 6)
  const handlePincodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(val);
    onChange({
      city: selectedCity,
      state: selectedState,
      pincode: val,
      source: tab
    });
  };

  // Filter cities by search query
  const availableCities = selectedState && locations[selectedState] ? locations[selectedState] : [];
  const filteredCities = availableCities.filter(c => 
    c.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  const hasAutoSuccess = value?.source === 'auto' && value?.city;

  return (
    <div className={`location-field-wrapper ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <div className="location-field-header">
          <label className="field-label" style={{ marginBottom: '2px' }}>
            Your location <span style={{ color: 'var(--rose)' }}>*</span>
          </label>
          <p className="location-field-sub">
            We show halls and caterers from your city first. You can change it anytime.
          </p>
        </div>
      )}

      {/* Segmented Radio Toggle (Pills style) */}
      <div
        className="location-segmented-toggle"
        role="radiogroup"
        aria-label="Location method"
      >
        <button
          type="button"
          role="radio"
          aria-checked={tab === 'auto'}
          className={`loc-toggle-pill ${tab === 'auto' ? 'is-active' : ''}`}
          onClick={() => {
            setTab('auto');
            setDetectError('');
          }}
        >
          Detect automatically
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tab === 'manual'}
          className={`loc-toggle-pill ${tab === 'manual' ? 'is-active' : ''}`}
          onClick={handleSwitchToManual}
        >
          Choose manually
        </button>
      </div>

      {/* TAB A: DETECT AUTOMATICALLY */}
      {tab === 'auto' && (
        <div className="loc-auto-content" aria-live="polite">
          {!hasAutoSuccess ? (
            <>
              <button
                type="button"
                className="loc-detect-btn cta ghost"
                onClick={handleDetectLocation}
                disabled={isDetecting}
                aria-busy={isDetecting}
              >
                {isDetecting ? (
                  <span className="loc-detecting-spinner">
                    Finding your location
                    <span className="bouncing-dots" aria-hidden="true">
                      <span className="dot-bounce">.</span>
                      <span className="dot-bounce">.</span>
                      <span className="dot-bounce">.</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>📍</span>
                    <span>Use my current location</span>
                  </>
                )}
              </button>

              <p className="loc-privacy-note">
                🔒 We only use your location to show nearby halls and caterers.
              </p>
            </>
          ) : (
            /* Result Card with Green Tint */
            <div className="loc-success-card">
              <div className="loc-success-info">
                <span className="loc-pin" aria-hidden="true">📍</span>
                <div>
                  <strong>{value.city}, {value.state || 'India'}</strong>
                  {value.pincode && <span className="loc-pin-code"> &middot; {value.pincode}</span>}
                  <span className="loc-badge-auto">Detected</span>
                </div>
              </div>
              <button
                type="button"
                className="loc-change-link"
                onClick={handleSwitchToManual}
              >
                Change
              </button>
            </div>
          )}

          {/* Detect Error Message */}
          {detectError && (
            <div className="loc-error-box">
              <p className="field-error" style={{ margin: '6px 0 8px' }}>
                ⚠️ {detectError}
              </p>
              <button
                type="button"
                className="loc-switch-manual-btn"
                onClick={handleSwitchToManual}
              >
                Switch to manual selection →
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB B: CHOOSE MANUALLY */}
      {tab === 'manual' && (
        <div className="loc-manual-content">
          {/* State Dropdown */}
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="field-label" htmlFor="loc-state-select" style={{ fontSize: '0.85rem' }}>
              State
            </label>
            <select
              id="loc-state-select"
              className="vedika-input"
              value={selectedState}
              onChange={handleStateChange}
            >
              <option value="">-- Select State --</option>
              {Object.keys(locations).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* City Dropdown & Search-as-you-type */}
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="field-label" htmlFor="loc-city-select" style={{ fontSize: '0.85rem' }}>
              City
            </label>

            {selectedState === 'Other' ? (
              <input
                type="text"
                className="vedika-input"
                placeholder="Enter your city name"
                value={customCity}
                onChange={handleCustomCityChange}
              />
            ) : (
              <>
                <select
                  id="loc-city-select"
                  className="vedika-input"
                  value={selectedCity}
                  disabled={!selectedState}
                  onChange={(e) => {
                    const ct = e.target.value;
                    if (ct === '__custom__') {
                      setSelectedCity('Other City');
                    } else {
                      handleCitySelect(ct);
                    }
                  }}
                >
                  <option value="">
                    {!selectedState ? 'Select state first' : '-- Select City --'}
                  </option>
                  {availableCities.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                  <option value="__custom__">Other City...</option>
                </select>

                {/* Search as you type filter if state is selected */}
                {selectedState && availableCities.length > 5 && (
                  <div className="city-search-box" style={{ marginTop: '6px' }}>
                    <input
                      type="text"
                      className="vedika-input"
                      style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                      placeholder="Type to filter cities..."
                      value={citySearchQuery}
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                    />
                    {citySearchQuery && (
                      <div className="city-filter-results">
                        {filteredCities.map((ct) => (
                          <button
                            type="button"
                            key={ct}
                            className={`city-result-chip ${selectedCity === ct ? 'is-selected' : ''}`}
                            onClick={() => {
                              handleCitySelect(ct);
                              setCitySearchQuery('');
                            }}
                          >
                            {ct}
                          </button>
                        ))}
                        {filteredCities.length === 0 && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '4px' }}>
                            No matching city. Choose "Other City..." above.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Optional Pincode Field */}
          <div className="form-group" style={{ marginBottom: '4px' }}>
            <label className="field-label" htmlFor="loc-pincode" style={{ fontSize: '0.85rem' }}>
              Pincode <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="loc-pincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="vedika-input"
              placeholder="e.g. 520001"
              value={pincode}
              onChange={handlePincodeChange}
            />
          </div>
        </div>
      )}

      {/* Validation Error Message */}
      {error && (
        <p className="field-error" style={{ marginTop: '8px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
