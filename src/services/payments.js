/**
 * Simulated Razorpay / Payment Gateway Adapter
 * Production will swap this adapter for the official Razorpay Checkout SDK.
 */
export function createPaymentSession(amountOrDetails, method = 'upi', meta = {}) {
  const amount = typeof amountOrDetails === 'object'
    ? (amountOrDetails.amount || amountOrDetails.totalAmount)
    : amountOrDetails;

  const payMethod = method || (typeof amountOrDetails === 'object' ? amountOrDetails.method : 'upi') || 'upi';
  const paymentId = 'PAY_RZP_MOCK_' + Math.random().toString(36).substring(2, 9).toUpperCase();

  return {
    paymentId,
    id: paymentId,
    currency: 'INR',
    amount: amount || 0,
    method: payMethod,
    vendorName: (meta && meta.vendorName) || (typeof amountOrDetails === 'object' && amountOrDetails.vendorName) || 'Vedika Partner',
    status: 'created'
  };
}

export async function processPayment(sessionOrOpts, isSuccess = true) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let success = isSuccess;
      if (typeof sessionOrOpts === 'object' && sessionOrOpts.simulateFailure === true) {
        success = false;
      }

      if (success) {
        resolve({
          success: true,
          status: 'Confirmed',
          paymentId: sessionOrOpts?.paymentId || ('PAY_RZP_' + Math.random().toString(36).substring(2, 9).toUpperCase()),
          amount: sessionOrOpts?.amount || 0,
          timestamp: new Date().toISOString()
        });
      } else {
        resolve({
          success: false,
          status: 'Failed',
          error: 'Payment failed. No money was deducted.',
          timestamp: new Date().toISOString()
        });
      }
    }, 400);
  });
}
