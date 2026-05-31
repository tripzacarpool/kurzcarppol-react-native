import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Dimensions,
} from 'react-native';
import {
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  ChevronDown,
  CheckCircle,
  Ambulance,
  Users,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { EMERGENCY_CONTACTS } from '@/constants/emergency';
import {
  getActiveSOSAlerts,
  resolveSOSAlert,
  dispatchEmergencyServices,
} from '@/lib/api';

interface SOSAlert {
  rideId: string;
  passengerName: string;
  passengerPhone: string;
  driverName: string;
  driverPhone: string;
  pickupLocation: any;
  currentLocation: any;
  reason: string;
  sosActivatedAt: string;
  timeElapsed?: number;
}

const { width } = Dimensions.get('window');

export default function AdminSOSPanel() {
  const [sosAlerts, setSOSAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [processingRideId, setProcessingRideId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveSOSAlerts();
    // Refresh every 10 seconds
    const interval = setInterval(fetchActiveSOSAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSOSAlerts = async () => {
    try {
      setRefreshing(true);
      const response = await getActiveSOSAlerts();
      setSOSAlerts(response.alerts || []);
      console.log('📊 Fetched', response.count, 'active SOS alerts');
    } catch (error) {
      console.error('❌ Error fetching SOS alerts:', error);
      Alert.alert('Error', 'Failed to fetch SOS alerts');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCallPassenger = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('Error', 'Passenger phone number not available');
      return;
    }
    Alert.alert('Confirm Call', `Call ${name} at ${phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${phone}`),
      },
    ]);
  };

  const handleCallDriver = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('Error', 'Driver phone number not available');
      return;
    }
    Alert.alert('Confirm Call', `Call ${name} at ${phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${phone}`),
      },
    ]);
  };

  const handleDispatchEmergency = async (
    rideId: string,
    serviceType: 'police' | 'ambulance' | 'fire' | 'disaster',
  ) => {
    Alert.alert(
      'Dispatch Emergency Service',
      `Dispatch ${EMERGENCY_CONTACTS[serviceType.toUpperCase()]?.name || serviceType} to this location?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Dispatch',
          onPress: async () => {
            try {
              setProcessingRideId(rideId);
              await dispatchEmergencyServices(rideId, serviceType);
              Alert.alert(
                'Success',
                `${EMERGENCY_CONTACTS[serviceType.toUpperCase()]?.name} has been dispatched. Driver and passenger have been notified.`,
              );
              fetchActiveSOSAlerts();
            } catch (error) {
              Alert.alert('Error', 'Failed to dispatch emergency service');
            } finally {
              setProcessingRideId(null);
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  const handleResolveSOSAlert = async (
    rideId: string,
    passengerName: string,
  ) => {
    Alert.alert(
      'Resolve SOS Alert',
      `Mark SOS alert for ${passengerName} as resolved?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              setProcessingRideId(rideId);
              const notes = `Resolved by admin - situation under control`;
              await resolveSOSAlert(
                rideId,
                'resolved_by_admin',
                notes
              );
              Alert.alert(
                'Success',
                'SOS alert has been marked as resolved. Driver and passenger notified.',
              );
              fetchActiveSOSAlerts();
            } catch (error) {
              Alert.alert('Error', 'Failed to resolve SOS alert');
            } finally {
              setProcessingRideId(null);
            }
          },
        },
      ],
    );
  };

  if (loading && sosAlerts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.error} />
        <Text style={styles.loadingText}>Loading SOS alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          onRefresh={fetchActiveSOSAlerts}
          refreshing={refreshing}
          tintColor={Colors.dark.error}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <AlertTriangle size={28} color={Colors.dark.error} />
          <Text style={styles.headerText}>SOS Alert Monitor</Text>
        </View>
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>{sosAlerts.length}</Text>
        </View>
      </View>

      {sosAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color={Colors.dark.success} />
          <Text style={styles.emptyStateText}>No active SOS alerts</Text>
          <Text style={styles.emptyStateSubtext}>
            All passengers are safe. System is monitoring...
          </Text>
        </View>
      ) : (
        // Active SOS Alerts List
        sosAlerts.map((alert) => (
          <View
            key={alert.rideId}
            style={[
              styles.sosCard,
              expandedAlertId === alert.rideId && styles.sosCardExpanded,
            ]}>
            {/* Alert Header */}
            <TouchableOpacity
              onPress={() =>
                setExpandedAlertId(
                  expandedAlertId === alert.rideId ? null : alert.rideId,
                )
              }
              style={styles.alertHeader}>
              <View style={styles.alertHeaderLeft}>
                <View style={styles.alertIcon}>
                  <AlertTriangle
                    size={24}
                    color="white"
                    strokeWidth={2.5}
                  />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.passengerName}>{alert.passengerName}</Text>
                  <Text style={styles.alertReason}>{alert.reason}</Text>
                </View>
              </View>
              <View style={styles.timeElapsed}>
                <Clock size={16} color={Colors.dark.error} />
                <Text style={styles.timeEllapsedText}>
                  {alert.timeElapsed ? `${Math.floor(alert.timeElapsed)}s` : 'now'}
                </Text>
              </View>
              <ChevronDown
                size={20}
                color={Colors.dark.textSecondary}
                style={{
                  transform: [
                    {
                      rotate:
                        expandedAlertId === alert.rideId ? '180deg' : '0deg',
                    },
                  ],
                }}
              />
            </TouchableOpacity>

            {/* Expanded Details */}
            {expandedAlertId === alert.rideId && (
              <View style={styles.alertDetails}>
                {/* Location Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📍 Location</Text>
                  <View style={styles.locationInfo}>
                    <View style={styles.locationRow}>
                      <Text style={styles.locationLabel}>Pickup:</Text>
                      <Text style={styles.locationValue}>
                        {alert.pickupLocation?.name || 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.locationRow}>
                      <Text style={styles.locationLabel}>Current:</Text>
                      <Text style={styles.locationValue}>
                        {alert.currentLocation?.latitude?.toFixed(4)},
                        {alert.currentLocation?.longitude?.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Passenger & Driver Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>👥 People Involved</Text>
                  
                  <View style={styles.personCard}>
                    <View style={styles.personHeader}>
                      <Text style={styles.personLabel}>Passenger</Text>
                      <Text style={styles.personName}>{alert.passengerName}</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Phone size={16} color={Colors.dark.gold} />
                      <TouchableOpacity
                        onPress={() =>
                          handleCallPassenger(
                            alert.passengerPhone,
                            alert.passengerName,
                          )
                        }>
                        <Text style={styles.phoneNumber}>
                          {alert.passengerPhone || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.personCard, styles.driverCard]}>
                    <View style={styles.personHeader}>
                      <Text style={styles.personLabel}>Driver</Text>
                      <Text style={styles.personName}>{alert.driverName}</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Phone size={16} color={Colors.dark.warning} />
                      <TouchableOpacity
                        onPress={() =>
                          handleCallDriver(alert.driverPhone, alert.driverName)
                        }>
                        <Text style={styles.phoneNumber}>
                          {alert.driverPhone || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Emergency Services */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    🆘 Emergency Services
                  </Text>
                  <View style={styles.emergencyGrid}>
                    <TouchableOpacity
                      style={styles.emergencyButton}
                      onPress={() => handleDispatchEmergency(alert.rideId, 'police')}
                      disabled={processingRideId === alert.rideId}>
                      <Text style={styles.emergencyEmoji}>👮</Text>
                      <Text style={styles.emergencyLabel}>Police</Text>
                      <Text style={styles.emergencyNumber}>100</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.emergencyButton}
                      onPress={() => handleDispatchEmergency(alert.rideId, 'ambulance')}
                      disabled={processingRideId === alert.rideId}>
                      <Text style={styles.emergencyEmoji}>🚑</Text>
                      <Text style={styles.emergencyLabel}>Ambulance</Text>
                      <Text style={styles.emergencyNumber}>102</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.emergencyButton}
                      onPress={() => handleDispatchEmergency(alert.rideId, 'fire')}
                      disabled={processingRideId === alert.rideId}>
                      <Text style={styles.emergencyEmoji}>🚒</Text>
                      <Text style={styles.emergencyLabel}>Fire</Text>
                      <Text style={styles.emergencyNumber}>101</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.emergencyButton}
                      onPress={() => handleDispatchEmergency(alert.rideId, 'disaster')}
                      disabled={processingRideId === alert.rideId}>
                      <Text style={styles.emergencyEmoji}>🆘</Text>
                      <Text style={styles.emergencyLabel}>All Services</Text>
                      <Text style={styles.emergencyNumber}>108</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.resolveButton,
                      processingRideId === alert.rideId && styles.disabledButton,
                    ]}
                    onPress={() =>
                      handleResolveSOSAlert(alert.rideId, alert.passengerName)
                    }
                    disabled={processingRideId === alert.rideId}>
                    {processingRideId === alert.rideId ? (
                      <ActivityIndicator
                        size="small"
                        color="white"
                      />
                    ) : (
                      <>
                        <CheckCircle size={16} color="white" />
                        <Text style={styles.actionButtonText}>Resolve SOS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: Colors.dark.error + '10',
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.error + '30',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.error,
  },
  alertBadge: {
    backgroundColor: Colors.dark.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 40,
  },
  alertBadgeText: {
    color: 'white',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  sosCard: {
    margin: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.error,
    overflow: 'hidden',
  },
  sosCardExpanded: {
    borderRadius: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  alertReason: {
    fontSize: 12,
    color: Colors.dark.warning,
    marginTop: 4,
  },
  timeElapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  timeEllapsedText: {
    color: Colors.dark.error,
    fontWeight: '600',
    fontSize: 12,
  },
  alertDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + '30',
  },
  detailSection: {
    marginVertical: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  locationInfo: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  locationLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  locationValue: {
    color: Colors.dark.text,
    fontWeight: '500',
    fontSize: 12,
  },
  personCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.gold,
  },
  driverCard: {
    borderLeftColor: Colors.dark.warning,
  },
  personHeader: {
    marginBottom: 10,
  },
  personLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  personName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneNumber: {
    color: Colors.dark.gold,
    fontWeight: '600',
    fontSize: 13,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
  },
  emergencyButton: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginRight: '4%',
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emergencyEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  emergencyLabel: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  emergencyNumber: {
    color: Colors.dark.gold,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 4,
  },
  actionButtonsContainer: {
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  resolveButton: {
    backgroundColor: Colors.dark.success,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + '20',
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
});
