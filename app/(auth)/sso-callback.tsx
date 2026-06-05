import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { GOOGLE_OAUTH_COMPLETE_URL } from '@/lib/googleOAuth';

export default function SsoCallbackScreen() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/redirect" />;
  }

  return (
    <View style={styles.container}>
      <AuthenticateWithRedirectCallback
        afterSignInUrl={GOOGLE_OAUTH_COMPLETE_URL}
        afterSignUpUrl={GOOGLE_OAUTH_COMPLETE_URL}
        redirectUrl={GOOGLE_OAUTH_COMPLETE_URL}
      />
      <ActivityIndicator size="large" color={Colors.dark.gold} />
      <Text style={styles.text}>Completing Google sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.dark.background,
  },
  text: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
});
