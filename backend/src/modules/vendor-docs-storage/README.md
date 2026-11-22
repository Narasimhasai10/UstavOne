# Vendor, Documents & Storage Module

Handles vendor portal operations, branches, previous works gallery, revenue analytics, KYC document verification, and asset uploads.

## Contents
- `vendor.routes.js`: Authenticated vendor portal endpoints (branches, bookings, previous works, revenue).
- `vendors.routes.js`: Public vendor catalog and directory listing endpoints.
- `revenue.service.js`: Revenue analytics and financial reporting engine.
- `documentVerifier.js`: Automated business license & FSSAI verification adapter.
- `upload.middleware.js`: Multipart photo and document storage handler.
- `index.js`: Express router mounting vendor portal and public vendors endpoints.
