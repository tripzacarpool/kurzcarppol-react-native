import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

interface Props {
  label?: string;
}

const ForceLogoutButton: React.FC<Props> = ({ label = 'Force Logout' }) => {
  const { signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleForceLogout = async () => {
    try {
      setLoading(true);
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      // Non-blocking: signOut already clears state even on errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleForceLogout}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={Colors.dark.background} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ForceLogoutButton;
