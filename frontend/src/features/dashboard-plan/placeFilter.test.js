import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  getStoredPlaceFilter,
  setStoredPlaceFilter,
  clearStoredPlaceFilter
} from './placeFilter.js';

describe('Place Filter Persistence & Deselection Tests', () => {
  // Mock sessionStorage for Node environment
  const mockStorage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
  };

  beforeEach(() => {
    clearStoredPlaceFilter();
  });

  it('1. Returns empty filter when no filter is stored', () => {
    const filter = getStoredPlaceFilter();
    assert.deepStrictEqual(filter, { state: null, district: null });
  });

  it('2. Stores and retrieves place filter correctly under utsavora_place_filter', () => {
    setStoredPlaceFilter({ state: 'Andhra Pradesh', district: 'YSR Kadapa' });
    const stored = getStoredPlaceFilter();
    assert.strictEqual(stored.state, 'Andhra Pradesh');
    assert.strictEqual(stored.district, 'YSR Kadapa');

    // Verify key in sessionStorage
    const raw = globalThis.sessionStorage.getItem('utsavora_place_filter');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.district, 'YSR Kadapa');
  });

  it('3. Clears stored place filter when deselecting or calling clearStoredPlaceFilter', () => {
    setStoredPlaceFilter({ state: 'Andhra Pradesh', district: 'East Godavari' });
    assert.strictEqual(getStoredPlaceFilter().district, 'East Godavari');

    clearStoredPlaceFilter();
    assert.deepStrictEqual(getStoredPlaceFilter(), { state: null, district: null });
    assert.strictEqual(globalThis.sessionStorage.getItem('utsavora_place_filter'), null);
  });

  it('4. Toggle deselect logic: clicking same district deselects, clicking new district switches', () => {
    let currentFilter = { state: null, district: null };

    // Helper simulating district click in popover
    function handleDistrictClick(state, district) {
      if (currentFilter.district === district) {
        currentFilter = { state: null, district: null };
      } else {
        currentFilter = { state, district };
      }
      setStoredPlaceFilter(currentFilter);
    }

    // Step A: Pick YSR Kadapa -> selected
    handleDistrictClick('Andhra Pradesh', 'YSR Kadapa');
    assert.strictEqual(currentFilter.district, 'YSR Kadapa');
    assert.strictEqual(getStoredPlaceFilter().district, 'YSR Kadapa');

    // Step B: Pick YSR Kadapa again -> toggled off (deselected)
    handleDistrictClick('Andhra Pradesh', 'YSR Kadapa');
    assert.strictEqual(currentFilter.district, null);
    assert.strictEqual(getStoredPlaceFilter().district, null);

    // Step C: Pick East Godavari -> selected
    handleDistrictClick('Andhra Pradesh', 'East Godavari');
    assert.strictEqual(currentFilter.district, 'East Godavari');
    assert.strictEqual(getStoredPlaceFilter().district, 'East Godavari');

    // Step D: Pick Hyderabad -> switched
    handleDistrictClick('Telangana', 'Hyderabad');
    assert.strictEqual(currentFilter.district, 'Hyderabad');
    assert.strictEqual(currentFilter.state, 'Telangana');
    assert.strictEqual(getStoredPlaceFilter().district, 'Hyderabad');
  });
});
