# Auth, Users & Admin Module

Handles authentication, customer and vendor accounts, JWT token rotation, user profile administration, public system configurations, and platform notifications.

## Contents
- `auth.routes.js`: Authentication endpoints (customer/vendor registration, login, token refresh, password management).
- `public.routes.js`: Public metadata, available locations, and platform configuration.
- `admin.routes.js`: Administrator metrics, audit logging, and role verification.
- `notifications.routes.js`: In-app and push notification endpoints.
- `auth.middleware.js`: JWT authentication and role authorization middleware.
- `rateLimit.middleware.js`: Rate limiting and brute-force protection.
- `index.js`: Express router mounting all module routes.
