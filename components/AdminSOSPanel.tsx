import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { EMERGENCY_CONTACTS } from '@/constants/emergency';
import {
  dispatchEmergencyServices,
  getActiveSOSAlerts,
  resolveSOSAlert,
} from '@/lib/api';

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relationship?: string;
}

interface SOSAlert {
  rideId: string;
  passengerName: string;
  passengerPhone: string;
  driverName: string;
  driverPhone: string;
  pickupLocation: any;
  dropoffLocation?: any;
  currentLocation: any;
  reason: string;
  sosActivatedAt: string;
  timeElapsed?: number;
  emergencyContacts?: EmergencyContact[];
}

type EmergencyServiceType = 'police' | 'ambulance' | 'fire' | 'disaster';

const serviceActions: Array<{
  type: EmergencyServiceType;
  label: string;
  number: string;
}> = [
  { type: 'police', label: 'Police', number: '100' },
  { type: 'ambulance', label: 'Ambulance', number: '102' },
  { type: 'fire', label: 'Fire', number: '101' },
  { type: 'disaster', label: 'All Services', number: '108' },
];

export default function AdminSOSPanel() {
  const [sosAlerts, setSOSAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [processingRideId, setProcessingRideId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveSOSAlerts();
    const interval = setInterval(fetchActiveSOSAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSOSAlerts = async () => {
    try {
      setRefreshing(true);
      const response = await getActiveSOSAlerts();
      setSOSAlerts(response.alerts || []);
      console.log('Fetched', response.count, 'active SOS alerts');
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
      Alert.alert('Error', 'Failed to fetch SOS alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCall = (phone: string | undefined, name: string) => {
    if (!phone) {
      Alert.alert('Phone unavailable', `${name} does not have a phone number saved.`);
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

  const handleSmsContact = (contact: EmergencyContact, alert: SOSAlert) => {
    const location =
      alert.currentLocation?.latitude && alert.currentLocation?.longitude
        ? ` Location: https://maps.google.com/?q=${alert.currentLocation.latitude},${alert.currentLocation.longitude}`
        : '';
    const body = `Tripza SOS: ${alert.passengerName} triggered an emergency alert during ride ${alert.rideId}.${location}`;
    Linking.openURL(`sms:${contact.phone}?body=${encodeURIComponent(body)}`);
  };

  const openMap = (alert: SOSAlert) => {
    const latitude = alert.currentLocation?.latitude;
    const longitude = alert.currentLocation?.longitude;
    if (!latitude || !longitude) {
      Alert.alert('Location unavailable', 'Current GPS coordinates are not available yet.');
      return;
    }

    Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
  };

  const handleDispatchEmergency = async (
    rideId: string,
    serviceType: EmergencyServiceType,
  ) => {
    try {
      setProcessingRideId(rideId);
      await dispatchEmergencyServices(rideId, serviceType);
      Alert.alert(
        'Dispatch Marked',
        `${EMERGENCY_CONTACTS[serviceType.toUpperCase()]?.name || serviceType} has been marked as dispatched. Driver and passenger have been notified.`,
      );
      fetchActiveSOSAlerts();
    } catch (error) {
      Alert.alert('Error', 'Failed to dispatch emergency service');
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleEmergencyServiceAction = (
    alert: SOSAlert,
    serviceType: EmergencyServiceType,
    label: string,
    number: string,
  ) => {
    Alert.alert(`${label} Response`, `Call ${number} or mark ${label} as dispatched?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Call ${number}`,
        onPress: () => Linking.openURL(`tel:${number}`),
      },
      {
        text: 'Mark Dispatched',
        style: 'destructive',
        onPress: () => handleDispatchEmergency(alert.rideId, serviceType),
      },
    ]);
  };

  const handleResolveSOSAlert = async (
    rideId: string,
    passengerName: string,
  ) => {
    const resolveAlert = async () => {
      try {
        setProcessingRideId(rideId);
        await resolveSOSAlert(
          rideId,
          'resolved_by_admin',
          'Resolved by admin - situation under control',
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('SOS alert has been marked as resolved.');
        } else {
          Alert.alert(
            'Success',
            'SOS alert has been marked as resolved. Driver and passenger notified.',
          );
        }
        fetchActiveSOSAlerts();
      } catch (error) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Failed to resolve SOS alert');
        } else {
          Alert.alert('Error', 'Failed to resolve SOS alert');
        }
      } finally {
        setProcessingRideId(null);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`Mark SOS alert for ${passengerName} as resolved?`)
          : true;
      if (confirmed) {
        await resolveAlert();
      }
      return;
    }

    Alert.alert(
      'Resolve SOS Alert',
      `Mark SOS alert for ${passengerName} as resolved?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: resolveAlert,
        },
      ],
    );
  };

  const formatElapsed = (seconds?: number) => {
    if (!seconds) return 'now';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    return `${Math.floor(seconds / 60)}m`;
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
      nestedScrollEnabled
      refreshControl={
        <RefreshControl
          onRefresh={fetchActiveSOSAlerts}
          refreshing={refreshing}
          tintColor={Colors.dark.error}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <AlertTriangle size={26} color={Colors.dark.error} />
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
            All passengers are safe. System is monitoring.
          </Text>
        </View>
      ) : (
        sosAlerts.map((alert) => {
          const isExpanded = expandedAlertId === alert.rideId;
          const contacts = alert.emergencyContacts || [];

          return (
            <View
              key={alert.rideId}
              style={[styles.sosCard, isExpanded && styles.sosCardExpanded]}
            >
              <TouchableOpacity
                onPress={() =>
                  setExpandedAlertId(isExpanded ? null : alert.rideId)
                }
                style={styles.alertHeader}
              >
                <View style={styles.alertHeaderLeft}>
                  <View style={styles.alertIcon}>
                    <AlertTriangle size={24} color="white" strokeWidth={2.5} />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.passengerName} numberOfLines={1}>
                      {alert.passengerName || 'Passenger'}
                    </Text>
                    <Text style={styles.alertReason} numberOfLines={2}>
                      {alert.reason || 'SOS alert triggered'}
                    </Text>
                  </View>
                </View>
                <View style={styles.timeElapsed}>
                  <Clock size={16} color={Colors.dark.error} />
                  <Text style={styles.timeElapsedText}>
                    {formatElapsed(alert.timeElapsed)}
                  </Text>
                </View>
                <ChevronDown
                  size={20}
                  color={Colors.dark.textSecondary}
                  style={{
                    transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                  }}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.alertDetails}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Location</Text>
                    <View style={styles.locationInfo}>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationLabel}>Pickup</Text>
                        <Text style={styles.locationValue} numberOfLines={2}>
                          {alert.pickupLocation?.name || 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationLabel}>Dropoff</Text>
                        <Text style={styles.locationValue} numberOfLines={2}>
                          {alert.dropoffLocation?.name || 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationLabel}>Current</Text>
                        <Text style={styles.locationValue}>
                          {alert.currentLocation?.latitude?.toFixed?.(4) || 'N/A'},
                          {alert.currentLocation?.longitude?.toFixed?.(4) || 'N/A'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => openMap(alert)}
                      >
                        <MapPin size={16} color={Colors.dark.background} />
                        <Text style={styles.mapButtonText}>Open live location</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>People Involved</Text>

                    <PersonCard
                      role="Passenger"
                      name={alert.passengerName}
                      phone={alert.passengerPhone}
                      accentColor={Colors.dark.gold}
                      onCall={() => handleCall(alert.passengerPhone, alert.passengerName)}
                    />

                    <PersonCard
                      role="Driver"
                      name={alert.driverName}
                      phone={alert.driverPhone}
                      accentColor={Colors.dark.warning}
                      onCall={() => handleCall(alert.driverPhone, alert.driverName)}
                    />
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Emergency Contacts</Text>
                    {contacts.length === 0 ? (
                      <Text style={styles.emptyContacts}>
                        No saved emergency contacts found for this passenger.
                      </Text>
                    ) : (
                      contacts.map((contact, index) => (
                        <View
                          key={`${contact.phone}-${index}`}
                          style={styles.contactCard}
                        >
                          <View style={styles.contactInfo}>
                            <Text style={styles.personName} numberOfLines={1}>
                              {contact.name || 'Emergency contact'}
                            </Text>
                            <Text style={styles.personMeta} numberOfLines={1}>
                              {contact.relationship || 'Contact'} - {contact.phone}
                            </Text>
                          </View>
                          <View style={styles.contactActions}>
                            <TouchableOpacity
                              style={styles.smallAction}
                              onPress={() => handleCall(contact.phone, contact.name)}
                            >
                              <Phone size={15} color={Colors.dark.gold} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.smallAction}
                              onPress={() => handleSmsContact(contact, alert)}
                            >
                              <MessageCircle size={15} color={Colors.dark.gold} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Emergency Services</Text>
                    <View style={styles.emergencyGrid}>
                      {serviceActions.map((service) => (
                        <TouchableOpacity
                          key={service.type}
                          style={styles.emergencyButton}
                          onPress={() =>
                            handleEmergencyServiceAction(
                              alert,
                              service.type,
                              service.label,
                              service.number,
                            )
                          }
                          disabled={processingRideId === alert.rideId}
                        >
                          <Text style={styles.emergencyLabel}>
                            {service.label}
                          </Text>
                          <Text style={styles.emergencyNumber}>
                            {service.number}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

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
                      disabled={processingRideId === alert.rideId}
                    >
                      {processingRideId === alert.rideId ? (
                        <ActivityIndicator size="small" color="white" />
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
          );
        })
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </ScrollView>
  );
}

function PersonCard({
  role,
  name,
  phone,
  accentColor,
  onCall,
}: {
  role: string;
  name: string;
  phone?: string;
  accentColor: string;
  onCall: () => void;
}) {
  return (
    <View style={[styles.personCard, { borderLeftColor: accentColor }]}>
      <View style={styles.personHeader}>
        <Text style={styles.personLabel}>{role}</Text>
        <Text style={styles.personName} numberOfLines={1}>
          {name || role}
        </Text>
      </View>
      <TouchableOpacity style={styles.contactRow} onPress={onCall}>
        <Phone size={16} color={accentColor} />
        <Text style={[styles.phoneNumber, { color: accentColor }]}>
          {phone || 'N/A'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    minHeight: 220,
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
    paddingVertical: 18,
    backgroundColor: Colors.dark.error + '10',
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.error + '30',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerText: {
    fontSize: 19,
    fontWeight: '800',
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
    paddingVertical: 52,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    textAlign: 'center',
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
    minWidth: 0,
  },
  alertIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.dark.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertInfo: {
    flex: 1,
    minWidth: 0,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '800',
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
    marginHorizontal: 10,
  },
  timeElapsedText: {
    color: Colors.dark.error,
    fontWeight: '700',
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
    fontWeight: '800',
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
    gap: 12,
    paddingVertical: 6,
  },
  locationLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    minWidth: 62,
  },
  locationValue: {
    color: Colors.dark.text,
    fontWeight: '500',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.gold,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
  },
  mapButtonText: {
    color: Colors.dark.background,
    fontWeight: '900',
    fontSize: 13,
  },
  personCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  personHeader: {
    marginBottom: 10,
  },
  personLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  personName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  personMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneNumber: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContacts: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    padding: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
  },
  emergencyButton: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emergencyLabel: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  emergencyNumber: {
    color: Colors.dark.gold,
    fontWeight: '800',
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
    fontWeight: '800',
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
