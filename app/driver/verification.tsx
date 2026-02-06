import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import type { MutableRefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CameraView,
  CameraCapturedPicture,
  useCameraPermissions,
} from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  evaluateDriverVerification,
  MAX_VERIFICATION_ATTEMPTS,
} from '@/lib/driverVerification';
import type {
  DriverVerificationAttempt,
  DriverVerificationResult,
  DriverVerificationStatus,
} from '@/types';
import {
  ArrowLeft,
  Camera as CameraIcon,
  IdCard,
  ImageIcon,
  ShieldCheck,
} from 'lucide-react-native';

interface CapturedImage {
  uri: string;
  base64: string;
}

type CaptureMode = 'license' | 'selfie';

type VerificationState = DriverVerificationResult | null;

const statusCopy: Record<DriverVerificationStatus, { title: string; helper: string }> = {
  pending: {
    title: 'Pending',
    helper: 'Capture your documents to start automated checks.',
  },
  auto_approved: {
    title: 'Auto Approved',
    helper: 'All checks cleared. You can start accepting rides after payout setup.',
  },
  manual_review: {
    title: 'Manual Review',
    helper: 'A reviewer will validate your documents shortly.',
  },
  rejected: {
    title: 'Rejected',
    helper: 'Your submission did not meet the verification threshold.',
  },
};

export default function DriverVerificationScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { user } = useAuthContext();

  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseImage, setLicenseImage] = useState<CapturedImage | null>(null);
  const [selfieImage, setSelfieImage] = useState<CapturedImage | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('license');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [submission, setSubmission] = useState<VerificationState>(null);
  const [attempts, setAttempts] = useState<DriverVerificationAttempt[]>([]);
  const [status, setStatus] = useState<DriverVerificationStatus>('pending');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const storageKey = useMemo(
    () => (user?.id ? `driver_verification_${user.id}` : null),
    [user?.id],
  );

  const attemptsRemaining = Math.max(
    MAX_VERIFICATION_ATTEMPTS - attempts.length,
    0,
  );
  const canRetry = attemptsRemaining > 0 && status !== 'auto_approved';

  const fullName = useMemo(() => {
    if (!user?.firstName && !user?.lastName) return undefined;
    return [user?.firstName || '', user?.lastName || ''].join(' ').trim();
  }, [user?.firstName, user?.lastName]);

  const currentStatusCopy = statusCopy[status];

  const hydrateFromStorage = useCallback(async () => {
    if (!storageKey) {
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { result: DriverVerificationResult };
      if (!parsed?.result) {
        return;
      }
      setSubmission(parsed.result);
      setStatus(parsed.result.status);
      setAttempts(parsed.result.attempts || []);
      setLicenseNumber(parsed.result.licenseNumber || '');
      setLocked(parsed.result.locked ?? false);
    } catch (storageError) {
      console.warn('Warning: Failed to hydrate driver verification state:', storageError);
    }
  }, [storageKey]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const persistResult = useCallback(
    async (result: DriverVerificationResult) => {
      if (!storageKey) {
        return;
      }
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify({ result }));
      } catch (storageError) {
        console.warn('Warning: Failed to persist driver verification state:', storageError);
      }
    },
    [storageKey],
  );

  const ensurePermission = async () => {
    if (permission?.granted) return true;
    const { granted } = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Camera Required',
        'Camera access is needed to perform driver verification.',
      );
    }
    return granted;
  };

  const openCamera = async (mode: CaptureMode) => {
    if (!(await ensurePermission())) {
      return;
    }
    setCaptureMode(mode);
    setCameraVisible(true);
  };

  const closeCamera = () => {
    setCameraVisible(false);
  };

  const handleCapture = async () => {
    try {
      const camera = cameraRef.current;
      if (!camera) {
        return;
      }
      setLoading(true);
      const picture: CameraCapturedPicture = await camera.takePictureAsync({
        quality: 0.6,
        base64: true,
        skipProcessing: true,
      });
      if (!picture?.base64) {
        throw new Error('Capture failed');
      }
      const payload: CapturedImage = {
        uri: picture.uri,
        base64: picture.base64,
      };
      if (captureMode === 'license') {
        setLicenseImage(payload);
      } else {
        setSelfieImage(payload);
      }
      setCameraVisible(false);
    } catch (captureError: any) {
      const message = captureError?.message || 'Unable to capture image. Try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const validateBeforeSubmit = () => {
    if (!licenseNumber.trim()) {
      setError('Enter your license number to continue.');
      return false;
    }
    if (!licenseImage || !selfieImage) {
      setError('Capture both the license and a selfie to proceed.');
      return false;
    }
    if (!canRetry) {
      if (status === 'auto_approved') {
        setError('Verification already completed successfully.');
      } else {
        setError('Verification attempts exhausted. Contact support.');
      }
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateBeforeSubmit()) {
      return;
    }
    try {
      setLoading(true);
      if (!licenseImage || !selfieImage) {
        setError('Capture both the license and a selfie to proceed.');
        setLoading(false);
        return;
      }
      const evaluation = evaluateDriverVerification({
        licenseNumber: licenseNumber.trim().toUpperCase(),
        licenseImageBase64: licenseImage.base64,
        selfieImageBase64: selfieImage.base64,
        driverName: fullName,
      });

      const attemptNumber = attempts.length + 1;
      const attempt: DriverVerificationAttempt = {
        attemptNumber,
        submittedAt: new Date().toISOString(),
        score: evaluation.score,
        status: evaluation.status,
      };

      const updatedAttempts = [...attempts, attempt];
      const result: DriverVerificationResult = {
        licenseNumber: licenseNumber.trim().toUpperCase(),
        status: evaluation.status,
        score: evaluation.score,
        checks: evaluation.checks,
        attempts: updatedAttempts,
        locked: true,
      };

      setSubmission(result);
      setAttempts(updatedAttempts);
      setStatus(evaluation.status);
      setLocked(true);
      await persistResult(result);

      // Save verification to backend database
      try {
        const { updateDriverVerification } = await import('@/lib/api');
        const backendResult = await updateDriverVerification({
          verificationStatus: evaluation.status,
          verificationScore: evaluation.score,
          verificationData: result,
          licenseNumber: licenseNumber.trim().toUpperCase(),
        });
        
        if (backendResult.success && backendResult.verificationBatch) {
          console.log(`✅ Driver verification saved to backend. Batch: ${backendResult.verificationBatch}`);
          // Show success message with batch number
          if (evaluation.status === 'auto_approved') {
            Alert.alert(
              'Verification Complete! 🎉',
              `Congratulations! You've been verified.\n\nYour Verification Badge: ${backendResult.verificationBatch}\n\nYou can now start accepting rides.`,
              [{ text: 'OK' }]
            );
          }
        }
      } catch (apiError: any) {
        console.warn('⚠️ Failed to save verification to backend:', apiError.message);
        // Don't fail the local verification if backend save fails
      }
    } catch (submitError: any) {
      const message = submitError?.message || 'Verification failed. Try again later.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetCapture = (mode: CaptureMode) => {
    if (mode === 'license') {
      setLicenseImage(null);
    } else {
      setSelfieImage(null);
    }
  };

  const shouldDisableSubmit =
    loading || !licenseImage || !selfieImage || (!locked && !licenseNumber.trim()) || !canRetry;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <ShieldCheck size={28} color={Colors.dark.gold} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>{currentStatusCopy.title}</Text>
            <Text style={styles.statusHelper}>{currentStatusCopy.helper}</Text>
            {status !== 'auto_approved' ? (
              <Text style={styles.securityNote}>
                Payouts remain blocked until your verification is auto approved.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.sectionHeading}>Rules</Text>
          <View style={styles.ruleRow}>
            <CameraIcon size={18} color={Colors.dark.gold} />
            <Text style={styles.ruleText}>Camera capture only - No gallery uploads</Text>
          </View>
          <View style={styles.ruleRow}>
            <CameraIcon size={18} color={Colors.dark.gold} />
            <Text style={styles.ruleText}>No live video KYC - Still photos only</Text>
          </View>
          <View style={styles.ruleRow}>
            <ShieldCheck size={18} color={Colors.dark.gold} />
            <Text style={styles.ruleText}>Max 3 retries - License locks after submit</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>License Number</Text>
          <View style={styles.inputRow}>
            <IdCard size={20} color={Colors.dark.gold} />
            <TextInput
              style={styles.input}
              placeholder="Enter license number"
              placeholderTextColor={Colors.dark.textSecondary}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              editable={!locked}
              autoCapitalize="characters"
              keyboardType="visible-password"
            />
          </View>
          <Text style={styles.helperText}>
            Example format: DL0120160000001
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Capture Requirements</Text>
          <CaptureTile
            label="License Photo"
            description="Back camera - full license in frame"
            captured={!!licenseImage}
            onCapture={() => openCamera('license')}
            onRetry={() => resetCapture('license')}
            disabled={loading}
          />
          <CaptureTile
            label="Selfie"
            description="Front camera - center your face"
            captured={!!selfieImage}
            onCapture={() => openCamera('selfie')}
            onRetry={() => resetCapture('selfie')}
            disabled={loading}
          />
          <Text style={styles.helperText}>
            {attemptsRemaining} out of {MAX_VERIFICATION_ATTEMPTS} retries remaining
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, shouldDisableSubmit && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={shouldDisableSubmit}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark.background} />
          ) : (
            <Text style={styles.submitButtonText}>Run Automated Checks</Text>
          )}
        </TouchableOpacity>

        {submission ? (
          <ResultPanel result={submission} />
        ) : null}

        {attempts.length ? (
          <AttemptsList attempts={attempts} />
        ) : null}
      </ScrollView>

      <CameraModal
        visible={cameraVisible}
        onClose={closeCamera}
        onCapture={handleCapture}
        loading={loading}
        facing={captureMode === 'license' ? 'back' : 'front'}
        cameraRef={cameraRef}
      />
    </SafeAreaView>
  );
}

interface CaptureTileProps {
  label: string;
  description: string;
  captured: boolean;
  disabled?: boolean;
  onCapture: () => void;
  onRetry: () => void;
}

function CaptureTile({
  label,
  description,
  captured,
  disabled,
  onCapture,
  onRetry,
}: CaptureTileProps) {
  return (
    <View style={[styles.captureTile, captured && styles.captureTileActive]}>
      <View style={styles.captureLabelRow}>
        <ImageIcon size={20} color={Colors.dark.gold} />
        <View style={styles.captureCopy}>
          <Text style={styles.captureLabel}>{label}</Text>
          <Text style={styles.captureDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.captureActions}>
        <TouchableOpacity
          style={[styles.captureButton, disabled && styles.disabledButton]}
          onPress={onCapture}
          disabled={disabled}
        >
          <CameraIcon size={18} color={Colors.dark.background} />
          <Text style={styles.captureButtonText}>{captured ? 'Retake' : 'Capture'}</Text>
        </TouchableOpacity>
        {captured ? (
          <TouchableOpacity style={styles.clearButton} onPress={onRetry}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

interface ResultPanelProps {
  result: DriverVerificationResult;
}

const ResultPanel = memo(function ResultPanel({ result }: ResultPanelProps) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.sectionHeading}>Automated Checks</Text>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreValue}>{result.score}</Text>
        <View>
          <Text style={styles.scoreLabel}>Composite Score</Text>
          <Text style={styles.scoreHelper}>
            {'>=85 auto approval - 60-84 manual review - <60 rejected'}
          </Text>
        </View>
      </View>
      {result.checks.map((check) => (
        <View key={check.label} style={styles.checkRow}>
          <View style={[styles.checkBadge, check.passed ? styles.checkPassed : styles.checkFailed]}>
            <Text style={styles.checkBadgeText}>{check.weight}</Text>
          </View>
          <View style={styles.checkCopy}>
            <Text style={styles.checkLabel}>{check.label}</Text>
            <Text style={styles.checkDetails}>
              {check.passed ? 'Passed' : 'Failed'}
              {check.details ? ` - ${check.details}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});

interface AttemptsListProps {
  attempts: DriverVerificationAttempt[];
}

const AttemptsList = memo(function AttemptsList({ attempts }: AttemptsListProps) {
  return (
    <View style={styles.attemptsCard}>
      <Text style={styles.sectionHeading}>Submission Attempts</Text>
      {attempts.map((attempt) => (
        <View key={attempt.attemptNumber} style={styles.attemptRow}>
          <View style={styles.attemptBadge}>
            <Text style={styles.attemptBadgeText}>#{attempt.attemptNumber}</Text>
          </View>
          <View style={styles.attemptCopy}>
            <Text style={styles.attemptScore}>Score {attempt.score}</Text>
            <Text style={styles.attemptMeta}>
              {formatStatus(attempt.status)} - {new Date(attempt.submittedAt).toLocaleString()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});

function formatStatus(status: DriverVerificationStatus) {
  switch (status) {
    case 'auto_approved':
      return 'Auto approved';
    case 'manual_review':
      return 'Manual review';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: () => void;
  loading: boolean;
  facing: 'front' | 'back';
  cameraRef: MutableRefObject<CameraView | null>;
}

const CameraModal = memo(function CameraModal({ visible, onClose, onCapture, loading, facing, cameraRef }: CameraModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView style={styles.cameraView} facing={facing} ref={cameraRef} ratio="16:9" />
        <View style={styles.cameraFooter}>
          <TouchableOpacity style={styles.cameraClose} onPress={onClose}>
            <Text style={styles.cameraCloseText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shutterButton, loading && styles.disabledButton]}
            onPress={onCapture}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
});

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
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 16,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.gold + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusValue: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '700',
  },
  statusHelper: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  securityNote: {
    color: Colors.dark.error,
    fontSize: 12,
    marginTop: 4,
  },
  rulesCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleText: {
    color: Colors.dark.text,
    fontSize: 14,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  sectionHeading: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: Colors.dark.text,
    fontSize: 16,
    marginLeft: 12,
  },
  helperText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  captureTile: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  captureTileActive: {
    borderColor: Colors.dark.gold,
  },
  captureLabelRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureCopy: {
    flex: 1,
    gap: 4,
  },
  captureLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  captureDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  captureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  captureButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 14,
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  clearButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorBanner: {
    backgroundColor: Colors.dark.error + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.error,
    padding: 12,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreValue: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  scoreLabel: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  scoreHelper: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  checkBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkPassed: {
    backgroundColor: Colors.dark.gold + '20',
  },
  checkFailed: {
    backgroundColor: Colors.dark.error + '20',
  },
  checkBadgeText: {
    color: Colors.dark.text,
    fontWeight: '700',
  },
  checkCopy: {
    flex: 1,
    gap: 4,
  },
  checkLabel: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  checkDetails: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  attemptsCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  attemptRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  attemptBadge: {
    backgroundColor: Colors.dark.gold + '20',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  attemptBadgeText: {
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  attemptCopy: {
    flex: 1,
    gap: 4,
  },
  attemptScore: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
  attemptMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  cameraView: {
    flex: 1,
  },
  cameraFooter: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
  },
  cameraClose: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cameraCloseText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.background,
  },
});
