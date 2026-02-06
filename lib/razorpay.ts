import { Alert } from 'react-native';

const RAZORPAY_KEY_ID =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_7kAotmP1o8JR8V';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.161:5000';

export interface PaymentOptions {
  amount: number; // in rupees
  currency?: string;
  description: string;
  orderId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
}

export interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
}

/**
 * Get Razorpay Key ID
 */
export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID;
}

/**
 * Create Razorpay order on backend
 */
export async function createRazorpayOrder(
  amount: number,
  userId: string,
  bookingDetails: any,
): Promise<RazorpayOrderResponse> {
  try {
    const response = await fetch(`${API_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        userId,
        bookingDetails,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment order');
    }

    const data = await response.json();
    return {
      orderId: data.orderId,
      amount: data.amount,
      currency: data.currency || 'INR',
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
}

/**
 * Verify payment on backend
 */
export async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentId,
        signature,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.verified === true;
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

/**
 * Open Razorpay checkout (Web-based for React Native)
 * For native apps, you'd use react-native-razorpay
 */
export async function openRazorpayCheckout(
  options: PaymentOptions,
  onSuccess: (result: PaymentResult) => void,
  onFailure: (error: string) => void,
): Promise<void> {
  try {
    // For React Native, we'll use WebView-based checkout
    // This is a simplified version - in production, use react-native-razorpay

    Alert.alert(
      'Payment Gateway',
      `Amount: ₹${options.amount}\n${options.description}\n\nThis will open Razorpay payment gateway.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => onFailure('Payment cancelled by user'),
        },
        {
          text: 'Proceed',
          onPress: async () => {
            // Simulate payment for demo
            // In production, integrate with react-native-razorpay
            const mockPaymentId = `pay_${Math.random().toString(36).substring(7)}`;
            onSuccess({
              success: true,
              paymentId: mockPaymentId,
              orderId: options.orderId,
            });
          },
        },
      ],
    );
  } catch (error: any) {
    onFailure(error.message || 'Payment failed');
  }
}

/**
 * Process wallet payment
 */
export async function processWalletPayment(
  userId: string,
  amount: number,
  bookingDetails: any,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const url = `${API_URL}/api/payments/wallet-payment`;
    console.log('💰 Processing wallet payment...');
    console.log('📍 URL:', url);
    console.log('👤 User ID:', userId);
    console.log('💵 Amount:', amount);
    console.log('📋 Booking:', JSON.stringify(bookingDetails));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        amount,
        bookingDetails,
      }),
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response OK:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response error:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || 'Wallet payment failed' };
      }
      throw new Error(error.message || 'Wallet payment failed');
    }

    const data = await response.json();
    console.log('✅ Payment successful:', data);
    return { success: true, transactionId: data.transactionId };
  } catch (error: any) {
    console.error('Wallet payment error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user wallet balance
 */
export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const response = await fetch(
      `${API_URL}/api/payments/wallet-balance/${userId}`,
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.balance || 0;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return 0;
  }
}

/**
 * Add money to wallet
 */
export async function addMoneyToWallet(
  userId: string,
  amount: number,
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const order = await createRazorpayOrder(amount, userId, {
      type: 'wallet_recharge',
      amount,
    });

    return { success: true, orderId: order.orderId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
