import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import { ArrowLeft, User, FileText, Car, CreditCard, Check, Mail, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { RidePartnerApplicationPayload } from '@/lib/api';

type DriverSignupStep = 'account' | 'personal' | 'license' | 'vehicle' | 'bank';

interface DriverFormData {
  // Account
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  // Personal
  phone: string;
  profilePhotoUrl: string;
  // License
  licenseNumber: string;
  licensePhotoUrl: string;
  // Vehicle
  carModel: string;
  vehicleNumber: string;
  vehiclePhotoUrl: string;
  // Bank
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}

export default function DriverSignupScreen() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<DriverSignupStep>('account');
  const [formData, setFormData] = useState<DriverFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    profilePhotoUrl: '',
    licenseNumber: '',
    licensePhotoUrl: '',
    carModel: '',
    vehicleNumber: '',
    vehiclePhotoUrl: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const steps: DriverSignupStep[] = ['account', 'personal', 'license', 'vehicle', 'bank'];
  const currentStepIndex = steps.indexOf(step);

  const updateField = (field: keyof DriverFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    setError('');
  };

  const validateStep = (): boolean => {
    switch (step) {
      case 'account':
        if (!formData.email || !formData.password || !formData.confirmPassword) {
          setError('Please fill in all account fields');
          return false;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        if (!formData.firstName || !formData.lastName) {
          setError('Please enter your full name');
          return false;
        }
        return true;

      case 'personal':
        if (!formData.phone) {
          setError('Phone number is required');
          return false;
        }
        return true;

      case 'license':
        if (!formData.licenseNumber) {
          setError('License number is required');
          return false;
        }
        return true;

      case 'vehicle':
        if (!formData.carModel || !formData.vehicleNumber) {
          setError('Vehicle model and number are required');
          return false;
        }
        return true;

      case 'bank':
        if (!formData.accountHolderName || !formData.accountNumber || !formData.ifscCode) {
          setError('All bank details are required');
          return false;
        }
        return true;

      default:
        return false;
    }
  };

  const nextStep = () => {
    if (!validateStep()) return;
    
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1]);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1]);
    } else {
      router.back();
    }
  };

  const handleComplete = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🔐 Starting driver account creation...');
      
      // Step 1: Create Clerk account
      if (!signUp) {
        throw new Error('Clerk signUp not initialized');
      }

      console.log('📝 Creating account with email:', formData.email);
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      console.log('📊 Signup result status:', result?.status);
      console.log('🆔 Created user ID:', result?.createdUserId);

      if (!result || result.status !== 'complete') {
        const status = result?.status || 'unknown';
        const message = `Account creation status: ${status}. Please try again.`;
        console.error('❌ Signup failed:', message);
        setError(message);
        setLoading(false);
        return;
      }

      const clerkId = result.createdUserId;
      if (!clerkId) {
        throw new Error('No user ID returned from Clerk');
      }

      console.log('✅ Account created:', clerkId);

      // Step 2: Store driver application data AND role for submission on first login
      // (Auth session not ready yet, so we'll submit this when user logs in)
      
      // Store role preference for sync
      await AsyncStorage.setItem('user_role_preference', 'ride_partner');
      
      const driverApplicationData: RidePartnerApplicationPayload = {
        clerkId,
        mode: 'daily',
        vehicleType: 'personal',
        basicProfile: {
          fullName: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          profilePhotoUrl: formData.profilePhotoUrl || undefined,
        },
        vehicleDetails: {
          carModel: formData.carModel,
          vehicleNumber: formData.vehicleNumber.toUpperCase(),
          vehiclePhotoUrl: formData.vehiclePhotoUrl || undefined,
        },
        licenseDetails: {
          licenseNumber: formData.licenseNumber.toUpperCase(),
          licensePhotoUrl: formData.licensePhotoUrl || undefined,
        },
        payoutDetails: {
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode.toUpperCase(),
        },
        declaration: {
          communityRulesAccepted: true,
          ownershipConsent: true,
          acceptedAt: new Date().toISOString(),
        },
      };

      // Store in AsyncStorage for submission after login
      await AsyncStorage.setItem(
        'pending_driver_application',
        JSON.stringify(driverApplicationData)
      );
      console.log('✅ Driver application data stored, will submit on login');

      setSuccess(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (err: any) {
      const errorCode = err?.errors?.[0]?.code;
      const errorMsg = err?.errors?.[0]?.message || err?.message;
      
      console.error('❌ Error details:', {
        message: err?.message,
        code: err?.code,
        errors: err?.errors,
        errorCode,
        status: err?.status,
        response: err?.response?.data,
      });

      // Handle session_exists error - user is already signed in
      if (errorCode === 'session_exists') {
        console.log('ℹ️ User already has a session, redirecting to dashboard...');
        setSuccess(true);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
        return;
      }

      const displayError = 
        errorMsg || 
        err?.response?.data?.error || 
        'Failed to complete signup. Please check your details and try again.';
      
      setError(displayError);
      console.error('🔴 Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'account':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <User size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Create Account</Text>
            <Text style={styles.stepDescription}>
              Set up your driver account with email and password
            </Text>

            <View style={styles.inputGroup}>
              <Mail size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <User size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.firstName}
                onChangeText={(value) => updateField('firstName', value)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <User size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.lastName}
                onChangeText={(value) => updateField('lastName', value)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Lock size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Lock size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry
              />
            </View>
          </View>
        );

      case 'personal':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <User size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDescription}>
              Tell us about yourself
            </Text>

            <View style={styles.inputGroup}>
              <User size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Profile photo URL (optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.profilePhotoUrl}
                onChangeText={(value) => updateField('profilePhotoUrl', value)}
              />
            </View>
          </View>
        );

      case 'license':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <FileText size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Driving License</Text>
            <Text style={styles.stepDescription}>
              Provide your valid driving license details
            </Text>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="License Number"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.licenseNumber}
                onChangeText={(value) => updateField('licenseNumber', value)}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="License photo URL"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.licensePhotoUrl}
                onChangeText={(value) => updateField('licensePhotoUrl', value)}
              />
            </View>
          </View>
        );

      case 'vehicle':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <Car size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Vehicle Details</Text>
            <Text style={styles.stepDescription}>
              Tell us about your vehicle
            </Text>

            <View style={styles.inputGroup}>
              <Car size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Vehicle Model (e.g., Honda City)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.carModel}
                onChangeText={(value) => updateField('carModel', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Vehicle Number (e.g., DL01AB1234)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.vehicleNumber}
                onChangeText={(value) => updateField('vehicleNumber', value)}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Vehicle photo URL"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.vehiclePhotoUrl}
                onChangeText={(value) => updateField('vehiclePhotoUrl', value)}
              />
            </View>
          </View>
        );

      case 'bank':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <CreditCard size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Bank Details</Text>
            <Text style={styles.stepDescription}>
              Add your bank account for receiving payments
            </Text>

            <View style={styles.inputGroup}>
              <User size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Account Holder Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.accountHolderName}
                onChangeText={(value) => updateField('accountHolderName', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <CreditCard size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="Account Number"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.accountNumber}
                onChangeText={(value) => updateField('accountNumber', value)}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <FileText size={20} color={Colors.dark.gold} />
              <TextInput
                style={styles.input}
                placeholder="IFSC Code"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.ifscCode}
                onChangeText={(value) => updateField('ifscCode', value)}
                autoCapitalize="characters"
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={64} color={Colors.dark.gold} />
          </View>
          <Text style={styles.successTitle}>
            Welcome Driver! 🚗
          </Text>
          <Text style={styles.successSubtitle}>
            Your driver profile has been created. Your application is under review.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Signup</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressContainer}>
        {steps.map((s, index) => (
          <View
            key={s}
            style={[
              styles.progressStep,
              index <= currentStepIndex && styles.progressStepActive,
            ]}>
            {index < currentStepIndex ? (
              <Check size={16} color={Colors.dark.background} />
            ) : (
              <Text style={[styles.progressNumber, index <= currentStepIndex && styles.progressNumberActive]}>
                {index + 1}
              </Text>
            )}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.buttonDisabled]}
          onPress={nextStep}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark.background} />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStepIndex === steps.length - 1 ? 'Complete Signup' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  progressStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  progressNumber: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  progressNumberActive: {
    color: Colors.dark.gold,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  formContainer: {
    flex: 1,
  },
  stepIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
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
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: Colors.dark.text,
    fontSize: 14,
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
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  nextButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
});
