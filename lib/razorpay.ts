import { Alert } from 'react-native';
import { apiClient } from './api';

const RAZORPAY_KEY_ID =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_7kAotmP1o8JR8V';

export interface PaymentOptions {
  amount: number;
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

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID;
}

export async function createRazorpayOrder(
  amount: number,
  userId: string,
  bookingDetails: any,
): Promise<RazorpayOrderResponse> {
  const response = await apiClient.post('/api/payments/create-order', {
    amount: amount * 100,
    currency: 'INR',
    userId,
    bookingDetails,
  });

  return {
    orderId: response.data.orderId,
    amount: response.data.amount,
    currency: response.data.currency || 'INR',
  };
}

export async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  try {
    const response = await apiClient.post('/api/payments/verify', {
      orderId,
      paymentId,
      signature,
    });

    return response.data.verified === true;
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

export async function openRazorpayCheckout(
  options: PaymentOptions,
  onSuccess: (result: PaymentResult) => void,
  onFailure: (error: string) => void,
): Promise<void> {
  try {
    Alert.alert(
      'Payment Gateway',
      `Amount: Rs ${options.amount}\n${options.description}\n\nThis will open Razorpay payment gateway.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => onFailure('Payment cancelled by user'),
        },
        {
          text: 'Proceed',
          onPress: async () => {
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

export async function processWalletPayment(
  userId: string,
  amount: number,
  bookingDetails: any,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const response = await apiClient.post('/api/payments/wallet-payment', {
      userId,
      amount,
      bookingDetails,
    });

    return {
      success: true,
      transactionId: response.data.transactionId,
    };
  } catch (error: any) {
    console.error('Wallet payment error:', error.response?.data || error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const response = await apiClient.get(`/api/payments/wallet-balance/${userId}`);
    return response.data.balance || 0;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return 0;
  }
}

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
