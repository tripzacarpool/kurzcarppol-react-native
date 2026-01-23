import { useState } from 'react';
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
import { UserPlus, Mail, Lock, User, ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import Animated from 'react-native-reanimated';
import { FadeInDown, FadeIn } from 'react-native-reanimated';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signUpError } = await signUp(email, password, fullName);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    const { error: googleError } = await signInWithGoogle();

    if (googleError) {
      let errorMessage = googleError.message;

      if (errorMessage.includes('provider') || errorMessage.includes('not enabled')) {
        errorMessage = 'Google sign-up is not configured yet. Please check GOOGLE_OAUTH_SETUP.md for setup instructions.';
      }

      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View entering={FadeIn.duration(800)} style={styles.successContainer}>
          <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.successIcon}>
            <UserPlus size={64} color={Colors.dark.gold} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(700).delay(100).springify()} style={styles.successTitle}>
            Account Created!
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(700).delay(200).springify()} style={styles.successSubtitle}>
            Welcome to the ride-sharing community. You can now start booking rides.
          </Animated.Text>
          <Animated.View entering={FadeInDown.duration(700).delay(300).springify()} style={{ width: '100%' }}>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}>
              <Text style={styles.successButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    );
  }

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

          <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.header}>
            <View style={styles.iconContainer}>
              <UserPlus size={48} color={Colors.dark.gold} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the ride-sharing community</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={styles.form}>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={20} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                editable={!loading}
              />
            </View>

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
                autoComplete="password-new"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Lock size={20} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <>
                  <UserPlus size={20} color={Colors.dark.background} />
                  <Text style={styles.signupButtonText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.terms}>
              <Text style={styles.termsText}>
                By signing up, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              text="Sign up with Google"
            />

            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    marginBottom: 32,
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
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: Colors.dark.background,
    fontSize: 18,
    fontWeight: '700',
  },
  terms: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginPromptText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
  loginLink: {
    color: Colors.dark.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  successButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: Colors.dark.background,
    fontSize: 18,
    fontWeight: '700',
  },
});
