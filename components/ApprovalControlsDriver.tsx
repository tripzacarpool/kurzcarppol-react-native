import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { updateRideApprovalSettings } from '../lib/api';
import { APPROVAL_SETTINGS, APPROVAL_MESSAGES } from '../constants/approvalSystem';

interface ApprovalControlsDriverProps {
  rideId: string;
  requiresManualApproval: boolean;
  isFestivalRide?: boolean;
  onSave?: (settings: any) => void;
  onError?: (error: string) => void;
}

export default function ApprovalControlsDriver({
  rideId,
  requiresManualApproval: initialManualApproval,
  isFestivalRide = false,
  onSave,
  onError,
}: ApprovalControlsDriverProps) {
  const [requiresManualApproval, setRequiresManualApproval] = useState(
    initialManualApproval,
  );
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(
    APPROVAL_SETTINGS.AUTO_APPROVE_RATING_THRESHOLD,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleToggleManualApproval = (value: boolean) => {
    if (isFestivalRide && value) {
      Alert.alert(
        '🎪 Festival Ride',
        APPROVAL_MESSAGES.FESTIVAL_FORCED_AUTO,
        [{ text: 'OK' }],
      );
      return;
    }

    setRequiresManualApproval(value);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await updateRideApprovalSettings(rideId, requiresManualApproval, {
        autoApproveThreshold,
        approvalDeadlineMinutes: APPROVAL_SETTINGS.DEFAULT_APPROVAL_DEADLINE,
        allowDirectConfirmation: true,
      });

      if (response.success) {
        Alert.alert('✅ Saved', 'Approval settings updated successfully');
        onSave?.({
          requiresManualApproval,
          autoApproveThreshold,
        });
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to save settings';
      Alert.alert('❌ Error', errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const getApprovalModeLabel = () => {
    if (isFestivalRide) return '🎪 Festival (Auto-Confirm)';
    if (!requiresManualApproval) return '⚡ Auto-Confirm Mode';
    return '👤 Manual Review Mode';
  };

  const getApprovalModeDescription = () => {
    if (isFestivalRide) {
      return 'All bookings auto-confirm instantly (Festival requirement)';
    }
    if (!requiresManualApproval) {
      return 'Bookings auto-confirm instantly unless passenger is high-risk';
    }
    return 'You review and approve each booking manually';
  };

  return (
    <View style={styles.container}>
      {/* Current Mode Card */}
      <LinearGradient
        colors={['#00BCD4', '#00838F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.modeCard}
      >
        <View style={styles.modeHeader}>
          <View>
            <Text style={styles.modeLabel}>{getApprovalModeLabel()}</Text>
            <Text style={styles.modeDescription}>{getApprovalModeDescription()}</Text>
          </View>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>ACTIVE</Text>
          </View>
        </View>

        {/* Benefits Row */}
        <View style={styles.benefitsRow}>
          {!requiresManualApproval ? (
            <>
              <View style={styles.benefit}>
                <Feather name="zap" size={16} color="#fff" />
                <Text style={styles.benefitText}>Faster Bookings</Text>
              </View>
              <View style={styles.benefit}>
                <Feather name="smile" size={16} color="#fff" />
                <Text style={styles.benefitText}>Happy Passengers</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.benefit}>
                <Feather name="shield" size={16} color="#fff" />
                <Text style={styles.benefitText}>Full Control</Text>
              </View>
              <View style={styles.benefit}>
                <Feather name="user-check" size={16} color="#fff" />
                <Text style={styles.benefitText}>Quality Passengers</Text>
              </View>
            </>
          )}
        </View>
      </LinearGradient>

      {/* Controls */}
      <View style={styles.controlsCard}>
        <Text style={styles.controlsTitle}>Approval Settings</Text>

        {/* Manual Approval Toggle */}
        {!isFestivalRide && (
          <View style={styles.controlRow}>
            <View style={styles.controlLabel}>
              <Feather name="toggle-left" size={20} color="#0066cc" />
              <View style={styles.labelContent}>
                <Text style={styles.controlName}>Manual Approval</Text>
                <Text style={styles.controlHint}>
                  Review each booking before confirming
                </Text>
              </View>
            </View>
            <Switch
              value={requiresManualApproval}
              onValueChange={handleToggleManualApproval}
              trackColor={{ false: '#ddd', true: '#0066cc' }}
              thumbColor={requiresManualApproval ? '#0052a3' : '#fff'}
            />
          </View>
        )}

        {/* Auto-Approve Threshold Slider */}
        {requiresManualApproval && !isFestivalRide && (
          <>
            <View style={styles.divider} />
            <View style={styles.controlRow}>
              <View style={styles.controlLabel}>
                <MaterialIcons name="star-rate" size={20} color="#FFD700" />
                <View style={styles.labelContent}>
                  <Text style={styles.controlName}>Auto-Approve Threshold</Text>
                  <Text style={styles.controlHint}>
                    Passengers above this rating auto-confirm
                  </Text>
                </View>
              </View>
              <View style={styles.thresholdDisplay}>
                <Text style={styles.thresholdValue}>{autoApproveThreshold}</Text>
                <Text style={styles.thresholdLabel}>stars</Text>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>3.5</Text>
                <Text style={styles.sliderLabel}>4.0</Text>
                <Text style={styles.sliderLabel}>4.5</Text>
                <Text style={styles.sliderLabel}>5.0</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    {
                      width: `${((autoApproveThreshold - 3.5) / 1.5) * 100}%`,
                    },
                  ]}
                />
                <TouchableOpacity
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${((autoApproveThreshold - 3.5) / 1.5) * 100}%`,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    // Simple step adjustment
                    if (autoApproveThreshold < 4.0) {
                      setAutoApproveThreshold(4.0);
                    } else if (autoApproveThreshold < 4.5) {
                      setAutoApproveThreshold(4.5);
                    } else {
                      setAutoApproveThreshold(5.0);
                    }
                  }}
                >
                  <View style={styles.sliderThumbInner} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Quick Actions */}
      {!isFestivalRide && (
        <View style={styles.quickActionsCard}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Feather
              name={showAdvanced ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#0066cc"
            />
            <Text style={styles.quickActionText}>
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <>
              <View style={styles.divider} />
              <View style={styles.advancedOption}>
                <View style={styles.optionContent}>
                  <Feather name="clock" size={18} color="#FF9800" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>Approval Deadline</Text>
                    <Text style={styles.optionValue}>
                      {APPROVAL_SETTINGS.DEFAULT_APPROVAL_DEADLINE} minutes
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionHint}>Auto-rejects if not reviewed</Text>
              </View>

              <View style={styles.divider} />
              <View style={styles.advancedOption}>
                <View style={styles.optionContent}>
                  <Feather name="lock" size={18} color="#9C27B0" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>Seat Lock Duration</Text>
                    <Text style={styles.optionValue}>
                      {APPROVAL_SETTINGS.SEAT_LOCK_DURATION} minutes
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionHint}>Temporary hold during review</Text>
              </View>

              <View style={styles.divider} />
              <View style={styles.advancedOption}>
                <View style={styles.optionContent}>
                  <MaterialIcons name="verified-user" size={18} color="#4CAF50" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>Min Trips for Auto-Approve</Text>
                    <Text style={styles.optionValue}>
                      {APPROVAL_SETTINGS.AUTO_APPROVE_MIN_TRIPS} trips
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionHint}>Low-trip passengers always review</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <View style={styles.infoIcon}>
          <Feather name="info" size={18} color="#0066cc" />
        </View>
        <Text style={styles.infoText}>
          {requiresManualApproval
            ? '💡 Review bookings quickly to maintain high acceptance rate and get more requests'
            : '💡 Auto-confirm builds trust with passengers and increases booking volume'}
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSaveSettings}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="save" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    maxWidth: 280,
  },
  modeBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  benefit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  controlsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  controlLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelContent: {
    flex: 1,
  },
  controlName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  controlHint: {
    fontSize: 12,
    color: '#999',
  },
  thresholdDisplay: {
    alignItems: 'center',
    marginLeft: 16,
  },
  thresholdValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  thresholdLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  sliderContainer: {
    paddingVertical: 12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  sliderThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: -9,
  },
  sliderThumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0066cc',
  },
  advancedOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  optionValue: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '500',
    marginTop: 2,
  },
  optionHint: {
    fontSize: 11,
    color: '#999',
    marginLeft: 32,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#0066cc',
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
