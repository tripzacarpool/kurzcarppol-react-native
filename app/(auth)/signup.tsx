import { useEffect, useMemo, useState } from 'react';
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
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Phone as PhoneIcon,
  Car,
  IdCard,
  Wallet,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useSignUp, useAuth, useOAuth, useClerk } from '@/lib/clerkHooks';
import {
  syncUserToDatabase_Safe,
  submitRidePartnerApplication,
  updateRidePartnerStatus,
  RidePartnerApplicationPayload,
  checkEmailExists,
} from '@/lib/api';
import { RIDE_PARTNER_MODES } from '@/constants/ridePartnerModes';
import {
  RidePartnerMode,
  RidePartnerProfile,
  RidePartnerApplicationStatus,
} from '@/types';

type RidePartnerDraft = Omit<RidePartnerApplicationPayload, 'clerkId'>;

const verificationBlueprint = [
  { title: 'Basic Profile', method: 'Manual review + phone OTP' },
  { title: 'Vehicle Details', method: 'RC + exterior photo check' },
  { title: 'License Details', method: 'Format validation + manual review' },
  { title: 'Payout Details', method: 'Penny drop verification' },
];

const cabOnlyBlueprint = [{ title: 'Commercial Permit', method: 'Manual transport compliance review' }];

type AttachmentKey = 'profilePhotoUrl' | 'vehiclePhotoUrl' | 'licensePhotoUrl' | 'commercialPermitUrl';

type AttachmentInfo = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB per document

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const { isSignedIn, isLoaded } = useAuth();
  // OAuth is only available on native platforms
  const oauth = Platform.OS !== 'web' ? useOAuth({ strategy: 'oauth_google' }) : null;
  const clerk = useClerk();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [ridePartnerMode, setRidePartnerMode] = useState<RidePartnerMode>('daily');
  const [vehicleType, setVehicleType] = useState<'personal' | 'cab'>('personal');
  const [ridePartnerForm, setRidePartnerForm] = useState({
    fullName: '',
    phone: '',
    profilePhotoUrl: '',
    carModel: '',
    vehicleNumber: '',
    vehiclePhotoUrl: '',
    licenseNumber: '',
    licensePhotoUrl: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    commercialPermitUrl: '',
    communityRulesAccepted: false,
    ownershipConsent: false,
  });
  const [attachments, setAttachments] = useState<Record<AttachmentKey, AttachmentInfo | null>>({
    profilePhotoUrl: null,
    vehiclePhotoUrl: null,
    licensePhotoUrl: null,
    commercialPermitUrl: null,
  });
  const [ridePartnerDraft, setRidePartnerDraft] = useState<RidePartnerDraft | null>(null);
  const [applicationPreview, setApplicationPreview] = useState<RidePartnerProfile | null>(null);
  const [successVariant, setSuccessVariant] = useState<'passenger' | 'ride_partner'>('passenger');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [createdClerkId, setCreatedClerkId] = useState<string | null>(null);
  const isRidePartner = false;
  const needsPermit = useMemo(
    () => vehicleType === 'cab' || ridePartnerMode === 'professional',
    [vehicleType, ridePartnerMode],
  );
  const timelinePreview = useMemo(() => {
    if (!applicationPreview?.timeline?.length) return [];
    return [...applicationPreview.timeline].slice(-3).reverse();
  }, [applicationPreview]);

  useEffect(() => {
    if (ridePartnerMode === 'professional') {
      setVehicleType('cab');
    }
  }, [ridePartnerMode]);

  const updateRidePartnerField = (field: keyof typeof ridePartnerForm, value: string | boolean) => {
    setRidePartnerForm((prev) => ({
      ...prev,
      [field]: value,
    }));
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
        field === 'commercialPermitUrl'
          ? ['image/*', 'application/pdf']
          : ['image/*'];

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
        asset.mimeType || (field === 'commercialPermitUrl' ? 'application/pdf' : 'image/jpeg');

      updateRidePartnerField(field, `data:${inferredMime};base64,${base64}`);
      setAttachments((prev) => ({
        ...prev,
        [field]: {
          name: asset.name || asset.uri.split('/').pop() || 'selected-file',
          uri: asset.uri,
          mimeType: inferredMime,
          size: asset.size,
        },
      }));
      if (error) {
        setError('');
      }
    } catch (pickerError: any) {
      console.error('File selection error:', pickerError);
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
      <View style={styles.inputGroup}>
        <View style={styles.inputIcon}>
          <FileText size={20} color={Colors.dark.gold} />
        </View>
        <TouchableOpacity
          style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
          onPress={() => pickAttachment(field)}
          activeOpacity={0.85}
          disabled={loading}>
          <Text style={styles.uploadButtonLabel}>
            {file ? 'Replace File' : 'Choose File'}
          </Text>
        </TouchableOpacity>
        <View style={styles.uploadMeta}>
          <Text style={styles.uploadFileName} numberOfLines={1}>
            {file ? file.name : emptyLabel}
          </Text>
          <Text style={styles.uploadFileHint} numberOfLines={1}>
            {metadata || acceptHint}
          </Text>
        </View>
      </View>
    );
  };

  const validateRidePartnerForm = () => {
    const fullName = ridePartnerForm.fullName.trim() || `${firstName} ${lastName}`.trim();
    if (!fullName) {
      setError('Please provide your full name for verification.');
      return false;
    }
    if (!ridePartnerForm.phone.trim()) {
      setError('Phone number is required for the verification team.');
      return false;
    }
    if (!ridePartnerForm.carModel.trim() || !ridePartnerForm.vehicleNumber.trim()) {
      setError('Vehicle model and number are required.');
      return false;
    }
    if (!ridePartnerForm.vehiclePhotoUrl.trim()) {
      setError('Vehicle photo upload is required.');
      return false;
    }
    if (!ridePartnerForm.licenseNumber.trim()) {
      setError('Driving license number is required.');
      return false;
    }
    if (!ridePartnerForm.licensePhotoUrl.trim()) {
      setError('License photo upload is required.');
      return false;
    }
    if (!ridePartnerForm.accountHolderName.trim() || !ridePartnerForm.accountNumber.trim() || !ridePartnerForm.ifscCode.trim()) {
      setError('Complete payout details to receive earnings.');
      return false;
    }
    if (needsPermit && !ridePartnerForm.commercialPermitUrl.trim()) {
      setError('Commercial permit proof is required for professional/cab partners.');
      return false;
    }
    if (!ridePartnerForm.communityRulesAccepted || !ridePartnerForm.ownershipConsent) {
      setError('Please accept the declarations to continue.');
      return false;
    }
    return true;
  };

  const buildRidePartnerDraft = (): RidePartnerDraft => {
    const acceptedAt = new Date().toISOString();
    return {
      mode: ridePartnerMode,
      vehicleType,
      basicProfile: {
        fullName: ridePartnerForm.fullName.trim() || `${firstName} ${lastName}`.trim(),
        phone: ridePartnerForm.phone.trim(),
        profilePhotoUrl: ridePartnerForm.profilePhotoUrl.trim() || undefined,
      },
      vehicleDetails: {
        vehicleType: vehicleType,
        carModel: ridePartnerForm.carModel.trim(),
        vehicleNumber: ridePartnerForm.vehicleNumber.trim(),
        maxPassengers: vehicleType === 'cab' ? 4 : 3,
        vehiclePhotoUrl: ridePartnerForm.vehiclePhotoUrl.trim() || undefined,
      },
      licenseDetails: {
        licenseNumber: ridePartnerForm.licenseNumber.trim(),
        licensePhotoUrl: ridePartnerForm.licensePhotoUrl.trim() || undefined,
      },
      payoutDetails: {
        accountHolderName: ridePartnerForm.accountHolderName.trim(),
        accountNumber: ridePartnerForm.accountNumber.trim(),
        ifscCode: ridePartnerForm.ifscCode.trim().toUpperCase(),
      },
      professionalDetails:
        vehicleType === 'cab' || ridePartnerMode === 'professional'
          ? {
              commercialPermitUrl: ridePartnerForm.commercialPermitUrl.trim(),
            }
          : undefined,
      declaration: {
        communityRulesAccepted: ridePartnerForm.communityRulesAccepted,
        ownershipConsent: ridePartnerForm.ownershipConsent,
        acceptedAt,
      },
    };
  };

  const finalizeRidePartnerSubmission = async (clerkId?: string | null) => {
    if (!isRidePartner || !ridePartnerDraft || !clerkId) {
      return;
    }
    try {
      const payload = await submitRidePartnerApplication({
        clerkId,
        ...ridePartnerDraft,
      });
      setApplicationPreview(payload.profile);
      setSuccessVariant('ride_partner');
      setCreatedClerkId(clerkId);
    } catch (appErr: any) {
      const message = appErr?.response?.data?.error || appErr?.message || 'Failed to submit ride partner details';
      setError(message);
      console.error('Ride partner submission error:', appErr);
    }
  };

  const handleTestStatusChange = async (nextStatus: RidePartnerApplicationStatus) => {
    if (!createdClerkId) {
      Alert.alert('Unavailable', 'Submit the ride partner application first.');
      return;
    }
    try {
      setStatusUpdating(true);
      const response = await updateRidePartnerStatus(
        createdClerkId,
        nextStatus,
        `Updated from device at ${new Date().toLocaleString()}`,
      );
      setApplicationPreview(response.profile);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to update status';
      Alert.alert('Error', message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const renderRidePartnerForm = () => (
    <View style={styles.partnerCard}>
      <Text style={styles.partnerHeading}>Ride Partner Verification</Text>
      <Text style={styles.partnerSubheading}>
        Passengers pay upfront. We hold the money in escrow and release it only after you confirm the drop.
      </Text>

      <View style={styles.modeGrid}>
        {Object.entries(RIDE_PARTNER_MODES).map(([key, meta]) => {
          const value = key as RidePartnerMode;
          const active = ridePartnerMode === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.modeCard, active && styles.modeCardActive]}
              onPress={() => setRidePartnerMode(value)}
              activeOpacity={0.8}>
              <Text style={styles.modeCardTitle}>{meta.title}</Text>
              <Text style={styles.modeCardBadge}>{meta.badge}</Text>
              <Text style={styles.modeCardDescription}>{meta.description}</Text>
              <Text style={styles.modeCardHint}>{meta.vehicleHint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.verificationMatrix}>
        {verificationBlueprint.map((item) => (
          <View key={item.title} style={styles.verificationRow}>
            <CheckCircle2 size={18} color={Colors.dark.gold} />
            <View style={styles.verificationCopy}>
              <Text style={styles.verificationTitle}>{item.title}</Text>
              <Text style={styles.verificationMethod}>{item.method}</Text>
            </View>
          </View>
        ))}
        {needsPermit &&
          cabOnlyBlueprint.map((item) => (
            <View key={item.title} style={styles.verificationRow}>
              <CheckCircle2 size={18} color={Colors.dark.gold} />
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>{item.title}</Text>
                <Text style={styles.verificationMethod}>{item.method}</Text>
              </View>
            </View>
          ))}
      </View>

      <View style={styles.partnerSectionCard}>
        <View style={styles.partnerSectionHead}>
          <User size={22} color={Colors.dark.gold} />
          <View>
            <Text style={styles.partnerSectionTitle}>1️⃣ Basic Profile</Text>
            <Text style={styles.partnerSectionSubtitle}>Manual review + phone OTP</Text>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <User size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={Colors.dark.textSecondary}
            value={ridePartnerForm.fullName}
            onChangeText={(value) => updateRidePartnerField('fullName', value)}
            editable={!loading}
          />
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <PhoneIcon size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={Colors.dark.textSecondary}
            keyboardType="phone-pad"
            value={ridePartnerForm.phone}
            onChangeText={(value) => updateRidePartnerField('phone', value)}
            editable={!loading}
          />
        </View>
        {renderUploadField('profilePhotoUrl', 'Profile photo (optional)', 'Accepted: JPG, PNG · Max 6 MB')}
      </View>

      <View style={styles.partnerSectionCard}>
        <View style={styles.partnerSectionHead}>
          <Car size={22} color={Colors.dark.gold} />
          <View>
            <Text style={styles.partnerSectionTitle}>2️⃣ Vehicle Details</Text>
            <Text style={styles.partnerSectionSubtitle}>RC + exterior photo</Text>
          </View>
        </View>
        <View style={styles.vehicleTypeRow}>
          {['personal', 'cab'].map((type) => {
            const label = type === 'personal' ? 'Personal Vehicle' : 'Cab / Commercial';
            const active = vehicleType === type;
            const disabled = ridePartnerMode === 'professional' && type === 'personal';
            return (
              <TouchableOpacity
                key={type}
                style={[styles.vehicleTypeChip, active && styles.vehicleTypeChipActive, disabled && styles.vehicleTypeChipDisabled]}
                onPress={() => setVehicleType(type as 'personal' | 'cab')}
                disabled={disabled}
                activeOpacity={0.8}>
                <Text style={[styles.vehicleTypeText, active && styles.vehicleTypeTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <Car size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Car Model"
            placeholderTextColor={Colors.dark.textSecondary}
            value={ridePartnerForm.carModel}
            onChangeText={(value) => updateRidePartnerField('carModel', value)}
            editable={!loading}
          />
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <IdCard size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Vehicle Number"
            placeholderTextColor={Colors.dark.textSecondary}
            autoCapitalize="characters"
            value={ridePartnerForm.vehicleNumber}
            onChangeText={(value) => updateRidePartnerField('vehicleNumber', value.toUpperCase())}
            editable={!loading}
          />
        </View>
        {renderUploadField('vehiclePhotoUrl', 'Vehicle photo required', 'Accepted: JPG, PNG · Max 6 MB')}
        {ridePartnerMode === 'professional' && (
          <Text style={styles.helperText}>Professional mode locks vehicle type to commercial cabs.</Text>
        )}
      </View>

      <View style={styles.partnerSectionCard}>
        <View style={styles.partnerSectionHead}>
          <IdCard size={22} color={Colors.dark.gold} />
          <View>
            <Text style={styles.partnerSectionTitle}>3️⃣ License Details</Text>
            <Text style={styles.partnerSectionSubtitle}>Format check + manual review</Text>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <IdCard size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="License Number"
            placeholderTextColor={Colors.dark.textSecondary}
            autoCapitalize="characters"
            value={ridePartnerForm.licenseNumber}
            onChangeText={(value) => updateRidePartnerField('licenseNumber', value.toUpperCase())}
            editable={!loading}
          />
        </View>
        {renderUploadField('licensePhotoUrl', 'License photo required', 'Accepted: JPG, PNG · Max 6 MB')}
      </View>

      <View style={styles.partnerSectionCard}>
        <View style={styles.partnerSectionHead}>
          <Wallet size={22} color={Colors.dark.gold} />
          <View>
            <Text style={styles.partnerSectionTitle}>4️⃣ Payout Details</Text>
            <Text style={styles.partnerSectionSubtitle}>Penny drop verification</Text>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <User size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Account Holder Name"
            placeholderTextColor={Colors.dark.textSecondary}
            value={ridePartnerForm.accountHolderName}
            onChangeText={(value) => updateRidePartnerField('accountHolderName', value)}
            editable={!loading}
          />
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <Wallet size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Account Number"
            placeholderTextColor={Colors.dark.textSecondary}
            keyboardType="number-pad"
            value={ridePartnerForm.accountNumber}
            onChangeText={(value) => updateRidePartnerField('accountNumber', value)}
            editable={!loading}
          />
        </View>
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <FileText size={20} color={Colors.dark.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="IFSC Code"
            placeholderTextColor={Colors.dark.textSecondary}
            autoCapitalize="characters"
            value={ridePartnerForm.ifscCode}
            onChangeText={(value) => updateRidePartnerField('ifscCode', value.toUpperCase())}
            editable={!loading}
          />
        </View>
      </View>

      {needsPermit && (
        <View style={styles.partnerSectionCard}>
          <View style={styles.partnerSectionHead}>
            <FileText size={22} color={Colors.dark.gold} />
            <View>
              <Text style={styles.partnerSectionTitle}>5️⃣ Commercial Permit</Text>
              <Text style={styles.partnerSectionSubtitle}>Mandatory for cab partners</Text>
            </View>
          </View>
          {renderUploadField('commercialPermitUrl', 'Permit proof required', 'Accepted: JPG, PNG, PDF · Max 6 MB')}
        </View>
      )}

      <View style={styles.partnerSectionCard}>
        <View style={styles.partnerSectionHead}>
          <ShieldCheck size={22} color={Colors.dark.gold} />
          <View>
            <Text style={styles.partnerSectionTitle}>6️⃣ Declaration</Text>
            <Text style={styles.partnerSectionSubtitle}>Mandatory for approval</Text>
          </View>
        </View>
        <View style={styles.declarationRow}>
          <View>
            <Text style={styles.declarationTitle}>Accept Community Rules</Text>
            <Text style={styles.declarationSubtitle}>Respectful riders · zero-harassment policy</Text>
          </View>
          <Switch
            value={ridePartnerForm.communityRulesAccepted}
            onValueChange={(value) => updateRidePartnerField('communityRulesAccepted', value)}
            trackColor={{ false: Colors.dark.border, true: Colors.dark.gold }}
            thumbColor={Colors.dark.background}
          />
        </View>
        <View style={styles.declarationRow}>
          <View>
            <Text style={styles.declarationTitle}>Vehicle Ownership Consent</Text>
            <Text style={styles.declarationSubtitle}>You are authorized to share this vehicle</Text>
          </View>
          <Switch
            value={ridePartnerForm.ownershipConsent}
            onValueChange={(value) => updateRidePartnerField('ownershipConsent', value)}
            trackColor={{ false: Colors.dark.border, true: Colors.dark.gold }}
            thumbColor={Colors.dark.background}
          />
        </View>
      </View>

      {applicationPreview && (
        <View style={styles.statusSummaryCard}>
          <Text style={styles.statusSummaryLabel}>Application Status</Text>
          <Text style={styles.statusSummaryValue}>{applicationPreview.status.replace('_', ' ')}</Text>
          {timelinePreview.length > 0 && (
            <View style={styles.timelineList}>
              {timelinePreview.map((event, index) => (
                <View key={event.timestamp} style={styles.timelineRow}>
                  <View style={styles.timelineBullet} />
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineTitle}>{event.status.replace('_', ' ')}</Text>
                    <Text style={styles.timelineSubtitle}>{new Date(event.timestamp).toLocaleString()}</Text>
                    {event.note && <Text style={styles.timelineNote}>{event.note}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={styles.testActions}>
            <Text style={styles.testActionsTitle}>Quick status update (testing)</Text>
            <View style={styles.testButtonsRow}>
              <TouchableOpacity
                style={[styles.testButton, styles.testApprove]}
                onPress={() => handleTestStatusChange('approved')}
                disabled={statusUpdating}>
                <Text style={styles.testButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testButton, styles.testReject]}
                onPress={() => handleTestStatusChange('rejected')}
                disabled={statusUpdating}>
                <Text style={styles.testButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.testActionsHelper}>Use this only for device-to-device testing until the admin panel arrives.</Text>
          </View>
        </View>
      )}
    </View>
  );

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
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

    if (isRidePartner && !validateRidePartnerForm()) {
      return;
    }

    const draft = isRidePartner ? buildRidePartnerDraft() : null;
    if (isRidePartner && draft) {
      setRidePartnerDraft(draft);
    }

    setApplicationPreview(null);
    setLoading(true);
    setError('');

    try {
      // Check if email already exists in database BEFORE creating Clerk account
      console.log('🔍 Checking if email exists...', email);
      const emailExists = await checkEmailExists(email);
      console.log('📊 Email exists result:', emailExists);
      
      if (emailExists) {
        console.log('❌ Email already registered, showing error');
        setError(
          'This email is already registered. Please use the Sign In button below to login with your existing account.'
        );
        setLoading(false);
        return;
      }
      console.log('✅ Email is available, proceeding with signup');
      
      // Store role preference before signup
      const roleToSet = isRidePartner ? 'ride_partner' : 'passenger';
      await AsyncStorage.setItem('user_role_preference', roleToSet);
      console.log(`📋 Set role preference to: ${roleToSet}`);
      
      const result = await signUp?.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      console.log('Sign up result:', result?.status);
      console.log('Unverified fields:', result?.unverifiedFields);

      if (result?.status === 'complete') {
        console.log('✅ Sign up complete, Clerk session created');
        setCreatedClerkId(result?.createdUserId || null);
        
        // Wait a moment for Clerk to update session internally
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sync user to database with new session
        if (result?.createdUserId) {
          try {
            await syncUserToDatabase_Safe({
              clerkId: result.createdUserId,
              email: email,
              firstName: firstName,
              lastName: lastName,
            });
            console.log('✅ User synced to database after signup');
          } catch (syncErr: any) {
            const errorCode = syncErr?.response?.data?.code;
            if (errorCode === 'EMAIL_ALREADY_EXISTS') {
              // Email conflict - sign out and redirect to login
              console.log('❌ Email already exists, signing out Clerk session...');
              setLoading(false);
              setSuccess(false);
              setShowVerification(false);
              
              try {
                await clerk.signOut();
                console.log('✅ Signed out successfully');
              } catch (signOutErr) {
                console.error('Error signing out:', signOutErr);
              }
              
              // Redirect to login with error message
              console.log('🔄 Redirecting to login...');
              router.replace('/(auth)/login');
              // Show alert to inform user
              setTimeout(() => {
                Alert.alert(
                  'Email Already Registered',
                  'This email is already registered. Please sign in with your existing account.',
                  [{ text: 'OK' }]
                );
              }, 500);
              return;
            }
            console.warn('⚠️ User sync failed (non-critical):', syncErr);
          }
        }
        
        await finalizeRidePartnerSubmission(result?.createdUserId);
        setSuccessVariant(isRidePartner ? 'ride_partner' : 'passenger');
        setSuccess(true);
        setLoading(false);
        
        // Redirect after showing success
        setTimeout(() => {
          console.log('🔄 Redirecting to tabs...');
          router.replace('/(tabs)');
        }, 1500);
      } else if (result?.status === 'missing_requirements') {
        // Email verification needed
        if (result?.unverifiedFields?.includes('email_address')) {
          // Prepare email verification (send code to email)
          await signUp?.prepareEmailAddressVerification();
          setShowVerification(true);
          setLoading(false);
        } else {
          setError('Please complete all required fields');
          setLoading(false);
        }
      } else {
        setError('Sign up failed. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      const errorCode = err?.errors?.[0]?.code;
      const errorMsg = err?.errors?.[0]?.message || err?.message;

      console.error('❌ Signup error details:', {
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
        setLoading(false);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
        return;
      }

      const displayError = 
        errorMsg || 
        err?.response?.data?.error || 
        'Sign up failed. Please try again.';
      
      setError(displayError);
      console.error('🔴 Full signup error:', err);
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode) {
      setError('Please enter verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code: verificationCode,
      });

      console.log('Verification result:', result?.status);
      console.log('Created user ID:', result?.createdUserId);
      console.log('Created session ID:', result?.createdSessionId);

      if (result?.status === 'complete') {
        console.log('✅ Email verified, session created');
        setCreatedClerkId(result?.createdUserId || null);
        
        // Wait for Clerk to update session internally
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sync user to database
        if (result?.createdUserId) {
          try {
            await syncUserToDatabase_Safe({
              clerkId: result.createdUserId,
              email: result?.emailAddress || email,
              firstName: result?.firstName || firstName,
              lastName: result?.lastName || lastName,
            });
            console.log('✅ User synced to database after verification');
          } catch (syncErr: any) {
            const errorCode = syncErr?.response?.data?.code;
            if (errorCode === 'EMAIL_ALREADY_EXISTS') {
              // Email conflict - sign out and redirect to login
              console.log('❌ Email already exists during verification, signing out...');
              setLoading(false);
              setSuccess(false);
              setShowVerification(false);
              setVerificationCode('');
              
              try {
                await clerk.signOut();
                console.log('✅ Signed out successfully');
              } catch (signOutErr) {
                console.error('Error signing out:', signOutErr);
              }
              
              // Redirect to login with error message
              console.log('🔄 Redirecting to login...');
              router.replace('/(auth)/login');
              // Show alert to inform user
              setTimeout(() => {
                Alert.alert(
                  'Email Already Registered',
                  'This email is already registered. Please sign in with your existing account.',
                  [{ text: 'OK' }]
                );
              }, 500);
              return;
            }
            console.warn('⚠️ User sync failed (non-critical):', syncErr);
          }
        }

        await finalizeRidePartnerSubmission(result?.createdUserId);
        setSuccessVariant(isRidePartner ? 'ride_partner' : 'passenger');
        // Session created automatically by Clerk
        setSuccess(true);
        setLoading(false);
        
        // Give it a moment then redirect
        setTimeout(() => {
          console.log('🔄 Redirecting to tabs...');
          router.replace('/(tabs)');
        }, 1500);
      } else {
        setError('Verification failed. Please check the code.');
        setLoading(false);
      }
    } catch (err: any) {
      const errorCode = err?.errors?.[0]?.code;
      const errorMsg = err?.errors?.[0]?.message || err?.message;

      console.error('❌ Verification error details:', {
        message: err?.message,
        code: err?.code,
        errors: err?.errors,
        errorCode,
        status: err?.status,
      });

      // If verification succeeded even with error code, redirect
      if (errorCode === 'session_exists') {
        console.log('ℹ️ Session exists, user verified and signed in');
        setSuccess(true);
        setLoading(false);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
        return;
      }
      
      const displayError = 
        errorMsg || 
        'Verification failed. Please check the code.';
      
      setError(displayError);
      console.error('🔴 Full verification error:', err);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      setError('Google sign-up is not available on web. Please use email/password.');
      return;
    }

    if (!oauth?.startOAuthFlow) {
      setError('OAuth is not available');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('🔐 Initiating Google sign-in...');
      
      const { createdSessionId, setActive } = await oauth.startOAuthFlow();

      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        console.log('✅ Google sign-in complete');
        router.replace('/(tabs)');
      } else {
        throw new Error('No session created');
      }
    } catch (err: any) {
      console.error('❌ Google sign-up error:', {
        message: err?.message,
        errors: err?.errors,
      });
      
      const errorMsg = 
        err?.errors?.[0]?.message || 
        err?.message || 
        'Google sign-up failed';
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (showVerification) {
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
              onPress={() => {
                setShowVerification(false);
                setVerificationCode('');
                setError('');
              }}
              activeOpacity={0.7}>
              <ArrowLeft size={24} color={Colors.dark.text} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Mail size={48} color={Colors.dark.gold} />
              </View>
              <Text style={styles.title}>Verify Email</Text>
              <Text style={styles.subtitle}>Check your email for the verification code</Text>
            </View>

            <View style={styles.form}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.infoText}>
                We sent a verification code to {email}
              </Text>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color={Colors.dark.gold} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter verification code"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  autoCapitalize="none"
                  autoComplete="off"
                  keyboardType="default"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, loading && styles.signupButtonDisabled]}
                onPress={handleVerifyEmail}
                disabled={loading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator color={Colors.dark.background} />
                ) : (
                  <Text style={styles.signupButtonText}>Verify Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <UserPlus size={64} color={Colors.dark.gold} />
          </View>
          <Text style={styles.successTitle}>
            Account Created!
          </Text>
          <Text style={styles.successSubtitle}>
            Welcome to the ride-sharing community. You can now start booking rides.
          </Text>
          <View style={{ width: '100%' }}>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}>
              <Text style={styles.successButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
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

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <UserPlus size={48} color={Colors.dark.gold} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the ride-sharing community as a traveler</Text>
          </View>

          <View style={styles.driverCtaCard}>
            <View style={styles.driverCtaHeader}>
              <View style={styles.driverCtaIcon}>
                <Car size={24} color={Colors.dark.gold} />
              </View>
              <View style={styles.driverCtaCopyWrap}>
                <Text style={styles.driverCtaTitle}>Want to drive with Kurz?</Text>
                <Text style={styles.driverCtaCopy}>
                  Go through a guided, step-by-step driver signup to become a ride partner.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.driverCtaButton}
              onPress={() => router.push('/(auth)/driver-signup')}
              activeOpacity={0.85}>
              <ShieldCheck size={18} color={Colors.dark.background} />
              <Text style={styles.driverCtaButtonText}>Sign Up as Driver</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
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
                placeholder="First Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="name"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={20} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="name-family"
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
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
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

            {/* Google Sign-up - Only available on native platforms */}
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
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.googleButtonText}>Sign up with Google</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Sign In</Text>
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
  ridePartnerIcon: {
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.card,
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
  driverCtaCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  driverCtaHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  driverCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.gold + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  driverCtaCopyWrap: {
    flex: 1,
    gap: 4,
  },
  driverCtaTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  driverCtaCopy: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  driverCtaButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 12,
  },
  driverCtaButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 14,
  },
  variantToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 4,
    marginTop: 12,
    marginBottom: 12,
  },
  variantButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  variantButtonActive: {
    backgroundColor: Colors.dark.gold,
  },
  variantButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  variantButtonTextActive: {
    color: Colors.dark.background,
  },
  variantHelper: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    marginBottom: 16,
    fontSize: 13,
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
  uploadButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonLabel: {
    color: Colors.dark.background,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadMeta: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 10,
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
  infoText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  partnerCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  partnerHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  partnerSubheading: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  modeCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modeCardActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '12',
  },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  modeCardBadge: {
    fontSize: 13,
    color: Colors.dark.gold,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeCardDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  modeCardHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  verificationMatrix: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  verificationCopy: {
    flex: 1,
  },
  verificationTitle: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
  },
  verificationMethod: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  partnerSectionCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  partnerSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  partnerSectionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  partnerSectionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  helperText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  vehicleTypeChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  vehicleTypeChipActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '12',
  },
  vehicleTypeChipDisabled: {
    opacity: 0.5,
  },
  vehicleTypeText: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  vehicleTypeTextActive: {
    color: Colors.dark.gold,
  },
  declarationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  declarationTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  declarationSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
    maxWidth: 220,
  },
  statusSummaryCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusSummaryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusSummaryValue: {
    color: Colors.dark.gold,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  timelineList: {
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timelineBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
    marginTop: 6,
  },
  timelineCopy: {
    flex: 1,
  },
  timelineTitle: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
  },
  timelineSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  timelineNote: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  testActions: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 12,
  },
  testActionsTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  testButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  testButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  testApprove: {
    backgroundColor: '#1F8A5B',
  },
  testReject: {
    backgroundColor: '#B2453B',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  testActionsHelper: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
