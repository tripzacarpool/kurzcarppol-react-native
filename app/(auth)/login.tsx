import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogIn, Mail, Lock, ArrowLeft, LogOut } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useSignIn, useSession, useClerk, useOAuth } from '@/lib/clerkHooks';
import { useAuthContext } from '@/contexts/AuthContext';
import { clearAllClerkSessions } from '@/lib/clerkSessionHelper';
import * as NotificationService from '@/lib/notificationService';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { session } = useSession();
  const clerk = useClerk();
  const { isSignedIn, signOut } = useAuthContext();
  // OAuth is only available on native platforms
  const oauth = Platform.OS !== 'web' ? useOAuth({ strategy: 'oauth_google' }) : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to home if already signed in
  useEffect(() => {
    if (isSignedIn) {
      console.log('✅ Already signed in, redirecting to role router...');
      router.replace('/redirect');
    }
  }, [isSignedIn]);

  const handleClearSession = async () => {
    try {
      console.log('🚪 Clearing existing session...');
      console.log('1️⃣ Clearing secure storage...');
      await clearAllClerkSessions();
      console.log('2️⃣ Signing out from Clerk...');
      await signOut();
      console.log('✅ Session cleared successfully');
      setError('Session cleared. Please sign in again.');
    } catch (err) {
      console.error('❌ Failed to clear session:', err);
      setError('Failed to clear session');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!signIn) {
        throw new Error('Clerk SignIn not initialized. Check Clerk publishable key.');
      }

      console.log('🔐 Attempting Clerk sign-in with:', email);
      const result = await signIn.create({
        identifier: email,
        password,
      });

      console.log('🔑 Clerk sign-in result:', result?.status);

      if (result?.status === 'complete') {
        console.log('✅ Login successful, Clerk session created');
        console.log('📍 Session ID:', result.createdSessionId);
        
        // Set the active session using clerk.setActive
        if (result.createdSessionId) {
          await clerk.setActive({ session: result.createdSessionId });
          console.log('✅ Session activated');
        }
        
        setEmail('');
        setPassword('');
        
        // Wait for Clerk session state to propagate
        console.log('⏳ Waiting for Clerk session to propagate...');
        let retries = 0;
        const maxRetries = 20; // 2 seconds max
        while (!session?.id && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (session?.id) {
          console.log('✅ Session state confirmed:', session.id);
        } else {
          console.log('⚠️ Session state not confirmed, but proceeding...');
        }
        
        // Send welcome notification
        const userName = session?.user?.firstName || email.split('@')[0];
        try {
          await NotificationService.sendWelcomeNotification(userName);
          console.log('🎉 Welcome notification sent');
        } catch (notifError) {
          console.log('⚠️ Could not send welcome notification:', notifError);
        }
        
        // Redirect directly to role router after login
        console.log('🚀 Redirecting to role router...');
        router.replace('/redirect');
      } else if (result?.status === 'needs_second_factor') {
        setError('Two-factor authentication required');
      } else {
        console.log('⚠️ Login status:', result?.status);
        setError('Sign in failed. Please try again.');
      }
    } catch (err: any) {
      // Ignore "session_exists" error - user is already logged in
      if (err?.errors?.[0]?.code === 'session_exists') {
        console.log('✅ Session already exists, redirecting to role router...');
        router.replace('/redirect');
        return;
      }
      
      const errorMessage = err?.errors?.[0]?.message || err?.message || JSON.stringify(err);
      setError(errorMessage);
      console.error('❌ Login error details:', {
        message: err?.message,
        errors: err?.errors,
        clerkError: err?.clerkError,
        fullError: err,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      setError('Google sign-in is not available on web. Please use email/password.');
      return;
    }

    if (!oauth?.startOAuthFlow) {
      setError('OAuth is not available');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const { createdSessionId, setActive } = await oauth.startOAuthFlow();

      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        console.log('✅ Google sign-in successful');
        router.replace('/redirect');
      } else {
        throw new Error('No session created');
      }
    } catch (err: any) {
      // Ignore "session_exists" error
      if (err?.errors?.[0]?.code === 'session_exists') {
        console.log('✅ Session already exists, redirecting to role router...');
        router.replace('/redirect');
        return;
      }
      setError(err?.errors?.[0]?.message || 'Google sign-in failed');
      console.error('Google sign-in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <LogIn size={48} color={Colors.dark.gold} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                {error.includes('session') && (
                  <TouchableOpacity
                    style={styles.clearSessionButton}
                    onPress={handleClearSession}>
                    <LogOut size={16} color="#fff" />
                    <Text style={styles.clearSessionButtonText}>Clear Session</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Mail size={20} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.dark.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Lock size={20} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <>
                  <LogIn size={20} color={Colors.dark.background} />
                  <Text style={styles.loginButtonText}>Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Google Sign-in - Only available on native platforms */}
            {Platform.OS !== 'web' && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleButton, loading && styles.buttonDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  activeOpacity={0.8}>
                  {loading ? (
                    <ActivityIndicator color={Colors.dark.background} />
                  ) : (
                    <Text style={styles.googleButtonText}>Sign in with Google</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.signupPrompt}>
              <Text style={styles.signupPromptText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderWidth: 1,
    borderColor: Colors.dark.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  clearSessionButton: {
    backgroundColor: Colors.dark.error,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  clearSessionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 56,
    color: Colors.dark.text,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.dark.background,
    fontSize: 18,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    color: Colors.dark.textSecondary,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  signupPromptText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
  signupLink: {
    color: Colors.dark.gold,
    fontSize: 15,
    fontWeight: '700',
  },
});
