# Booking & Chat Feature

Powers customer bookings, advance payment gateway integration, real-time customer-vendor chat, and masked audio calls.

## Contents
- `BookingPage.jsx`: Package booking flow, date selection, guest details, and advance breakdown.
- `PaymentModal.jsx`: Interactive UPI QR code and mock payment checkout dialog.
- `MyBookingsView.jsx`: Customer bookings dashboard with cancellation, receipts, and chat shortcuts.
- `ChatScreen.jsx`: Real-time chat view with message retry, unread counters, and delivery state.
- `CallModal.jsx`: Virtual phone bridging dialog for masked audio calls.
- `chatStore.js` & `chatSocket.js`: Persistent client chat store and WebSocket transport.
- `bookingService.js` & `paymentService.js`: Local and remote booking/payment controllers.
- `booking-chat.css`: Chat bubbles, call overlays, payment modals, and booking card styles.
