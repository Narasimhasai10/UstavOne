import React, { useState, useRef, useEffect } from 'react';
import LocationSelector from './LocationSelector';

export default function LocationPopover({
  user,
  onUpdateLocation
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState(() => ({
    city: user?.city || user?.location?.city || 'Vijayawada',
    state: user?.state || user?.location?.state || 'Andhra Pradesh',
    pincode: user?.pincode || user?.location?.pincode || '',
    source: user?.location?.source || 'manual'
  }));
  const [error, setError] = useState('');
  const popoverRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const currentCity = user?.city || user?.location?.city || 'Vijayawada';

  const handleSave = () => {
    if (!tempLocation?.city?.trim()) {
      setError('Choose your city and state, or tap Use my current location.');
      return;
    }
    if (tempLocation.pincode && tempLocation.pincode.length !== 6) {
      setError('Enter a 6-digit pincode.');
      return;
    }

    onUpdateLocation(tempLocation);
    setIsOpen(false);
    setError('');
  };

  return (
    <div className="location-popover-wrapper" ref={popoverRef}>
      {/* Clickable Header Chip */}
      <button
        type="button"
        className="header-location-chip"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Change your city"
      >
        <span aria-hidden="true">📍</span>
        <span className="header-location-name">{currentCity}</span>
        <span className="header-location-caret" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="location-popover-card" role="dialog" aria-label="Update location">
          <div className="popover-arrow" aria-hidden="true" />
          <div className="popover-header">
            <h4>Update Your City</h4>
            <p>Halls and caterers near this location will appear first.</p>
          </div>

          <LocationSelector
            value={tempLocation}
            onChange={(newLoc) => {
              setTempLocation(newLoc);
              setError('');
            }}
            error={error}
            compact={true}
          />

          <div className="popover-actions">
            <button
              type="button"
              className="pill"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pill g"
              onClick={handleSave}
            >
              Save location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
