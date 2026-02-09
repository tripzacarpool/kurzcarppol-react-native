import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import * as NotificationService from '@/lib/notificationService';

export default function PushNotificationDebug() {
  const { user } = useAuth();
  const [result, setResult] = useState<string>('');

  const testPushToken = async () => {
    try {
      setResult('🔄 Getting push token...');
      
      // Get push token
      const token = await NotificationService.getExpoPushToken();
      if (!token) {
        setResult('❌ Could not get push token - Firebase not configured');
        return;
      }

      setResult(`✅ Got push token: ${token.substring(0, 50)}...`);
      
      // Register with backend
      if (user?.id) {
        const registered = await NotificationService.registerPushToken(user.id, token);
        if (registered) {
          setResult(prev => prev + '\\n✅ Token registered with backend');
        } else {
          setResult(prev => prev + '\\n⚠️ Failed to register with backend');
        }
      }
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    }
  };

  const sendTestNotification = async () => {
    try {
      if (!user?.id) {
        setResult('❌ No user logged in');
        return;
      }

      setResult('🔄 Sending test notification...');

      const response = await apiClient.post('/api/users/test-push', {
        clerkId: user.id,
      });

      if (response.data.success) {
        setResult('✅ Test notification sent successfully!');
      } else {
        setResult(`❌ Failed: ${response.data.error}`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.details || error.message;
      const debug = error.response?.data?.debug;
      
      let resultText = `❌ Error: ${errorMsg}`;
      if (debug) {
        resultText += `\\n📊 Debug: ${JSON.stringify(debug, null, 2)}`;
      }
      setResult(resultText);
    }
  };

  const testLocalNotification = async () => {
    try {
      setResult('🔄 Sending local notification...');
      
      await NotificationService.sendLocalNotification(
        '🧪 Local Test',
        'This is a local notification test',
        { type: 'test' }
      );
      
      setResult('✅ Local notification sent!');
    } catch (error: any) {
      setResult(`❌ Local notification error: ${error.message}`);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Push Notification Debug</Text>
        <Text style={styles.text}>Need to be logged in</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Push Notification Debug</Text>
      <Text style={styles.subtitle}>User: {user.firstName || user.emailAddresses?.[0]?.emailAddress}</Text>
      
      <TouchableOpacity style={styles.button} onPress={testPushToken}>
        <Text style={styles.buttonText}>1️⃣ Get & Register Push Token</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testLocalNotification}>
        <Text style={styles.buttonText}>2️⃣ Test Local Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
        <Text style={styles.buttonText}>3️⃣ Test Push Notification</Text>
      </TouchableOpacity>

      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Result:</Text>
        <Text style={styles.resultText}>{result || 'Press a button to test...'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.dark.gold,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  text: {
    fontSize: 16,
    color: Colors.dark.text,
  },
});