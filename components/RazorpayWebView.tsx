import React, { useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface RazorpayWebViewProps {
  visible: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onFailure: (error: string) => void;
  onClose: () => void;
}

export function RazorpayWebView({
  visible,
  orderId,
  amount,
  currency,
  keyId,
  name,
  description,
  prefill,
  onSuccess,
  onFailure,
  onClose,
}: RazorpayWebViewProps) {
  const [loading, setLoading] = useState(true);

  const razorpayHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            max-width: 400px;
            width: 100%;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #FFD700;
            margin-bottom: 20px;
          }
          .amount {
            font-size: 32px;
            font-weight: bold;
            margin: 20px 0;
          }
          .description {
            color: #999;
            margin-bottom: 30px;
          }
          button {
            background: #FFD700;
            color: #000;
            border: none;
            padding: 16px 40px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
          }
          button:active {
            opacity: 0.8;
          }
          .loading {
            color: #FFD700;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">RaahEasy</div>
          <div class="amount">₹${(amount / 100).toFixed(2)}</div>
          <div class="description">${description}</div>
          <button onclick="startPayment()">Pay Now</button>
          <div class="loading" id="loading" style="display:none;">Processing...</div>
        </div>
        
        <script>
          function startPayment() {
            document.getElementById('loading').style.display = 'block';
            
            var options = {
              key: '${keyId}',
              amount: ${amount},
              currency: '${currency}',
              name: '${name}',
              description: '${description}',
              order_id: '${orderId}',
              prefill: {
                name: '${prefill.name || ''}',
                email: '${prefill.email || ''}',
                contact: '${prefill.contact || ''}'
              },
              theme: {
                color: '#FFD700'
              },
              handler: function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'success',
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  signature: response.razorpay_signature
                }));
              },
              modal: {
                ondismiss: function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'dismiss',
                    message: 'Payment cancelled by user'
                  }));
                }
              }
            };
            
            var rzp = new Razorpay(options);
            
            rzp.on('payment.failed', function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                error: response.error.description,
                code: response.error.code
              }));
            });
            
            rzp.open();
            document.getElementById('loading').style.display = 'none';
          }
          
          // Auto-start payment after 500ms
          setTimeout(() => {
            startPayment();
          }, 500);
        </script>
      </body>
    </html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'success':
          onSuccess(data.paymentId, data.orderId, data.signature);
          break;
        case 'error':
          onFailure(data.error || 'Payment failed');
          break;
        case 'dismiss':
          onFailure('Payment cancelled by user');
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
      onFailure('Payment processing error');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.gold} />
            <Text style={styles.loadingText}>Loading payment gateway...</Text>
          </View>
        )}
        
        <WebView
          source={{ html: razorpayHTML }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.text,
    fontSize: 14,
  },
});
