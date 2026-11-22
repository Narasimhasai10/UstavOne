import React from 'react';

export default function DashboardLocationModal({
  showLocationModal,
  onClose,
  tempState,
  setTempState,
  tempCity,
  setTempCity,
  availableCitiesForState,
  handleConfirmLocation,
  CITIES_BY_STATE
}) {
  if (!showLocationModal) return null;

  return (
          {showLocationModal && (
            <div className="md on" role="dialog" aria-modal="true" aria-label="Switch city">
              <div className="mb">
                <button
                  type="button"
                  className="x"
                  onClick={() => setShowLocationModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>Choose your city</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '4px', marginBottom: '16px' }}>
                  We show halls and caterers from your city first. You can change it anytime.
                </p>
    
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>State</label>
                  <select
                    value={tempState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setTempState(newState);
                      const cities = CITIES_BY_STATE[newState] || [];
                      if (cities.length > 0) setTempCity(cities[0]);
                    }}
                  >
                    {Object.keys(CITIES_BY_STATE).map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
    
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>City</label>
                  <select
                    value={tempCity}
                    onChange={(e) => setTempCity(e.target.value)}
                  >
                    {availableCitiesForState.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
    
                <button
                  type="button"
                  className="btn"
                  onClick={handleConfirmLocation}
                >
                  Show this city
                </button>
              </div>
            </div>
          )}
        </div>
  );
}
