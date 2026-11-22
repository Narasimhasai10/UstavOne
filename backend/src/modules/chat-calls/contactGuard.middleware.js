import { prisma } from '../../utils/prisma.js';

// Number words in English and Hindi/Telugu transliterations
const WORD_DIGIT_MAP = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
  ek: '1', do: '2', teen: '3', chaar: '4', paanch: '5', chhe: '6', saath: '7', aath: '8', nau: '9', shunya: '0'
};

export function detectPersonalContact(text) {
  if (!text || typeof text !== 'string') return null;

  const rawLower = text.toLowerCase();

  // 1. Explicit phone indicators or intent
  if (/\b(wa|whatsapp|call\s*me|my\s*number|ping\s*me\s*on|contact\s*me\s*at|ph\s*no|phone\s*no)\b/i.test(text)) {
    return 'phone_intent';
  }

  // 2. Email detection
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(text)) {
    return 'email';
  }

  // 3. UPI ID detection (e.g. name@okhdfcbank, name@upi, name@ybl, name@paytm, etc.)
  const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@(okhdfcbank|okaxis|oksbi|okicici|upi|ybl|ibl|paytm|axl|apl|barodampay|federal|idbi|pnb)/i;
  if (upiRegex.test(text)) {
    return 'upi_id';
  }

  // 4. URL / Social handles detection
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.(com|in|co|org|net|io|me)\b|instagram\.com\/|facebook\.com\/|t\.me\/|wa\.me\/)/i;
  if (urlRegex.test(text)) {
    return 'url_or_social';
  }

  // 5. Phone numbers in digits (with optional +91, spaces, dashes, dots, parentheses)
  // Clean text of non-digits to check sequences of 10+ digits starting 6-9
  const digitOnly = text.replace(/[^0-9]/g, '');
  if (/(?:^|\D)(?:\+?91[\s.-]?)?([6-9]\d{9})(?:\D|$)/.test(text)) {
    return 'phone_number';
  }

  // If there are exactly or at least 10 consecutive/spaced digits starting with 6-9
  if (/[6-9](?:[\s.-]*\d){9}/.test(text)) {
    return 'phone_number_spaced';
  }

  // Check if someone wrote digits like "nine eight four nine zero..."
  const tokens = rawLower.split(/[\s,.-]+/);
  let spelledDigits = '';
  for (const token of tokens) {
    if (WORD_DIGIT_MAP[token]) {
      spelledDigits += WORD_DIGIT_MAP[token];
    } else if (/^\d+$/.test(token)) {
      spelledDigits += token;
    } else {
      if (spelledDigits.length >= 10 && /^[6-9]/.test(spelledDigits)) {
        return 'spelled_phone_number';
      }
      spelledDigits = '';
    }
  }
  if (spelledDigits.length >= 10 && /^[6-9]/.test(spelledDigits)) {
    return 'spelled_phone_number';
  }

  // Allowed strings (like "the hall has 500 seats", "advance 50000", "cost 15000", "date 2026-11-20") must pass
  return null;
}

export async function checkContactGuard(req, res, next) {
  const messageBody = req.body.body || req.body.message || '';
  const violation = detectPersonalContact(messageBody);

  if (!violation) {
    return next();
  }

  const userId = req.user.id;
  const conversationId = req.params.id || req.body.conversationId || null;

  try {
    await prisma.contactViolation.create({
      data: {
        userId,
        conversationId,
        pattern: violation
      }
    });

    let warningInfo = null;
    if (req.user.role === 'vendor') {
      const vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId } });
      const currentWarnings = (vendorProfile?.warningsCount || 0) + 1;
      const shouldFlag = currentWarnings >= 3;

      await prisma.vendorProfile.update({
        where: { userId },
        data: {
          warningsCount: currentWarnings,
          status: shouldFlag ? 'flagged' : vendorProfile?.status || 'active'
        }
      });

      warningInfo = {
        warning: currentWarnings,
        limit: 3,
        flagged: shouldFlag
      };
    }

    return res.status(422).json({
      error: {
        code: 'CONTACT_SHARING_BLOCKED',
        message: 'Sharing personal contact details is not allowed in Utsavora and can lead to a suspension.',
        pattern: violation,
        warningInfo
      }
    });
  } catch (err) {
    next(err);
  }
}

export function containsContactInfo(text) {
  const pattern = detectPersonalContact(text);
  return {
    blocked: !!pattern,
    reason: pattern
  };
}

