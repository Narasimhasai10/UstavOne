# Shared Library & Utilities

Shared components, HTTP client, unified data-service, utility helpers, and common domain models used across all frontend features.

## Contents
- `api/`: Axios/fetch client with offline fallback and mock support.
- `data-service/`: Unified data access layer bridging local storage and backend endpoints.
- `services/`: Master store (`store.js`) managing persistent collections and customer/vendor catalogs.
- `components/`: Common UI elements (`Header`, `DiyaLoader`, `LocationSelector`, `LocationPopover`, `ErrorBoundary`, `Confetti`).
- `utils/`: Contrast calculations, image compression, QR generation, privacy guards, location resolvers.
- `data/`: Cities, districts, dummy vendor catalogs, and state mappings.
- `styles/base.css`: Global design tokens, typography, button primitives, and resets.
