import { DriverVerificationStatus } from '@/types';

export interface DriverVerificationPayload {
  licenseNumber: string;
  licenseImageBase64: string;
  selfieImageBase64: string;
  driverName?: string;
}

export interface DriverVerificationCheck {
  label: string;
  passed: boolean;
  weight: number;
  details?: string;
}

export interface DriverVerificationEvaluation {
  score: number;
  status: DriverVerificationStatus;
  checks: DriverVerificationCheck[];
}

export const MAX_VERIFICATION_ATTEMPTS = 3;

const LICENSE_NUMBER_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11}$/;
const MIN_IMAGE_LENGTH = 2000; // crude signal that an image payload exists

const scoreWeights = {
  format: 20,
  ocr: 15,
  nameMatch: 15,
  expiry: 15,
  vehicleClass: 15,
  faceMatch: 20,
};

function deriveStatus(score: number): DriverVerificationStatus {
  // All verifications require manual review (no auto-approval)
  if (score >= 60) {
    return 'manual_review';
  }
  return score > 0 ? 'rejected' : 'pending';
}

function buildCheck(
  label: string,
  passed: boolean,
  weight: number,
  details?: string,
): DriverVerificationCheck {
  return {
    label,
    passed,
    weight,
    details,
  };
}

function simulateOcrName(payload: DriverVerificationPayload): string {
  if (payload.driverName) {
    return payload.driverName.trim();
  }
  return 'UNKNOWN DRIVER';
}

function simulateExpiryDate(): string {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 3);
  return future.toISOString();
}

function simulateVehicleClasses(): string[] {
  return ['LMV', 'LMV-TR'];
}

function compareNames(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalize(nameA) === normalize(nameB);
}

function isLicenseValid(licenseNumber: string): boolean {
  return LICENSE_NUMBER_REGEX.test(licenseNumber.toUpperCase());
}

function isExpiryValid(expiryIso: string): boolean {
  const expiry = new Date(expiryIso);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }
  const today = new Date();
  return expiry.getTime() > today.getTime();
}

function hasRequiredVehicleClass(classes: string[]): boolean {
  return classes.includes('LMV') || classes.includes('LMV-TR');
}

function isImagePresent(imageBase64: string): boolean {
  return imageBase64.length >= MIN_IMAGE_LENGTH;
}

function estimateFaceMatchConfidence(
  licenseImageBase64: string,
  selfieImageBase64: string,
): number {
  if (
    !isImagePresent(licenseImageBase64) ||
    !isImagePresent(selfieImageBase64)
  ) {
    return 0;
  }
  const ratio =
    licenseImageBase64.length > selfieImageBase64.length
      ? selfieImageBase64.length / licenseImageBase64.length
      : licenseImageBase64.length / selfieImageBase64.length;
  return Math.min(Math.max(ratio * 100, 0), 100);
}

export function evaluateDriverVerification(
  payload: DriverVerificationPayload,
): DriverVerificationEvaluation {
  const checks: DriverVerificationCheck[] = [];
  let score = 0;

  const licenseValid = isLicenseValid(payload.licenseNumber);
  checks.push(
    buildCheck(
      'License number format validation',
      licenseValid,
      scoreWeights.format,
      licenseValid
        ? undefined
        : 'Expected format: two letters, two digits, eleven alphanumerics',
    ),
  );
  if (licenseValid) {
    score += scoreWeights.format;
  }

  const licenseImagePresent = isImagePresent(payload.licenseImageBase64);
  const selfieImagePresent = isImagePresent(payload.selfieImageBase64);

  checks.push(
    buildCheck(
      'OCR on license photo',
      licenseImagePresent,
      scoreWeights.ocr,
      licenseImagePresent ? undefined : 'Capture is too small or missing',
    ),
  );
  if (licenseImagePresent) {
    score += scoreWeights.ocr;
  }

  const ocrName = simulateOcrName(payload);
  const nameMatched = compareNames(payload.driverName, ocrName);
  checks.push(
    buildCheck(
      'Name match (OCR <-> user name)',
      nameMatched,
      scoreWeights.nameMatch,
      nameMatched ? undefined : 'Name mismatch detected',
    ),
  );
  if (nameMatched) {
    score += scoreWeights.nameMatch;
  }

  const expiryIso = simulateExpiryDate();
  const expiryValid = isExpiryValid(expiryIso);
  checks.push(
    buildCheck(
      'License expiry check',
      expiryValid,
      scoreWeights.expiry,
      expiryValid ? undefined : 'License appears expired',
    ),
  );
  if (expiryValid) {
    score += scoreWeights.expiry;
  }

  const vehicleClasses = simulateVehicleClasses();
  const vehicleClassValid = hasRequiredVehicleClass(vehicleClasses);
  checks.push(
    buildCheck(
      'Vehicle class check (LMV / LMV-TR)',
      vehicleClassValid,
      scoreWeights.vehicleClass,
      vehicleClassValid ? undefined : 'Required class not found: LMV or LMV-TR',
    ),
  );
  if (vehicleClassValid) {
    score += scoreWeights.vehicleClass;
  }

  const faceConfidence = estimateFaceMatchConfidence(
    payload.licenseImageBase64,
    payload.selfieImageBase64,
  );
  const faceMatchPassed = faceConfidence >= 60;
  checks.push(
    buildCheck(
      'Selfie <-> license face match',
      faceMatchPassed,
      scoreWeights.faceMatch,
      faceMatchPassed
        ? `Approximate match confidence: ${faceConfidence.toFixed(0)}%`
        : 'Low similarity between selfie and license capture',
    ),
  );
  if (faceMatchPassed) {
    score += scoreWeights.faceMatch;
  }

  const status = deriveStatus(score);

  return {
    score,
    status,
    checks,
  };
}
