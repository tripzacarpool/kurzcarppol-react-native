import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, FileText, Car, CreditCard, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

type OnboardingStep = 'personal' | 'license' | 'vehicle' | 'bank';

export default function DriverOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('personal');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    licenseNumber: '',
    licenseExpiry: '',
    vehicleModel: '',
    vehicleNumber: '',
    vehicleColor: '',
    totalSeats: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  });

  const steps: OnboardingStep[] = ['personal', 'license', 'vehicle', 'bank'];
  const currentStepIndex = steps.indexOf(step);

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setStep(steps[currentStepIndex + 1]);
    } else {
      router.push('/driver/dashboard');
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1]);
    } else {
      router.back();
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'personal':
        return (
          <View style={styles.formContainer}>
            <View style={styles.stepIcon}>
              <User size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDescription}>
              Tell us about yourself to get started as a driver
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.name}
              onChangeText={(value) => updateField('name', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              keyboardType="email-address"
            />
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

            <TextInput
              style={styles.input}
              placeholder="License Number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.licenseNumber}
              onChangeText={(value) => updateField('licenseNumber', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Expiry Date (DD/MM/YYYY)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.licenseExpiry}
              onChangeText={(value) => updateField('licenseExpiry', value)}
            />

            <View style={styles.uploadBox}>
              <FileText size={24} color={Colors.dark.textSecondary} />
              <Text style={styles.uploadText}>Upload License Photo</Text>
              <TouchableOpacity style={styles.uploadButton}>
                <Text style={styles.uploadButtonText}>Choose File</Text>
              </TouchableOpacity>
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

            <TextInput
              style={styles.input}
              placeholder="Vehicle Model (e.g., Honda City)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.vehicleModel}
              onChangeText={(value) => updateField('vehicleModel', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Number (e.g., DL 1C 1234)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.vehicleNumber}
              onChangeText={(value) => updateField('vehicleNumber', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Color"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.vehicleColor}
              onChangeText={(value) => updateField('vehicleColor', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Total Seats Available"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.totalSeats}
              onChangeText={(value) => updateField('totalSeats', value)}
              keyboardType="number-pad"
            />
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

            <TextInput
              style={styles.input}
              placeholder="Bank Name"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.bankName}
              onChangeText={(value) => updateField('bankName', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Account Number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.accountNumber}
              onChangeText={(value) => updateField('accountNumber', value)}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="IFSC Code"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.ifscCode}
              onChangeText={(value) => updateField('ifscCode', value)}
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Onboarding</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
          <Text style={styles.nextButtonText}>
            {currentStepIndex === steps.length - 1 ? 'Complete' : 'Continue'}
          </Text>
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
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  progressNumber: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  progressNumberActive: {
    color: Colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formContainer: {
    alignItems: 'center',
  },
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.dark.text,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  uploadBox: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.dark.border,
    marginTop: 12,
  },
  uploadText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  nextButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
