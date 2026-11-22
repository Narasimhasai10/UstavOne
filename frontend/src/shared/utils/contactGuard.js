/**
 * Personal Contact Guard Utility
 * Detects phone numbers, emails, whatsapp mentions, call requests, UPI IDs, and links.
 */

const DIGIT_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9'
};

export function checkContactDetails(text) {
  if (!text || typeof text !== 'string') {
    return { hasViolation: false, blocked: false, reasons: [], reason: '', warning: '' };
  }

  const reasons = [];
  const lower = text.toLowerCase().trim();

  // 1. WhatsApp mentions
  if (/\b(whatsapp|whats app|wa\.me)\b/i.test(lower)) {
    reasons.push('Mentioning WhatsApp is prohibited.');
  }

  // 2. "Call me" or contact requests
  if (/\b(call\s*me|call\s*on|reach\s*me\s*at|contact\s*me\s*at|ping\s*me)\b/i.test(lower)) {
    reasons.push('Requesting direct external contact is prohibited.');
  }

  // 3. Email address detection
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(lower)) {
    reasons.push('Sharing email addresses is prohibited.');
  }

  // 4. UPI ID detection
  if (/[a-zA-Z0-9.\-_]{2,}@(upi|okaxis|okhdfcbank|oksbi|okicici|paytm|ybl|ibl|barodampay|axl)\b/i.test(lower)) {
    reasons.push('Sharing UPI payment IDs is prohibited.');
  }

  // 5. External Web Links
  if (/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|in|org|net|io|me|co)\b)/i.test(lower)) {
    reasons.push('Sharing external links is prohibited.');
  }

  // 6. Direct & Spaced Phone Numbers
  // Remove non-alphanumeric except spaces
  const digitsOnly = lower.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    // Check for 10-digit sequence or +91 pattern
    if (/(\+?91[\s\-]?)?[6-9]\d{9}/.test(digitsOnly) || /[6-9]\d{9}/.test(digitsOnly)) {
      reasons.push('Sharing phone numbers is prohibited.');
    }
  }

  // 7. Spelled-out phone numbers (e.g. "nine three nine zero zero...")
  const words = lower.split(/\s+/);
  let spelledDigits = '';
  for (const w of words) {
    const cleanWord = w.replace(/[^a-z]/g, '');
    if (DIGIT_WORDS[cleanWord]) {
      spelledDigits += DIGIT_WORDS[cleanWord];
    } else if (/^\d+$/.test(w)) {
      spelledDigits += w;
    }
  }

  if (spelledDigits.length >= 10 && /[6-9]\d{9}/.test(spelledDigits)) {
    if (!reasons.some(r => r.includes('phone'))) {
      reasons.push('Sharing phone numbers (spelled out) is prohibited.');
    }
  }

  const hasViolation = reasons.length > 0;
  const warning = hasViolation
    ? 'Sharing personal contact details is not allowed in Utsavora and can lead to a suspension.'
    : '';

  return {
    hasViolation,
    blocked: hasViolation,
    reasons,
    reason: reasons[0] || '',
    warning
  };
}

export const containsContactInfo = checkContactDetails;
export default checkContactDetails;
