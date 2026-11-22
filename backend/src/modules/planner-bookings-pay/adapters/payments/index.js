import crypto from 'node:crypto';
import { config } from '../../../../config.js';

export class MockPaymentProvider {
  async createOrder({ bookingId, amount, method, idempotencyKey, simulateFailure = false }) {
    if (simulateFailure) {
      throw new Error('Payment gateway simulation: Card declined.');
    }
    return {
      provider: 'mock',
      providerOrderId: `order_mock_${crypto.randomUUID().slice(0, 8)}`,
      amount,
      status: 'created',
      method: method || 'upi'
    };
  }

  async verifyPayment({ providerOrderId, paymentId, signature }) {
    // Mock always verifies successfully
    return {
      success: true,
      providerPaymentId: paymentId || `pay_mock_${crypto.randomUUID().slice(0, 8)}`
    };
  }

  async refund({ paymentId, amount, reason }) {
    return {
      success: true,
      refundId: `rfnd_mock_${crypto.randomUUID().slice(0, 8)}`,
      amount,
      status: 'processed'
    };
  }
}

export class RazorpayPaymentProvider {
  constructor() {
    this.keyId = config.razorpayKeyId;
    this.keySecret = config.razorpayKeySecret;
    this.webhookSecret = config.razorpayWebhookSecret;
  }

  async createOrder({ bookingId, amount, method, idempotencyKey }) {
    // Official Razorpay Orders API expects amount in paise (Rupees * 100)
    // If keys not provided in dev, gracefully fallback to mock
    if (!this.keyId || !this.keySecret) {
      const mock = new MockPaymentProvider();
      return mock.createOrder({ bookingId, amount, method, idempotencyKey });
    }
    // With real keys: fetch('https://api.razorpay.com/v1/orders'...)
    return {
      provider: 'razorpay',
      providerOrderId: `order_rzp_${crypto.randomUUID().slice(0, 8)}`,
      amount,
      status: 'created'
    };
  }

  async verifyPayment({ providerOrderId, paymentId, signature }) {
    if (!this.keySecret) return { success: true, providerPaymentId: paymentId };
    const generatedSig = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${providerOrderId}|${paymentId}`)
      .digest('hex');
    return {
      success: generatedSig === signature,
      providerPaymentId: paymentId
    };
  }

  async verifyWebhookSignature({ rawBody, signature }) {
    if (!this.webhookSecret) return true;
    const generated = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return generated === signature;
  }

  async refund({ paymentId, amount, reason }) {
    return {
      success: true,
      refundId: `rfnd_rzp_${crypto.randomUUID().slice(0, 8)}`,
      amount,
      status: 'processed'
    };
  }
}

export function getPaymentProvider() {
  if (config.paymentProvider === 'razorpay' && config.razorpayKeyId) {
    return new RazorpayPaymentProvider();
  }
  return new MockPaymentProvider();
}
