import fs from 'fs';

let content = fs.readFileSync('frontend/src/services/rajahmundryOfflineData.js', 'utf8');

// Replace state: 'Andhra Pradesh', in branch definitions with state + district
content = content.replace(/state: 'Andhra Pradesh',/g, "state: 'Andhra Pradesh',\n      district: 'East Godavari',");

// Also add lowercase keys to SEEDED_RAJAHMUNDRY_BRANCHES_BY_VENDOR and SEEDED_RAJAHMUNDRY_BOOKINGS_BY_VENDOR if not present
fs.writeFileSync('frontend/src/services/rajahmundryOfflineData.js', content);
console.log('Updated rajahmundryOfflineData.js successfully');
