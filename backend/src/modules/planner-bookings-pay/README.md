# Planner, Bookings & Payments Module

Handles event budget optimization, AI package tier generation, atomic booking locks, calendar availability, and payment processing.

## Contents
- `planner.routes.js`: Event planner recommendation and recalculation endpoints.
- `bookings.routes.js`: Booking reservations, concurrency hold locks, and cancellation lifecycles.
- `payments.routes.js`: Payment order creation, webhook verification, and UPI integrations.
- `planner.js`: Core planner calculation and tier allocation engine.
- `pricing.js`: Dynamic catering and hall pricing calculators.
- `adapters/payments/`: Payment gateway provider adapter (Razorpay, mock UPI).
- `index.js`: Express router mounting planner, booking, and payment routes.
