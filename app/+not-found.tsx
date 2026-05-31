import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 300);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.gold} />
        <Text style={styles.text}>Opening Tripza...</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  text: {
    marginTop: 16,
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
