import { useState } from 'react';
import { useRef } from 'react';
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
  Image,
  Modal,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  ArrowLeft,
  User,
  FileText,
  Car,
  CreditCard,
  Check,
  Mail,
  Wand2,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { RidePartnerApplicationPayload, submitRidePartnerApplication } from '@/lib/api';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface DriverFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePhotoUrl: string;
  licenseNumber: string;
  licensePhotoUrl: string;
  vehicleType: string;
  carModel: string;
  vehicleNumber: string;
  maxPassengers: string;
  vehiclePhotoUrl: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  selfiePhoto: string;
  aadharDocument: string;
}

type AttachmentKey =
  | 'profilePhotoUrl'
  | 'licensePhotoUrl'
  | 'vehiclePhotoUrl'
  | 'selfiePhoto'
  | 'aadharDocument';

type AttachmentInfo = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB cap per upload

export default function DriverSignupScreen() {
  const router = useRouter();
  const { signUp } = useSignUp();

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
    vehicleType: '',
    carModel: '',
    vehicleNumber: '',
    maxPassengers: '',
    vehiclePhotoUrl: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    selfiePhoto: '',
    aadharDocument: '',
  });
  const [attachments, setAttachments] = useState<Record<AttachmentKey, AttachmentInfo | null>>({
    profilePhotoUrl: null,
    licensePhotoUrl: null,
    vehiclePhotoUrl: null,
    selfiePhoto: null,
    aadharDocument: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [digilockerStatus, setDigilockerStatus] = useState<'pending' | 'in_progress' | 'verified'>('pending');
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [capturedSelfieUri, setCapturedSelfieUri] = useState<string | null>(null);
  const [capturedSelfieBase64, setCapturedSelfieBase64] = useState<string | null>(null);
  const [isCapturingSelfie, setIsCapturingSelfie] = useState(false);
  const updateField = (field: keyof DriverFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const formatFileSize = (size?: number | null) => {
    if (!size || size <= 0) {
      return '';
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pickAttachment = async (field: AttachmentKey) => {
    try {
      const acceptedTypes =
        field === 'aadharDocument'
          ? [
              'application/pdf',
              'application/zip',
              'application/x-zip-compressed',
              'application/xml',
              'text/xml',
              'application/octet-stream',
            ]
          : ['image/*', 'application/pdf'];

      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError('Could not read the selected file. Please try again.');
        return;
      }

      if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
        setError('Selected file is too large. Please pick a file under 6 MB.');
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });

      const inferredMime =
        asset.mimeType || (field === 'aadharDocument' ? 'application/pdf' : 'image/jpeg');

      const dataUri = `data:${inferredMime};base64,${base64}`;

      setFormData((prev) => ({
        ...prev,
        [field]: dataUri,
      }));
      setAttachments((prev) => ({
        ...prev,
        [field]: {
          name: asset.name || asset.uri.split('/').pop() || 'selected-file',
          uri: asset.uri,
          mimeType: inferredMime,
          size: asset.size,
        },
      }));
      if (field === 'aadharDocument') {
        setDigilockerStatus('verified');
      }
      if (error) {
        setError('');
      }
    } catch (pickerError: any) {
      console.error('Driver signup file pick error:', pickerError);
      setError('Failed to pick file. Please try again.');
    }
  };

  const renderUploadField = (
    field: AttachmentKey,
    emptyLabel: string,
    acceptHint: string,
  ) => {
    const file = attachments[field];
    const metadata = file
      ? [file.mimeType, file.size ? formatFileSize(file.size) : null]
          .filter(Boolean)
          .join(' · ')
      : acceptHint;

    return (
      <View style={styles.uploadGroup}>
        <TouchableOpacity
          style={[styles.uploadButton, loading && styles.buttonDisabled]}
          onPress={() => pickAttachment(field)}
          activeOpacity={0.85}
          disabled={loading}>
          <Text style={styles.uploadButtonLabel}>{file ? 'Replace File' : 'Choose File'}</Text>
        </TouchableOpacity>
        <View style={styles.uploadMeta}>
          <Text style={styles.uploadFileName} numberOfLines={1}>
            {file ? file.name : emptyLabel}
          </Text>
          <Text style={styles.uploadFileHint} numberOfLines={1}>
            {metadata}
          </Text>
        </View>
      </View>
    );
  };

  const openSelfieModal = async () => {
    try {
      if (cameraPermission?.granted) {
        setCapturedSelfieUri(null);
        setCapturedSelfieBase64(null);
        setSelfieModalVisible(true);
        return;
      }

      const permissionResponse = await requestCameraPermission();
      if (permissionResponse?.granted) {
        setCapturedSelfieUri(null);
        setCapturedSelfieBase64(null);
        setSelfieModalVisible(true);
      } else {
        setError('Camera access is required for live selfie verification.');
      }
    } catch (permissionError) {
      console.error('Selfie permission error:', permissionError);
      setError('Unable to access the camera. Please check permissions and try again.');
    }
  };

  const closeSelfieModal = () => {
    setSelfieModalVisible(false);
    setCapturedSelfieUri(null);
    setCapturedSelfieBase64(null);
  };

  const captureSelfie = async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      setIsCapturingSelfie(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });
      if (photo?.base64) {
        setCapturedSelfieUri(photo.uri ?? null);
        setCapturedSelfieBase64(`data:image/jpeg;base64,${photo.base64}`);
      } else {
        setError('Failed to capture selfie. Please try again.');
      }
    } catch (captureError) {
      console.error('Selfie capture error:', captureError);
      setError('Failed to capture selfie. Please try again.');
    } finally {
      setIsCapturingSelfie(false);
    }
  };

  const confirmSelfie = () => {
    if (!capturedSelfieBase64) {
      setError('Capture a selfie before confirming.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      selfiePhoto: capturedSelfieBase64,
    }));
    setAttachments((prev) => ({
      ...prev,
      selfiePhoto: {
        name: 'live-selfie.jpg',
        uri: capturedSelfieUri || 'live-selfie.jpg',
        mimeType: 'image/jpeg',
        size: null,
      },
    }));
    closeSelfieModal();
    if (error) {
      setError('');
    }
  };

  const retakeSelfie = () => {
    setCapturedSelfieUri(null);
    setCapturedSelfieBase64(null);
  };

  const handleDigilockerPortal = async () => {
    try {
      await Linking.openURL('https://digitallocker.gov.in/');
      setDigilockerStatus((prev) => (prev === 'verified' ? 'verified' : 'in_progress'));
    } catch (linkError) {
      console.error('DigiLocker link error:', linkError);
      setError('Unable to open DigiLocker at the moment.');
    }
  };

  const validateForm = (): boolean => {
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
    if (!formData.phone) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.licenseNumber) {
      setError('License number is required');
      return false;
    }
    if (!formData.licensePhotoUrl) {
      setError('License photo upload is required');
      return false;
    }
    if (!formData.selfiePhoto) {
      setError('Live selfie capture is required');
      return false;
    }
    if (!formData.vehicleType || !formData.carModel || !formData.vehicleNumber || !formData.maxPassengers) {
      setError('Please fill in all vehicle details including type and passenger capacity');
      return false;
    }
    const maxPassengersNum = parseInt(formData.maxPassengers);
    if (isNaN(maxPassengersNum) || maxPassengersNum < 1 || maxPassengersNum > 50) {
      setError('Please enter a valid passenger capacity (1-50)');
      return false;
    }
    if (!formData.accountHolderName || !formData.accountNumber || !formData.ifscCode) {
      setError('All bank details are required');
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!signUp) {
        throw new Error('Clerk signUp not initialized');
      }

      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (!result || result.status !== 'complete') {
        const status = result?.status || 'unknown';
        const message = `Account creation status: ${status}. Please try again.`;
        setError(message);
        setLoading(false);
        return;
      }

      const clerkId = result.createdUserId;
      if (!clerkId) {
        throw new Error('No user ID returned from Clerk');
      }

      await AsyncStorage.setItem('user_role_preference', 'ride_partner');

      const kycDetailsPayload = {
        selfiePhoto: formData.selfiePhoto,
        digilockerStatus,
        ...(formData.aadharDocument
          ? { digilockerDocument: formData.aadharDocument }
          : {}),
      };

      const driverApplicationData: RidePartnerApplicationPayload = {
        clerkId,
        mode: 'daily',
        vehicleType: 'personal',
        contactEmail: formData.email.trim(),
        basicProfile: {
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          profilePhotoUrl: formData.profilePhotoUrl || undefined,
        },
        vehicleDetails: {
          vehicleType: formData.vehicleType,
          carModel: formData.carModel,
          vehicleNumber: formData.vehicleNumber.toUpperCase(),
          maxPassengers: parseInt(formData.maxPassengers),
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
        kycDetails: kycDetailsPayload,
      };

      await AsyncStorage.setItem(
        'pending_driver_application',
        JSON.stringify(driverApplicationData),
      );

      await submitRidePartnerApplication(driverApplicationData);

      await AsyncStorage.removeItem('pending_driver_application');

      setSuccess(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (err: any) {
      const errorCode = err?.errors?.[0]?.code;
      const errorMsg = err?.errors?.[0]?.message || err?.message;

      if (errorCode === 'session_exists') {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
        return;
      }

      const displayError =
        errorMsg || err?.response?.data?.error || 'Failed to complete signup. Please check your details and try again.';

      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomEmail = () => {
    const suffix = Math.floor(Math.random() * 100000);
    return `driver${suffix}@example.com`;
  };

  const generateRandomPhone = () => {
    return String(Math.floor(6000000000 + Math.random() * 3999999999));
  };

  const generateRandomLicense = () => {
    const digits = Math.floor(100000000000 + Math.random() * 900000000000);
    return `DL${digits}`;
  };

  const generateRandomVehicleNumber = () => {
    const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `DL${Math.floor(10 + Math.random() * 90)}${letters}${digits}`;
  };

  const generateRandomAccountNumber = () => {
    return String(Math.floor(10 ** 11 + Math.random() * 9 * 10 ** 11));
  };

  const fillTestData = () => {
    const sampleProfile = 'data:image/jpeg;base64,UFJPRklMRS1UQUc=';
    const sampleLicense = 'data:image/jpeg;base64,TElDRU5TRS1UQUc=';
    const sampleVehicle = 'data:image/jpeg;base64,VEVTVC1WRUhJQ0xF';
    const sampleSelfie = 'data:image/jpeg;base64,U0VMRklFLVNBTVBMRS1JTUc=';
    const sampleAadhar = 'data:application/pdf;base64,QURIQVItRE9DLVNBTVBMRS1CRFo=';
    setFormData((prev) => ({
      ...prev,
      email: generateRandomEmail(),
      password: 'Password123!',
      confirmPassword: 'Password123!',
      firstName: 'Test',
      lastName: `Driver${Math.floor(Math.random() * 1000)}`,
      phone: generateRandomPhone(),
      profilePhotoUrl: sampleProfile,
      licenseNumber: generateRandomLicense(),
      licensePhotoUrl: sampleLicense,
      vehicleType: 'sedan',
      carModel: 'Maruti Suzuki Swift',
      maxPassengers: '3',
      vehicleNumber: generateRandomVehicleNumber(),
      vehiclePhotoUrl: sampleVehicle,
      accountHolderName: 'Test Driver',
      accountNumber: generateRandomAccountNumber(),
      ifscCode: 'HDFC0001234',
      selfiePhoto: sampleSelfie,
      aadharDocument: sampleAadhar,
    }));
    setAttachments({
      profilePhotoUrl: {
        name: 'profile-sample.jpg',
        uri: 'profile-sample.jpg',
        mimeType: 'image/jpeg',
        size: null,
      },
      licensePhotoUrl: {
        name: 'license-sample.jpg',
        uri: 'license-sample.jpg',
        mimeType: 'image/jpeg',
        size: null,
      },
      vehiclePhotoUrl: {
        name: 'vehicle-sample.jpg',
        uri: 'vehicle-sample.jpg',
        mimeType: 'image/jpeg',
        size: null,
      },
      selfiePhoto: {
        name: 'selfie-sample.jpg',
        uri: 'selfie-sample.jpg',
        mimeType: 'image/jpeg',
        size: null,
      },
      aadharDocument: {
        name: 'aadhar-sample.pdf',
        uri: 'aadhar-sample.pdf',
        mimeType: 'application/pdf',
        size: null,
      },
    });
    setDigilockerStatus('verified');
    setError('');
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={64} color={Colors.dark.gold} />
          </View>
          <Text style={styles.successTitle}>Welcome Driver! 🚗</Text>
          <Text style={styles.successSubtitle}>
            Your driver profile has been created. Your application is under review.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Signup</Text>
          <TouchableOpacity
            style={styles.fillButton}
            onPress={fillTestData}
            activeOpacity={0.8}
          >
            <Wand2 size={18} color={Colors.dark.background} />
            <Text style={styles.fillButtonText}>Fill Test Data</Text>
          </TouchableOpacity>
        </View>

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

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Mail size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <User size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Personal</Text>
            </View>
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="First Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.firstName}
                onChangeText={(value) => updateField('firstName', value)}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Last Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={formData.lastName}
                onChangeText={(value) => updateField('lastName', value)}
                autoCapitalize="words"
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              keyboardType="phone-pad"
            />
            {renderUploadField(
              'profilePhotoUrl',
              'Profile photo (optional)',
              'Accepted: JPG, PNG, PDF · Max 6 MB',
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Live Selfie Verification</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Capture a live selfie to confirm liveness. Make sure you are in a well-lit area and remove any accessories.
            </Text>
            {formData.selfiePhoto ? (
              <View style={styles.selfiePreviewWrapper}>
                <Image source={{ uri: formData.selfiePhoto }} style={styles.selfiePreview} />
                <View style={styles.selfieActions}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.selfieActionButton]}
                    onPress={openSelfieModal}
                    activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>Retake Selfie</Text>
                  </TouchableOpacity>
                  <View style={[styles.statusPill, styles.statusPillSuccess]}>
                    <Text style={styles.statusPillText}>Captured</Text>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, styles.selfieCaptureButton]}
                onPress={openSelfieModal}
                activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Capture Live Selfie</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>DigiLocker Aadhaar Verification</Text>
            </View>
            <Text style={styles.sectionDescription}>
              DigiLocker sharing is optional right now but helps speed up manual review. Launch DigiLocker if you have your Aadhaar handy and upload the XML or PDF file—otherwise you can skip this step and continue.
            </Text>
            <View style={styles.digilockerActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.digilockerButton]}
                onPress={handleDigilockerPortal}
                activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>Open DigiLocker</Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.statusPill,
                  digilockerStatus === 'verified'
                    ? styles.statusPillSuccess
                    : digilockerStatus === 'in_progress'
                    ? styles.statusPillWarning
                    : styles.statusPillNeutral,
                ]}>
                <Text style={styles.statusPillText}>
                  {digilockerStatus === 'verified'
                    ? 'Verified'
                    : digilockerStatus === 'in_progress'
                    ? 'Awaiting Upload'
                    : 'Optional'}
                </Text>
              </View>
            </View>
            {renderUploadField(
              'aadharDocument',
              'Upload Aadhaar XML/PDF (optional)',
              'Accepted: XML, ZIP, PDF · Max 6 MB',
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>License</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="License Number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.licenseNumber}
              onChangeText={(value) => updateField('licenseNumber', value.toUpperCase())}
              autoCapitalize="characters"
            />
            {renderUploadField(
              'licensePhotoUrl',
              'License photo required',
              'Accepted: JPG, PNG, PDF · Max 6 MB',
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Car size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Vehicle</Text>
            </View>
            
            {/* Vehicle Type Selection */}
            <Text style={styles.fieldLabel}>Vehicle Type *</Text>
            <View style={styles.vehicleTypeGrid}>
              {[
                { value: 'bike', label: '🏍️ Bike/Scooter', desc: '2-Wheeler' },
                { value: 'sedan', label: '🚗 Sedan', desc: 'Small Car' },
                { value: 'suv', label: '🚙 SUV/Hatchback', desc: 'Medium Car' },
                { value: 'van', label: '🚐 Van/Traveller', desc: 'Large Vehicle' },
                { value: 'auto', label: '🛺 Auto Rickshaw', desc: '3-Wheeler' },
                { value: 'bus', label: '🚌 Bus', desc: 'Large Transport' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.vehicleTypeCard,
                    formData.vehicleType === type.value && styles.vehicleTypeCardActive,
                  ]}
                  onPress={() => updateField('vehicleType', type.value)}
                >
                  <Text style={styles.vehicleTypeLabel}>{type.label}</Text>
                  <Text style={styles.vehicleTypeDesc}>{type.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Vehicle Model (e.g., Honda City)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.carModel}
              onChangeText={(value) => updateField('carModel', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Number (e.g., DL01AB1234)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.vehicleNumber}
              onChangeText={(value) => updateField('vehicleNumber', value.toUpperCase())}
              autoCapitalize="characters"
            />
            
            {/* Max Passengers */}
            <Text style={styles.fieldLabel}>Maximum Passengers You Can Seat *</Text>
            <Text style={styles.fieldHint}>
              Enter how many passengers you can accommodate (excluding driver)
            </Text>
            <View style={styles.passengerGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.passengerBtn,
                    formData.maxPassengers === num.toString() && styles.passengerBtnActive,
                  ]}
                  onPress={() => updateField('maxPassengers', num.toString())}
                >
                  <Text
                    style={[
                      styles.passengerBtnText,
                      formData.maxPassengers === num.toString() && styles.passengerBtnTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Or enter custom number (9-50 for buses)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.maxPassengers}
              onChangeText={(value) => updateField('maxPassengers', value)}
              keyboardType="number-pad"
            />

            {renderUploadField(
              'vehiclePhotoUrl',
              'Vehicle photo (optional)',
              'Accepted: JPG, PNG, PDF · Max 6 MB',
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <CreditCard size={22} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Payout Details</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Account Holder Name"
              placeholderTextColor={Colors.dark.textSecondary}
              value={formData.accountHolderName}
              onChangeText={(value) => updateField('accountHolderName', value)}
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
              onChangeText={(value) => updateField('ifscCode', value.toUpperCase())}
              autoCapitalize="characters"
            />
          </View>
        </ScrollView>

        <Modal
          transparent
          animationType="fade"
          visible={selfieModalVisible}
          onRequestClose={closeSelfieModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Live Selfie Capture</Text>
                <TouchableOpacity onPress={closeSelfieModal} disabled={isCapturingSelfie}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                {capturedSelfieBase64 ? (
                  <>
                    <Image source={{ uri: capturedSelfieBase64 }} style={styles.selfieModalPreview} />
                    <View style={styles.cameraActions}>
                      <TouchableOpacity
                        style={styles.cameraActionButton}
                        onPress={retakeSelfie}
                        activeOpacity={0.85}
                        disabled={isCapturingSelfie}>
                        <Text style={styles.cameraActionText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cameraActionButton, styles.cameraConfirmButton]}
                        onPress={confirmSelfie}
                        activeOpacity={0.85}
                        disabled={!capturedSelfieBase64 || isCapturingSelfie}>
                        <Text style={[styles.cameraActionText, styles.cameraConfirmText]}>Use Selfie</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <CameraView ref={cameraRef} style={styles.cameraView} facing="front" />
                    <View style={styles.cameraControls}>
                      <TouchableOpacity
                        style={[styles.cameraButton, styles.cancelButton]}
                        onPress={closeSelfieModal}
                        activeOpacity={0.85}
                        disabled={isCapturingSelfie}>
                        <Text style={[styles.cameraButtonLabel, styles.cancelButtonLabel]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cameraButton, styles.captureButton]}
                        onPress={captureSelfie}
                        activeOpacity={0.85}
                        disabled={isCapturingSelfie}>
                        {isCapturingSelfie ? (
                          <ActivityIndicator color={Colors.dark.background} />
                        ) : (
                          <Text style={[styles.cameraButtonLabel, styles.captureButtonLabel]}>Capture</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <Text style={styles.submitButtonText}>Complete Signup</Text>
            )}
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  fillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  fillButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 14,
    marginBottom: 16,
  },
  halfInput: {
    marginBottom: 0,
  },
  sectionDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  selfiePreviewWrapper: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    gap: 12,
  },
  selfiePreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
  },
  selfieActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selfieActionButton: {
    flex: 1,
    marginRight: 12,
  },
  primaryButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 14,
  },
  selfieCaptureButton: {
    marginTop: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.dark.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  digilockerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  digilockerButton: {
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    color: Colors.dark.background,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPillSuccess: {
    backgroundColor: '#1F8A5B',
  },
  statusPillWarning: {
    backgroundColor: '#C57F1F',
  },
  statusPillNeutral: {
    backgroundColor: Colors.dark.border,
  },
  uploadGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 12,
  },
  uploadButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  uploadButtonLabel: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 12,
  },
  uploadMeta: {
    flex: 1,
    gap: 2,
  },
  uploadFileName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadFileHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000bb',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
    gap: 16,
  },
  cameraView: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#000',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  cameraButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: Colors.dark.gold,
  },
  cancelButton: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cameraButtonLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  captureButtonLabel: {
    color: Colors.dark.background,
  },
  cancelButtonLabel: {
    color: Colors.dark.text,
  },
  selfieModalPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cameraActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  cameraActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cameraConfirmButton: {
    backgroundColor: Colors.dark.gold,
    borderWidth: 0,
  },
  cameraActionText: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 14,
  },
  cameraConfirmText: {
    color: Colors.dark.background,
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderWidth: 1,
    borderColor: Colors.dark.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  submitButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  vehicleTypeCard: {
    width: '47%',
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  vehicleTypeCardActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '15',
  },
  vehicleTypeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  vehicleTypeDesc: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  passengerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  passengerBtn: {
    width: 60,
    height: 60,
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerBtnActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  passengerBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  passengerBtnTextActive: {
    color: Colors.dark.background,
  },
});
