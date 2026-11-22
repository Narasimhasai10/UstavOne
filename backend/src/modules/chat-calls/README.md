# Chat & Calls Module

Powers secure customer-to-vendor communications, end-to-end contact information privacy guards, and masked voice calls.

## Contents
- `chat.routes.js`: Real-time chat messages, conversations, unread counters, and delivery confirmation.
- `calls.routes.js`: Virtual masked call initiation and call logs.
- `contactGuard.middleware.js`: Phone/email/UPI/external link privacy detection filter.
- `adapters/calls/`: Masked telephonic bridging adapter.
- `index.js`: Express router mounting chat and call endpoints.
