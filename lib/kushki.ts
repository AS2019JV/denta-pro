/**
 * Kushki Payment Gateway Integration
 * 
 * Documentation Reference: https://docs.kushkipagos.com/
 * Environment Variables Required:
 * - KUSHKI_PRIVATE_MERCHANT_ID
 * - KUSHKI_PUBLIC_MERCHANT_ID
 * - KUSHKI_ENVIRONMENT ('uat' or 'prod')
 */

const KUSHKI_PRIVATE_ID = process.env.KUSHKI_PRIVATE_MERCHANT_ID?.trim();
// const KUSHKI_PUBLIC_ID = process.env.KUSHKI_PUBLIC_MERCHANT_ID || 'mock_public_key';
const IS_PROD = process.env.KUSHKI_ENVIRONMENT === 'prod';

const BASE_URL = IS_PROD 
  ? 'https://api.kushkipagos.com' 
  : 'https://api-uat.kushkipagos.com';

interface SubscriptionPayload {
  token: string;
  planId: string;
  email: string;
  amount: number;
  metadata?: any;
}

export class KushkiGateway {
  
  /**
   * Create a Recurring Subscription
   * @param payload 
   */
  async createSubscription(payload: SubscriptionPayload) {
    // A configuration failure must never produce an active subscription.
    if (!KUSHKI_PRIVATE_ID || KUSHKI_PRIVATE_ID === 'mock_private_key') {
      throw new Error('Payment service is not configured');
    }

    try {
      const response = await fetch(`${BASE_URL}/subscriptions/v1/create`, {
        method: 'POST',
        headers: {
          'Private-Merchant-Id': KUSHKI_PRIVATE_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: payload.token,
          plan: {
             id: payload.planId,
             repeatEvery: 'MONTH',
             amount: {
               subtotalIva: 0,
               subtotalIva0: payload.amount,
               ice: 0,
               iva: 0,
               currency: 'USD'
             }
          },
          contactDetails: {
             email: payload.email
          },
          metadata: payload.metadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment Service Error');
      }

      return await response.json();

    } catch (error) {
       throw error;
    }
  }

  /**
   * One-time Charge (fallback)
   */
  async charge(amount: number, token: string) {
     // ... implementation for one-time payments
  }
}

export const kushki = new KushkiGateway();
