import crypto from 'node:crypto';

/**
 * PRODUCTION NOTE:
 * In production, phone numbers must remain strictly confidential.
 * Production integrations should bridge calls using masked-number / VoIP providers:
 * - Exotel / Twilio Voice Proxy: dials user & vendor and connects them via a virtual pool number.
 * - Agora WebRTC / LiveKit: direct in-app voice calling over secure WebSockets/WebRTC.
 * Under no circumstances should real personal phone numbers ever be returned in API responses or logged.
 */

export class MockCallProvider {
  async startCall({ conversationId, callerRole, calleeRole }) {
    return {
      callId: `call_${crypto.randomUUID().slice(0, 8)}`,
      status: 'ringing',
      calleeLabel: calleeRole === 'vendor' ? 'Hall / Catering Manager' : 'Customer',
      providerRef: `mock_ref_${Date.now()}`
    };
  }

  async endCall({ callId }) {
    return {
      callId,
      status: 'ended',
      durationSec: Math.floor(Math.random() * 180) + 45
    };
  }
}

export function getCallProvider() {
  return new MockCallProvider();
}
